import jwt from "jsonwebtoken";

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

/** Signe un jeton de session comme le fait le serveur au login. */
const signSession = (user: SessionUser): string =>
  jwt.sign(user, process.env.JWT_SECRET as string, {
    algorithm: "HS256",
    expiresIn: "7d",
  });

/** En-tête `Cookie` prêt à l'emploi pour supertest. */
const sessionCookie = (user: SessionUser): string =>
  `ww_session=${signSession(user)}`;

export { adminUser, clientUser, sessionCookie, signSession };
export type { SessionUser };
