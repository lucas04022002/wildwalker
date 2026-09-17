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
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
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

import { resetLoginLimiter } from "../src/Middlewares/rateLimit";
import app from "../src/app";
import { REGISTER_ACCEPTED } from "../src/modules/Authentification/AuthentificationAction";
import authRepository from "../src/modules/Authentification/AuthentificationRepository";

const ROUTE = "/api/auth/register";

/** Un corps valide, que chaque test dégrade sur un seul champ. */
const corpsValide = {
  firstname: "Camille",
  lastname: "Perrin",
  email: "camille.perrin@exemple.fr",
  password: "un-mot-de-passe-correct",
  phone_number: "0612345678",
};

const envoyer = (corps: Record<string, unknown>) =>
  request(app).post(ROUTE).set("Origin", "http://localhost:3000").send(corps);

beforeEach(() => {
  jest.clearAllMocks();
  resetLoginLimiter();
  (authRepository.findByEmail as jest.Mock).mockResolvedValue(null);
  (authRepository.findByPhone as jest.Mock).mockResolvedValue(null);
  (authRepository.create as jest.Mock).mockResolvedValue({
    id: 1,
    email: corpsValide.email,
    role: "client",
  });
});

describe("validation du corps", () => {
  test("un corps valide passe", async () => {
    const res = await envoyer(corpsValide);

    expect(res.status).toBe(201);
    expect(authRepository.create).toHaveBeenCalled();
  });

  test("refuse un mot de passe trop court, et le dit", async () => {
    const res = await envoyer({ ...corpsValide, password: "court" });

    expect(res.status).toBe(400);
    expect(res.body.errors.join(" ")).toContain("10");
    expect(authRepository.create).not.toHaveBeenCalled();
  });

  test("refuse un mot de passe démesuré (argon2 ne doit pas le hacher)", async () => {
    const res = await envoyer({ ...corpsValide, password: "a".repeat(5000) });

    expect(res.status).toBe(400);
    expect(authRepository.create).not.toHaveBeenCalled();
  });

  test("refuse une adresse e-mail qui n'en est pas une", async () => {
    const res = await envoyer({ ...corpsValide, email: "abc" });

    expect(res.status).toBe(400);
    expect(authRepository.create).not.toHaveBeenCalled();
  });

  test("refuse un numéro de téléphone qui n'en est pas un", async () => {
    const res = await envoyer({ ...corpsValide, phone_number: "bonjour" });

    expect(res.status).toBe(400);
    expect(authRepository.create).not.toHaveBeenCalled();
  });

  test("normalise l'adresse en minuscules avant de l'enregistrer", async () => {
    await envoyer({ ...corpsValide, email: "  Camille.PERRIN@Exemple.FR " });

    expect(authRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "camille.perrin@exemple.fr" }),
    );
  });

  test("ignore un rôle envoyé dans le corps", async () => {
    await envoyer({ ...corpsValide, role: "admin" });

    const argument = (authRepository.create as jest.Mock).mock.calls[0][0];
    expect(argument.role).toBeUndefined();
  });
});

describe("doublons : même réponse, quelle que soit la colonne", () => {
  test("adresse déjà prise : 201 neutre, aucune création", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue({ id: 7 });

    const res = await envoyer(corpsValide);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe(REGISTER_ACCEPTED);
    expect(authRepository.create).not.toHaveBeenCalled();
  });

  test("téléphone déjà pris : 201 neutre, plus jamais 500", async () => {
    (authRepository.findByPhone as jest.Mock).mockResolvedValue({ id: 7 });

    const res = await envoyer(corpsValide);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe(REGISTER_ACCEPTED);
    expect(authRepository.create).not.toHaveBeenCalled();
  });

  test("la réponse est identique dans les deux cas : rien à énumérer", async () => {
    (authRepository.findByEmail as jest.Mock).mockResolvedValue({ id: 7 });
    const parEmail = await envoyer(corpsValide);

    jest.clearAllMocks();
    (authRepository.findByEmail as jest.Mock).mockResolvedValue(null);
    (authRepository.findByPhone as jest.Mock).mockResolvedValue({ id: 8 });
    const parTelephone = await envoyer(corpsValide);

    expect(parTelephone.status).toBe(parEmail.status);
    expect(parTelephone.body).toEqual(parEmail.body);
  });

  test("course perdue à l'insertion : le doublon base reste un 201 neutre", async () => {
    (authRepository.create as jest.Mock).mockRejectedValue(
      Object.assign(new Error("Duplicate entry"), {
        code: "ER_DUP_ENTRY",
        errno: 1062,
      }),
    );

    const res = await envoyer(corpsValide);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe(REGISTER_ACCEPTED);
  });

  test("une vraie panne base reste une erreur, elle n'est pas masquée", async () => {
    (authRepository.create as jest.Mock).mockRejectedValue(
      new Error("connexion perdue"),
    );

    const res = await envoyer(corpsValide);

    expect(res.status).toBe(500);
  });
});
