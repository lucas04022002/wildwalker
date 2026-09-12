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
  };

  return jwt.sign(payload, getSecret(), options);
};

const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as TokenPayload;

/** Options du cookie de session : `Secure` seulement en production. */
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_DURATION_MS,
  path: "/",
});

export default { signToken, verifyToken, cookieOptions };
export {
  COOKIE_NAME,
  SESSION_DURATION_MS,
  SESSION_DURATION_SECONDS,
  cookieOptions,
};
export type { TokenPayload };
