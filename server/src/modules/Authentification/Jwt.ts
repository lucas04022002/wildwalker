import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

/**
 * Signature et vérification du jeton de session.
 *
 * Ce module ne journalise rien : ni le secret, ni le jeton, ni la charge
 * utile. Un jeton dans les journaux est un jeton volé.
 */

const COOKIE_NAME = "ww_session";

/** Sept jours, exprimés en secondes puis en millisecondes pour le cookie. */
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;
const SESSION_DURATION_MS = SESSION_DURATION_SECONDS * 1000;

type TokenPayload = {
  id: number;
  email: string;
  role: string;
  firstname: string;
  /**
   * Identifiant unique de CE jeton, tiré au hasard à la signature.
   *
   * Sans lui, un jeton n'est désignable par rien : on ne peut ni le révoquer,
   * ni distinguer deux sessions du même compte. C'est ce qui permet à la
   * déconnexion de ne fermer que la session en cours, et pas toutes les
   * autres.
   *
   * Optionnel à la lecture : les jetons signés avant cette version n'en
   * portent pas, et doivent rester valides jusqu'à leur expiration naturelle.
   */
  jti?: string;
  /** Posé par jsonwebtoken. Sert à dater la ligne de révocation. */
  exp?: number;
};

/**
 * Le secret est lu à chaque appel (et non à l'import) : le processus doit
 * pouvoir échouer clairement s'il manque, et les tests le posent avant
 * d'utiliser l'application.
 */
const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (secret == null || secret === "") {
    throw new Error("JWT_SECRET manquant.");
  }

  return secret;
};

const signToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    algorithm: "HS256",
    expiresIn: SESSION_DURATION_SECONDS,
    jwtid: payload.jti ?? randomUUID(),
  };

  // `jti` est posé par `jwtid` : le laisser aussi dans la charge utile le
  // ferait écrire deux fois, et jsonwebtoken refuse la collision.
  const { jti: _jti, exp: _exp, ...corps } = payload;

  return jwt.sign(corps, getSecret(), options);
};

const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as TokenPayload;

/**
 * Le cookie doit-il porter l'attribut `Secure` ?
 *
 * Par défaut : oui en production, non ailleurs. `COOKIE_SECURE` permet de
 * forcer la réponse dans les deux sens, pour un seul cas légitime : le smoke
 * test de la CI, qui lance l'image avec `NODE_ENV=production` mais parle en
 * HTTP simple — sans ce levier, le navigateur (et supertest) n'enverrait
 * jamais le cookie et le test ne prouverait rien. À NE JAMAIS poser en
 * production réelle : un cookie de session sans `Secure` voyage en clair.
 */
const isCookieSecure = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const override = (env.COOKIE_SECURE ?? "").trim().toLowerCase();

  if (override === "0" || override === "false") {
    return false;
  }

  if (override === "1" || override === "true") {
    return true;
  }

  return env.NODE_ENV === "production";
};

/** Options du cookie de session. */
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isCookieSecure(),
  maxAge: SESSION_DURATION_MS,
  path: "/",
});

export default { signToken, verifyToken, cookieOptions };
export {
  COOKIE_NAME,
  isCookieSecure,
  SESSION_DURATION_MS,
  SESSION_DURATION_SECONDS,
  cookieOptions,
};
export type { TokenPayload };
