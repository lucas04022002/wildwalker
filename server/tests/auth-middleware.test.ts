import request from "supertest";

jest.mock("../database/client", () => ({
  __esModule: true,
  default: {
    query: jest.fn(async () => [[], []]),
    getConnection: jest.fn(),
  },
}));

jest.mock("../src/modules/dashboardAdmin/dashboardAdminRepository", () => ({
  __esModule: true,
  default: {
    readAdminStats: jest.fn(async () => ({ bookings: 0 })),
  },
}));

jest.mock("../src/modules/Authentification/AuthentificationRepository", () => ({
  __esModule: true,
  default: {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("argon2", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async () => "$argon2id$factice"),
    verify: jest.fn(async () => true),
  },
}));

import argon2 from "argon2";
import { resetLoginLimiter } from "../src/Middlewares/rateLimit";
import app from "../src/app";
import { DUMMY_PASSWORD_HASH } from "../src/modules/Authentification/AuthentificationAction";
import authRepository from "../src/modules/Authentification/AuthentificationRepository";
import {
  adminUser,
  clientUser,
  sessionCookie,
  signSession,
} from "./helpers/session";

const ADMIN_ROUTE = "/api/dashboard/admin/stats";

describe("requireAuth", () => {
  test("401 sans cookie ni en-tête Authorization", async () => {
    const res = await request(app).get(ADMIN_ROUTE);

    expect(res.status).toBe(401);
  });

  test("401 avec un cookie ww_session illisible", async () => {
    const res = await request(app)
      .get(ADMIN_ROUTE)
      .set("Cookie", "ww_session=pas-un-jeton");

    expect(res.status).toBe(401);
  });

  test("ne divulgue jamais le jeton ni l'erreur de vérification", async () => {
    const res = await request(app)
      .get(ADMIN_ROUTE)
      .set("Cookie", "ww_session=pas-un-jeton");

    expect(JSON.stringify(res.body)).not.toContain("pas-un-jeton");
    expect(res.body.error).toBeUndefined();
  });

  test("accepte encore l'en-tête Authorization: Bearer (transition)", async () => {
    const res = await request(app)
      .get(ADMIN_ROUTE)
      .set("Authorization", `Bearer ${signSession(adminUser)}`);

    expect(res.status).toBe(200);
  });
});

describe("requireAdmin", () => {
  test("403 avec le cookie d'un client", async () => {
    const res = await request(app)
      .get(ADMIN_ROUTE)
      .set("Cookie", sessionCookie(clientUser));

    expect(res.status).toBe(403);
  });

  test("200 avec le cookie d'un admin", async () => {
    const res = await request(app)
      .get(ADMIN_ROUTE)
      .set("Cookie", sessionCookie(adminUser));

    expect(res.status).toBe(200);
  });

  test("401 sans cookie", async () => {
    const res = await request(app).get(ADMIN_ROUTE);

    expect(res.status).toBe(401);
  });
});

/* ************************************************************************* */
/* Login : le rôle attendu est vérifié, la réponse ne porte pas le jeton.     */
/* ************************************************************************* */

const dbUser = (role: string) => ({
  id: 42,
  email: "quelquun@exemple.test",
  password: "$argon2id$factice",
  role,
  firstname: "Dominique",
  lastname: "Martin",
  phone_number: "0600000000",
  city: null,
  adress: null,
  profile_image: null,
  signing_date: "2026-01-01 00:00:00",
});

describe("login par rôle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLoginLimiter();
  });

  test("401 générique quand un compte client se connecte côté admin", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(
      dbUser("client"),
    );

    const res = await request(app)
      .post("/api/auth/login/admin")
      .send({ email: "quelquun@exemple.test", password: "peu-importe" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email ou mot de passe incorrect.");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("401 générique quand un compte admin se connecte côté client", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(
      dbUser("admin"),
    );

    const res = await request(app)
      .post("/api/auth/login/client")
      .send({ email: "quelquun@exemple.test", password: "peu-importe" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email ou mot de passe incorrect.");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("pose le cookie ww_session httpOnly et ne renvoie pas de jeton", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(
      dbUser("client"),
    );

    const res = await request(app)
      .post("/api/auth/login/client")
      .send({ email: "quelquun@exemple.test", password: "peu-importe" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({ id: 42, role: "client" });
    expect(res.body.user.password).toBeUndefined();

    const [cookie] = res.headers["set-cookie"] as unknown as string[];
    expect(cookie).toMatch(/^ww_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).not.toMatch(/Secure/i);
  });

  test("logout efface le cookie", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", sessionCookie(clientUser));

    expect(res.status).toBe(204);
    const [cookie] = res.headers["set-cookie"] as unknown as string[];
    expect(cookie).toMatch(/^ww_session=;/);
  });
});

/* ************************************************************************* */
/* Le login ne doit rien apprendre sur l'existence d'un compte.              */
/* ************************************************************************* */

describe("login, e-mail inconnu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLoginLimiter();
  });

  test("vérifie quand même un hash factice, pour un temps de réponse identique", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login/client")
      .send({ email: "inconnu@exemple.fr", password: "peu-importe" });

    expect(res.status).toBe(401);
    expect(argon2.verify).toHaveBeenCalledWith(
      DUMMY_PASSWORD_HASH,
      "peu-importe",
    );
  });
});

/* ************************************************************************* */
/* L'inscription ne doit pas dire si une adresse est déjà prise.             */
/* ************************************************************************* */

const registration = {
  firstname: "Dominique",
  lastname: "Martin",
  email: "nouvelle@exemple.fr",
  password: "un-mot-de-passe-long",
  phone_number: "0600000000",
};

describe("inscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLoginLimiter();
  });

  test("répond un message générique quand l'adresse est libre", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(null);
    (authRepository.create as jest.Mock).mockResolvedValue({
      ...dbUser("client"),
      email: registration.email,
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send(registration);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: "Si l'adresse est disponible, le compte est créé.",
    });
    expect(res.body.user).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("répond exactement pareil quand l'adresse est déjà prise", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(
      dbUser("client"),
    );

    const res = await request(app)
      .post("/api/auth/register")
      .send(registration);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      message: "Si l'adresse est disponible, le compte est créé.",
    });
    expect(authRepository.create).not.toHaveBeenCalled();
  });

  test("hache le mot de passe dans les deux cas (temps de réponse comparable)", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(
      dbUser("client"),
    );

    await request(app).post("/api/auth/register").send(registration);

    expect(argon2.hash).toHaveBeenCalledTimes(1);
  });

  test("le 11e essai sur la même adresse est refusé en 429", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(null);
    (authRepository.create as jest.Mock).mockResolvedValue(dbUser("client"));

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post("/api/auth/register")
        .send(registration);
      expect(res.status).toBe(201);
    }

    const res = await request(app)
      .post("/api/auth/register")
      .send(registration);

    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });
});
