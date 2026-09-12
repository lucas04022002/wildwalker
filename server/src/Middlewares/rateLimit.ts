import type { RequestHandler } from "express";

/**
 * Limite de débit par adresse e-mail, en mémoire.
 *
 * Dix essais par fenêtre de quinze minutes. En mémoire donc par processus :
 * cela suffit pour freiner un bourrage de mots de passe sur un déploiement à
 * un seul conteneur, et c'est assumé.
 *
 * La table est bornée des deux côtés. Sans cela, c'est l'attaquant qui
 * choisit sa taille : une adresse inventée par requête suffit à la faire
 * grossir jusqu'à épuiser la mémoire. On balaie donc les compteurs expirés
 * régulièrement, et on plafonne le nombre de clés suivies.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** Au-delà, les clés les plus anciennes sont évincées (Map = ordre d'insertion). */
const MAX_TRACKED_KEYS = 10_000;

/** Un balayage des compteurs expirés toutes les N nouvelles clés. */
const SWEEP_EVERY = 100;

type Bucket = { count: number; resetAt: number };

/** Le middleware, augmenté de quoi l'observer et le remettre à zéro. */
type EmailRateLimiter = RequestHandler & {
  size: () => number;
  reset: () => void;
};

/** Clé du compteur : l'e-mail normalisé, ou l'IP si le body n'en porte pas. */
const keyFor = (req: Parameters<RequestHandler>[0]): string => {
  const email = (req.body as { email?: unknown } | undefined)?.email;

  if (typeof email === "string" && email.trim() !== "") {
    return `email:${email.trim().toLowerCase()}`;
  }

  return `ip:${req.ip ?? "inconnue"}`;
};

const createEmailRateLimiter = (
  maxAttempts: number = MAX_ATTEMPTS,
): EmailRateLimiter => {
  const buckets = new Map<string, Bucket>();
  let insertsSinceSweep = 0;

  /** Retire les compteurs dont la fenêtre est passée. */
  const sweep = (now: number): void => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  /** Évince les clés les plus anciennes tant que le plafond est dépassé. */
  const evictOldest = (): void => {
    while (buckets.size > MAX_TRACKED_KEYS) {
      const oldest = buckets.keys().next();
      if (oldest.done) return;
      buckets.delete(oldest.value);
    }
  };

  const track = (key: string, now: number): void => {
    insertsSinceSweep += 1;

    if (insertsSinceSweep >= SWEEP_EVERY) {
      insertsSinceSweep = 0;
      sweep(now);
    }

    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    evictOldest();
  };

  const handler: RequestHandler = (req, res, next) => {
    const key = keyFor(req);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (bucket == null || bucket.resetAt <= now) {
      track(key, now);
      next();
      return;
    }

    if (bucket.count >= maxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        message: "Trop de tentatives. Réessayez plus tard.",
      });
      return;
    }

    bucket.count += 1;
    next();
  };

  return Object.assign(handler, {
    size: () => buckets.size,
    reset: () => {
      buckets.clear();
      insertsSinceSweep = 0;
    },
  });
};

/** Compteurs distincts : dix connexions ET dix inscriptions par adresse. */
const loginLimiter = createEmailRateLimiter();
const registerLimiter = createEmailRateLimiter();

/** Remet tous les compteurs à zéro (tests). */
const resetLoginLimiter = (): void => {
  loginLimiter.reset();
  registerLimiter.reset();
};

export default { loginLimiter, registerLimiter, resetLoginLimiter };
export {
  MAX_ATTEMPTS,
  MAX_TRACKED_KEYS,
  SWEEP_EVERY,
  WINDOW_MS,
  createEmailRateLimiter,
  loginLimiter,
  registerLimiter,
  resetLoginLimiter,
};
export type { EmailRateLimiter };
