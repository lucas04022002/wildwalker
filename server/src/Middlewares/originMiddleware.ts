import type { RequestHandler } from "express";

/**
 * Garde d'origine : défense contre les requêtes écrites déclenchées depuis un
 * autre site (CSRF). Le cookie de session étant `SameSite=Lax`, il n'est déjà
 * pas envoyé sur une requête POST venue d'ailleurs ; cette garde ferme le
 * reste et rend l'intention explicite côté serveur.
 *
 * Elle échoue en position fermée : une origine présente et inconnue est
 * refusée, sans exception paramétrable.
 */

/** Les méthodes qui ne modifient rien ne sont pas concernées. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Valeurs de `Sec-Fetch-Site` acceptées pour une écriture. */
const ALLOWED_SITES = new Set(["same-origin", "same-site", "none"]);

const normalize = (value: string): string =>
  value.trim().toLowerCase().replace(/\/+$/, "");

/** Origines acceptées : `CLIENT_URL` et l'hôte de la requête elle-même. */
const allowedOrigins = (req: Parameters<RequestHandler>[0]): string[] => {
  const origins: string[] = [];
  const clientUrl = process.env.CLIENT_URL;

  if (clientUrl != null && clientUrl !== "") {
    origins.push(normalize(clientUrl));
  }

  const host = req.headers.host;

  if (typeof host === "string" && host !== "") {
    origins.push(normalize(`${req.protocol}://${host}`));
    origins.push(normalize(`http://${host}`));
    origins.push(normalize(`https://${host}`));
  }

  return origins;
};

const refuse = (res: Parameters<RequestHandler>[1]): void => {
  res.status(403).json({ message: "Origine de la requête refusée." });
};

const assertSameOrigin: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const site = req.headers["sec-fetch-site"];

  if (typeof site === "string" && !ALLOWED_SITES.has(site.toLowerCase())) {
    refuse(res);
    return;
  }

  const origin = req.headers.origin;

  // `Origin: null` (bac à sable, document local, certaines redirections) est
  // une origine opaque : elle n'est jamais la nôtre, donc elle est refusée
  // comme n'importe quelle origine étrangère.
  if (typeof origin === "string" && origin !== "") {
    if (!allowedOrigins(req).includes(normalize(origin))) {
      refuse(res);
      return;
    }
  }

  next();
};

export default { assertSameOrigin };
export { assertSameOrigin };
