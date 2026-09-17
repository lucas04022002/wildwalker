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

/** Comment un compteur désigne celui qu'il suit. */
type KeyFn = (req: Parameters<RequestHandler>[0]) => string;

/** Clé du compteur : l'e-mail normalisé, ou l'IP si le body n'en porte pas. */
const keyByEmail: KeyFn = (req) => {
  const email = (req.body as { email?: unknown } | undefined)?.email;

  if (typeof email === "string" && email.trim() !== "") {
    return `email:${email.trim().toLowerCase()}`;
  }

  return `ip:${req.ip ?? "inconnue"}`;
};

/** Clé du compteur par adresse, quel que soit le corps de la requête. */
const keyByIp: KeyFn = (req) => `ip:${req.ip ?? "inconnue"}`;

/**
 * Nombre de proxys de confiance devant l'application.
 *
 * Tant qu'il vaut 0, `req.ip` est l'adresse du dernier saut réseau : derrière
 * le reverse proxy de Coolify, la même pour tous les visiteurs. Un compteur
 * par IP porterait alors sur le proxy, et trente essais suffiraient à fermer
 * la connexion du site entier.
 *
 * Le compteur par IP reste donc inerte tant que ce nombre n'est pas posé :
 * mieux vaut une protection absente qu'une protection qui verrouille tout le
 * monde. En production derrière Coolify : `TRUSTED_PROXY_HOPS=1`.
 */
const trustedProxyHops = (): number => {
  const brut = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10);
  return Number.isFinite(brut) && brut > 0 ? brut : 0;
};

/**
 * Plafond par adresse IP, plus large que celui par compte.
 *
 * Le compteur par e-mail protège UN compte contre le bourrage ; il ne voit pas
 * la pulvérisation — un mot de passe courant essayé sur mille adresses n'est
 * jamais freiné, chaque adresse ayant son propre compteur.
 *
 * Trente, et non dix : une IP est souvent partagée (bureau, NAT d'opérateur
 * mobile), et plusieurs personnes peuvent légitimement s'y tromper.
 */
const MAX_ATTEMPTS_PAR_IP = 30;

const createRateLimiter = (
  keyFor: KeyFn,
  maxAttempts: number = MAX_ATTEMPTS,
  estActif: () => boolean = () => true,
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
    if (!estActif()) {
      next();
      return;
    }

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
const loginLimiter = createRateLimiter(keyByEmail);
const registerLimiter = createRateLimiter(keyByEmail);

/**
 * Demandes de réinitialisation.
 *
 * Trois par adresse et par quart d'heure : au-delà, ce n'est plus quelqu'un
 * qui a oublié son mot de passe, c'est quelqu'un qui se sert du formulaire
 * pour inonder une boîte de messages.
 */
const forgotLimiter = createRateLimiter(keyByEmail, 3);

/** Et, par-dessus, un plafond par adresse IP contre la pulvérisation. */
const loginIpLimiter = createRateLimiter(
  keyByIp,
  MAX_ATTEMPTS_PAR_IP,
  () => trustedProxyHops() > 0,
);

/** Conservé sous son ancien nom : le moteur est le même, la clé est l'e-mail. */
const createEmailRateLimiter = (maxAttempts: number = MAX_ATTEMPTS) =>
  createRateLimiter(keyByEmail, maxAttempts);

/** Remet tous les compteurs à zéro (tests). */
const resetLoginLimiter = (): void => {
  loginLimiter.reset();
  registerLimiter.reset();
  loginIpLimiter.reset();
  forgotLimiter.reset();
};

export default {
  forgotLimiter,
  loginLimiter,
  loginIpLimiter,
  registerLimiter,
  resetLoginLimiter,
};
export {
  MAX_ATTEMPTS,
  MAX_ATTEMPTS_PAR_IP,
  MAX_TRACKED_KEYS,
  SWEEP_EVERY,
  WINDOW_MS,
  createEmailRateLimiter,
  createRateLimiter,
  forgotLimiter,
  keyByEmail,
  keyByIp,
  loginIpLimiter,
  loginLimiter,
  registerLimiter,
  resetLoginLimiter,
  trustedProxyHops,
};
export type { EmailRateLimiter };
