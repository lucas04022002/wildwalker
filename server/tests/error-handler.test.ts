import request from "supertest";

jest.mock("../database/client", () => ({
  __esModule: true,
  default: {
    query: jest.fn(async () => [[], []]),
    getConnection: jest.fn(),
  },
}));

jest.mock("../src/modules/cart/cartRepository", () => ({
  __esModule: true,
  default: {
    readAll: jest.fn(async () => {
      throw new Error("colonne « secrete » inconnue dans la table users");
    }),
    create: jest.fn(),
    updateQuantity: jest.fn(),
    destroy: jest.fn(),
  },
}));

import app, { handleErrors } from "../src/app";
import { clientUser, sessionCookie } from "./helpers/session";

describe("gestionnaire d'erreurs final", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test("répond 500 avec un message neutre", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", sessionCookie(clientUser));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erreur serveur." });
  });

  test("ne divulgue ni la pile ni le message d'origine", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", sessionCookie(clientUser));

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("secrete");
    expect(body).not.toContain("at ");
    expect(res.text).not.toMatch(/Error:/);
  });

  test("journalise l'erreur côté serveur", async () => {
    await request(app)
      .get("/api/cart")
      .set("Cookie", sessionCookie(clientUser));

    expect(errorSpy).toHaveBeenCalled();
  });
});

/**
 * Quand la réponse est déjà partie (flux interrompu, en-têtes émis), on ne
 * peut plus rien écrire. Se contenter d'un `return` laissait la requête
 * pendante jusqu'au timeout : il faut rendre la main à Express, qui ferme
 * la connexion.
 */
describe("handleErrors — réponse déjà commencée", () => {
  const faireRes = (headersSent: boolean) => ({
    headersSent,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  test("passe l'erreur à Express si les en-têtes sont partis", () => {
    const res = faireRes(true);
    const next = jest.fn();
    const err = new Error("flux coupé");

    handleErrors(err, {} as never, res as never, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("répond 500 neutre tant que rien n'est envoyé", () => {
    const res = faireRes(false);
    const next = jest.fn();

    handleErrors(new Error("boum"), {} as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Erreur serveur." });
  });
});
