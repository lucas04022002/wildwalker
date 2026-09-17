import jwtUtil from "../../src/modules/Authentification/Jwt";

type SessionUser = {
  id: number;
  email: string;
  role: string;
  firstname: string;
};

const clientUser: SessionUser = {
  id: 7,
  email: "client@exemple.test",
  role: "client",
  firstname: "Camille",
};

const adminUser: SessionUser = {
  id: 1,
  email: "admin@exemple.test",
  role: "admin",
  firstname: "Alex",
};

/**
 * Signe un jeton de session en appelant le signataire du serveur.
 *
 * Il recopiait auparavant `jwt.sign` avec ses propres options. Les deux ont
 * divergé le jour où le serveur a commencé à poser un `jti` : les jetons des
 * tests n'en portaient pas, et les tests validaient donc un jeton qui
 * n'existe plus en production. Passer par le vrai code supprime la question.
 */
const signSession = (user: SessionUser): string => jwtUtil.signToken(user);

/** En-tête `Cookie` prêt à l'emploi pour supertest. */
const sessionCookie = (user: SessionUser): string =>
  `ww_session=${signSession(user)}`;

export { adminUser, clientUser, sessionCookie, signSession };
export type { SessionUser };
