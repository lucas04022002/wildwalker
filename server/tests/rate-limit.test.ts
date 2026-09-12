import request from "supertest";

jest.mock("../database/client", () => ({
  __esModule: true,
  default: {
    query: jest.fn(async () => [[], []]),
    getConnection: jest.fn(),
  },
}));

jest.mock("../src/modules/Authentification/AuthentificationRepository", () => ({
  __esModule: true,
  default: {
    findByEmail: jest.fn(async () => null),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));

import type { Request, Response } from "express";
import {
  MAX_TRACKED_KEYS,
  loginLimiter,
  resetLoginLimiter,
} from "../src/Middlewares/rateLimit";
import app from "../src/app";

const attempt = (email: string) =>
  request(app).post("/api/auth/login/client").send({ email, password: "x" });

describe("limite de débit au login", () => {
  beforeEach(() => {
    resetLoginLimiter();
  });

  test("le 11e essai sur le même e-mail est refusé en 429", async () => {
    const email = "cible@exemple.test";

    for (let i = 0; i < 10; i += 1) {
      const res = await attempt(email);
      expect(res.status).toBe(401);
    }

    const res = await attempt(email);

    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  test("un autre e-mail garde son propre compteur", async () => {
    const email = "cible@exemple.test";

    for (let i = 0; i < 11; i += 1) {
      await attempt(email);
    }

    const res = await attempt("quelquun.dautre@exemple.test");

    expect(res.status).toBe(401);
  });

  test("la casse de l'e-mail ne permet pas de contourner le compteur", async () => {
    for (let i = 0; i < 10; i += 1) {
      await attempt("cible@exemple.test");
    }

    const res = await attempt("CIBLE@Exemple.TEST");

    expect(res.status).toBe(429);
  });
});

/* ************************************************************************* */
/* La Map ne doit pas grandir indéfiniment : c'est une fuite de mémoire      */
/* qu'un attaquant contrôle (une clé par adresse essayée).                   */
/* ************************************************************************* */

/** Appelle le middleware hors HTTP, pour pouvoir en enchaîner des milliers. */
const hit = (email: string): void => {
  const req = { body: { email }, ip: "::1" } as unknown as Request;
  const res = {
    set: () => res,
    status: () => res,
    json: () => res,
  } as unknown as Response;

  loginLimiter(req, res, () => undefined);
};

describe("empreinte mémoire du limiteur", () => {
  beforeEach(() => {
    resetLoginLimiter();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetLoginLimiter();
  });

  test("purge les compteurs expirés au fil des insertions", () => {
    const start = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(start);

    for (let i = 0; i < 99; i += 1) {
      hit(`essai${i}@exemple.fr`);
    }
    expect(loginLimiter.size()).toBe(99);

    // Une fois la fenêtre passée, la centième insertion déclenche le balayage.
    jest.spyOn(Date, "now").mockReturnValue(start + 16 * 60 * 1000);
    hit("apres@exemple.fr");

    expect(loginLimiter.size()).toBe(1);
  });

  test("plafonne le nombre de clés suivies et évince les plus anciennes", () => {
    const start = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(start);

    for (let i = 0; i < MAX_TRACKED_KEYS + 500; i += 1) {
      hit(`saturation${i}@exemple.fr`);
    }

    expect(loginLimiter.size()).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
    expect(loginLimiter.size()).toBeGreaterThan(0);
  });
});
