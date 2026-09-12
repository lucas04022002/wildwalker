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

import { resetLoginLimiter } from "../src/Middlewares/rateLimit";
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
