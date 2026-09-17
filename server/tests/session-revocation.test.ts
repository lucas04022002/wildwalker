import request from "supertest";

jest.mock("../database/client", () => ({
  __esModule: true,
  default: { query: jest.fn(async () => [[], []]), getConnection: jest.fn() },
}));

jest.mock("../src/modules/Authentification/SessionRepository", () => ({
  __esModule: true,
  default: {
    isRevoked: jest.fn(async () => false),
    lireEtat: jest.fn(async () => ({
      revoque: false,
      motDePasseChangeLe: null,
    })),
    revoke: jest.fn(async () => undefined),
    purgerExpirees: jest.fn(async () => undefined),
  },
}));

jest.mock("../src/modules/dashboardAdmin/dashboardAdminRepository", () => ({
  __esModule: true,
  default: { readAdminStats: jest.fn(async () => ({ bookings: 0 })) },
}));

import jwt from "jsonwebtoken";
import app from "../src/app";
import { COOKIE_NAME } from "../src/modules/Authentification/Jwt";
import sessionRepository from "../src/modules/Authentification/SessionRepository";
import { adminUser, sessionCookie, signSession } from "./helpers/session";

const ROUTE = "/api/dashboard/admin/stats";

const jtiDe = (cookie: string): string | undefined => {
  const jeton = cookie.split(";")[0].split("=")[1];
  return (jwt.decode(jeton) as { jti?: string } | null)?.jti;
};

beforeEach(() => {
  jest.clearAllMocks();
  (sessionRepository.lireEtat as jest.Mock).mockResolvedValue({
    revoque: false,
    motDePasseChangeLe: null,
  });
  (sessionRepository.revoke as jest.Mock).mockResolvedValue(undefined);
});

describe("le jeton porte un identifiant révocable", () => {
  test("chaque signature produit un jti différent", () => {
    const a = jtiDe(sessionCookie(adminUser));
    const b = jtiDe(sessionCookie(adminUser));

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toBe(b);
  });
});

describe("requireAuth", () => {
  test("laisse passer un jeton non révoqué", async () => {
    const res = await request(app)
      .get(ROUTE)
      .set("Cookie", sessionCookie(adminUser));

    expect(res.status).toBe(200);
    expect(sessionRepository.lireEtat).toHaveBeenCalled();
  });

  test("401 sur un jeton révoqué, même si la signature est bonne", async () => {
    (sessionRepository.lireEtat as jest.Mock).mockResolvedValue({
      revoque: true,
      motDePasseChangeLe: null,
    });

    const res = await request(app)
      .get(ROUTE)
      .set("Cookie", sessionCookie(adminUser));

    expect(res.status).toBe(401);
  });

  test("401 sur un jeton émis AVANT un changement de mot de passe", async () => {
    // Le jeton vient d'être signé ; on date le changement d'une heure plus tard.
    // C'est le cas qui justifie la réinitialisation : quelqu'un d'autre est
    // connecté, et changer le mot de passe doit le mettre dehors.
    (sessionRepository.lireEtat as jest.Mock).mockResolvedValue({
      revoque: false,
      motDePasseChangeLe: new Date(Date.now() + 3_600_000),
    });

    const res = await request(app)
      .get(ROUTE)
      .set("Cookie", sessionCookie(adminUser));

    expect(res.status).toBe(401);
  });

  test("un jeton émis APRÈS le changement reste valide", async () => {
    (sessionRepository.lireEtat as jest.Mock).mockResolvedValue({
      revoque: false,
      motDePasseChangeLe: new Date(Date.now() - 3_600_000),
    });

    const res = await request(app)
      .get(ROUTE)
      .set("Cookie", sessionCookie(adminUser));

    expect(res.status).toBe(200);
  });

  test("503 si la base est injoignable : la garde échoue en position fermée", async () => {
    (sessionRepository.lireEtat as jest.Mock).mockRejectedValue(
      new Error("base injoignable"),
    );

    const res = await request(app)
      .get(ROUTE)
      .set("Cookie", sessionCookie(adminUser));

    // Surtout pas 200 : une panne ne doit pas rouvrir une session fermée.
    expect(res.status).toBe(503);
  });

  test("un jeton signé avant cette version reste accepté jusqu'à son expiration", async () => {
    const ancien = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: "admin",
        firstname: "A",
      },
      process.env.JWT_SECRET as string,
      { algorithm: "HS256", expiresIn: 3600 },
    );

    const res = await request(app)
      .get(ROUTE)
      .set("Cookie", `${COOKIE_NAME}=${ancien}`);

    expect(res.status).toBe(200);
  });
});

describe("déconnexion", () => {
  const deconnecter = (cookie?: string) => {
    const req = request(app)
      .post("/api/auth/logout")
      .set("Origin", "http://localhost:3000");
    return cookie ? req.set("Cookie", cookie) : req;
  };

  test("révoque le jeton présenté, avec sa date d'expiration", async () => {
    const cookie = sessionCookie(adminUser);
    const res = await deconnecter(cookie);

    expect(res.status).toBe(204);
    expect(sessionRepository.revoke).toHaveBeenCalledWith(
      jtiDe(cookie),
      expect.any(Date),
    );
  });

  test("une révocation impossible est une déconnexion ratée, pas silencieuse", async () => {
    (sessionRepository.revoke as jest.Mock).mockRejectedValue(
      new Error("base injoignable"),
    );

    const res = await deconnecter(sessionCookie(adminUser));

    // Le cookie ne doit pas être effacé : sinon le navigateur oublie un jeton
    // toujours vivant, que quelqu'un d'autre peut rejouer.
    expect(res.status).toBe(500);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("sans cookie : 204, et rien à révoquer", async () => {
    const res = await deconnecter();

    expect(res.status).toBe(204);
    expect(sessionRepository.revoke).not.toHaveBeenCalled();
  });

  test("cookie illisible : 204 quand même, sans lever d'erreur", async () => {
    const res = await deconnecter(`${COOKIE_NAME}=pas-un-jeton`);

    expect(res.status).toBe(204);
    expect(sessionRepository.revoke).not.toHaveBeenCalled();
  });

  test("le jeton révoqué ne rouvre plus rien", async () => {
    const cookie = sessionCookie(adminUser);
    await deconnecter(cookie);

    (sessionRepository.lireEtat as jest.Mock).mockResolvedValue({
      revoque: true,
      motDePasseChangeLe: null,
    });
    const res = await request(app).get(ROUTE).set("Cookie", cookie);

    expect(res.status).toBe(401);
  });
});

describe("signSession", () => {
  test("le helper de test produit lui aussi un jti", () => {
    const jeton = signSession(adminUser);
    expect((jwt.decode(jeton) as { jti?: string }).jti).toBeDefined();
  });
});
