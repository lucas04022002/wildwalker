import type { RequestHandler } from "express";

/**
 * Limite de débit du login, en mémoire.
 *
 * Un compteur par e-mail, dix essais par fenêtre de quinze minutes. En
 * mémoire donc par processus : cela suffit pour freiner un bourrage de mots
 * de passe sur un déploiement à un seul conteneur, et c'est assumé.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Clé du compteur : l'e-mail normalisé, ou l'IP si le body n'en porte pas. */
const keyFor = (req: Parameters<RequestHandler>[0]): string => {
  const email = (req.body as { email?: unknown } | undefined)?.email;

  if (typeof email === "string" && email.trim() !== "") {
    return `email:${email.trim().toLowerCase()}`;
  }

  return `ip:${req.ip ?? "inconnue"}`;
};

const loginLimiter: RequestHandler = (req, res, next) => {
  const key = keyFor(req);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (bucket == null || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({
      message: "Trop de tentatives de connexion. Réessayez plus tard.",
    });
    return;
  }

  bucket.count += 1;
  next();
};

/** Remet les compteurs à zéro (tests). */
const resetLoginLimiter = (): void => {
  buckets.clear();
};

export default { loginLimiter, resetLoginLimiter };
export { MAX_ATTEMPTS, WINDOW_MS, loginLimiter, resetLoginLimiter };
