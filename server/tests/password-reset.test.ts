import request from "supertest";

jest.mock("../database/client", () => ({
  __esModule: true,
  default: { query: jest.fn(async () => [[], []]), getConnection: jest.fn() },
}));

jest.mock("../src/modules/Authentification/AuthentificationRepository", () => ({
  __esModule: true,
  default: {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updatePassword: jest.fn(async () => undefined),
  },
}));

jest.mock("../src/modules/Authentification/PasswordResetRepository", () => ({
  __esModule: true,
  default: {
    ouvrir: jest.fn(async () => "a".repeat(64)),
    lire: jest.fn(async () => ({ users_id: 7 })),
    consommer: jest.fn(async () => true),
    purgerExpirees: jest.fn(async () => undefined),
    empreinte: jest.fn((j: string) => j),
  },
}));

jest.mock("../src/modules/mail/mailer", () => ({
  __esModule: true,
  default: {
    envoyer: jest.fn(async () => undefined),
    estConfiguree: jest.fn(() => true),
  },
}));

jest.mock("argon2", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async () => "$argon2id$factice"),
    verify: jest.fn(),
  },
}));

import { resetLoginLimiter } from "../src/Middlewares/rateLimit";
import app from "../src/app";
import authRepository from "../src/modules/Authentification/AuthentificationRepository";
import { DEMANDE_ACCEPTEE } from "../src/modules/Authentification/PasswordResetAction";
import resetRepository from "../src/modules/Authentification/PasswordResetRepository";
import mailer from "../src/modules/mail/mailer";

const JETON = "a".repeat(64);
const ORIGINE = "http://localhost:3000";

const demander = (corps: Record<string, unknown>) =>
  request(app)
    .post("/api/auth/forgot-password")
    .set("Origin", ORIGINE)
    .send(corps);

const reinitialiser = (corps: Record<string, unknown>) =>
  request(app)
    .post("/api/auth/reset-password")
    .set("Origin", ORIGINE)
    .send(corps);

beforeEach(() => {
  jest.clearAllMocks();
  resetLoginLimiter();
  (mailer.estConfiguree as jest.Mock).mockReturnValue(true);
  (mailer.envoyer as jest.Mock).mockResolvedValue(undefined);
  (resetRepository.ouvrir as jest.Mock).mockResolvedValue(JETON);
  (resetRepository.lire as jest.Mock).mockResolvedValue({ users_id: 7 });
  (resetRepository.consommer as jest.Mock).mockResolvedValue(true);
  (authRepository.findByEmail as jest.Mock).mockResolvedValue({
    id: 7,
    email: "lucie@exemple.fr",
  });
});

describe("demande de réinitialisation", () => {
  test("adresse connue : un message part, réponse neutre", async () => {
    const res = await demander({ email: "lucie@exemple.fr" });

    expect(res.status).toBe(202);
    expect(res.body.message).toBe(DEMANDE_ACCEPTEE);
    expect(mailer.envoyer).toHaveBeenCalled();
  });

  test("adresse inconnue : exactement la même réponse, aucun envoi", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(null);

    const res = await demander({ email: "personne@exemple.fr" });

    expect(res.status).toBe(202);
    expect(res.body.message).toBe(DEMANDE_ACCEPTEE);
    expect(mailer.envoyer).not.toHaveBeenCalled();
  });

  test("un envoi raté ne se voit pas dans la réponse", async () => {
    (mailer.envoyer as jest.Mock).mockRejectedValue(new Error("SMTP mort"));

    const res = await demander({ email: "lucie@exemple.fr" });

    expect(res.status).toBe(202);
    expect(res.body.message).toBe(DEMANDE_ACCEPTEE);
  });

  test("le jeton en clair ne sort jamais dans la réponse", async () => {
    const res = await demander({ email: "lucie@exemple.fr" });

    expect(JSON.stringify(res.body)).not.toContain(JETON);
  });

  test("le lien envoyé porte le jeton et pointe vers le client", async () => {
    await demander({ email: "lucie@exemple.fr" });

    const message = (mailer.envoyer as jest.Mock).mock.calls[0][0];
    expect(message.to).toBe("lucie@exemple.fr");
    expect(message.text).toContain(JETON);
    expect(message.text).toContain(ORIGINE);
  });

  test("sans messagerie configurée : 503, pas une promesse creuse", async () => {
    (mailer.estConfiguree as jest.Mock).mockReturnValue(false);

    const res = await demander({ email: "lucie@exemple.fr" });

    expect(res.status).toBe(503);
    expect(resetRepository.ouvrir).not.toHaveBeenCalled();
  });

  test("adresse mal formée : 400", async () => {
    const res = await demander({ email: "abc" });

    expect(res.status).toBe(400);
  });

  test("quatre demandes sur la même adresse : la quatrième est refusée", async () => {
    for (let i = 0; i < 3; i += 1)
      await demander({ email: "lucie@exemple.fr" });

    const res = await demander({ email: "lucie@exemple.fr" });

    expect(res.status).toBe(429);
  });
});

describe("choix du nouveau mot de passe", () => {
  test("jeton valide : le mot de passe change", async () => {
    const res = await reinitialiser({
      jeton: JETON,
      password: "un-nouveau-mot-de-passe",
    });

    expect(res.status).toBe(200);
    expect(authRepository.updatePassword).toHaveBeenCalledWith(
      7,
      "$argon2id$factice",
    );
  });

  test("le jeton est consommé AVANT le changement", async () => {
    const ordre: string[] = [];
    (resetRepository.consommer as jest.Mock).mockImplementation(async () => {
      ordre.push("consomme");
      return true;
    });
    (authRepository.updatePassword as jest.Mock).mockImplementation(
      async () => {
        ordre.push("change");
      },
    );

    await reinitialiser({ jeton: JETON, password: "un-nouveau-mot-de-passe" });

    expect(ordre).toEqual(["consomme", "change"]);
  });

  test("jeton inconnu ou expiré : 400, aucun changement", async () => {
    (resetRepository.lire as jest.Mock).mockResolvedValue(null);

    const res = await reinitialiser({
      jeton: JETON,
      password: "un-nouveau-mot-de-passe",
    });

    expect(res.status).toBe(400);
    expect(authRepository.updatePassword).not.toHaveBeenCalled();
  });

  test("course perdue : lu valide mais consommé entre-temps, aucun changement", async () => {
    (resetRepository.consommer as jest.Mock).mockResolvedValue(false);

    const res = await reinitialiser({
      jeton: JETON,
      password: "un-nouveau-mot-de-passe",
    });

    expect(res.status).toBe(400);
    expect(authRepository.updatePassword).not.toHaveBeenCalled();
  });

  test("mot de passe trop court : refusé, comme à l'inscription", async () => {
    const res = await reinitialiser({ jeton: JETON, password: "court" });

    expect(res.status).toBe(400);
    expect(resetRepository.lire).not.toHaveBeenCalled();
  });

  test("jeton qui n'a pas la forme d'un jeton : refusé sans toucher la base", async () => {
    const res = await reinitialiser({
      jeton: "pas-un-jeton",
      password: "un-nouveau-mot-de-passe",
    });

    expect(res.status).toBe(400);
    expect(resetRepository.lire).not.toHaveBeenCalled();
  });
});
