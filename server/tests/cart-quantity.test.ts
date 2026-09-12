/**
 * `PATCH /api/cart/:id` : la quantité est la SEULE chose modifiable, et elle
 * doit être un entier strictement positif. Le total, lui, n'a jamais été
 * négociable — il est recalculé en base à partir du prix unitaire.
 *
 * La capacité est également revérifiée sous verrou : un panier constitué
 * quand il restait de la place peut être gonflé plus tard, une fois la salle
 * pleine. Le contrôle d'ajout ne suffit donc pas.
 */

const connection = {
  query: jest.fn(async () => [{ insertId: 1, affectedRows: 1 }, []]),
  beginTransaction: jest.fn(async () => undefined),
  commit: jest.fn(async () => undefined),
  rollback: jest.fn(async () => undefined),
  release: jest.fn(() => undefined),
};

jest.mock("../database/client", () => ({
  __esModule: true,
  default: {
    query: jest.fn(async () => [[], []]),
    getConnection: jest.fn(async () => connection),
  },
}));

jest.mock("../src/modules/cart/cartRepository", () => ({
  __esModule: true,
  default: {
    readAll: jest.fn(async () => []),
    create: jest.fn(async () => 11),
    readLineForUpdate: jest.fn(async () => null),
    updateQuantity: jest.fn(async () => 1),
    destroy: jest.fn(async () => 1),
  },
}));

jest.mock("../src/modules/space/spaceRepository", () => ({
  __esModule: true,
  default: {
    readForUpdate: jest.fn(async () => ({
      id: 3,
      space_name: "Le Studio",
      capacity: 20,
      price_unit: 20,
      space_type: "Coworking",
      space_category: "Openspace",
      url_image: "/x.png",
      description: "",
    })),
    countBookedSeats: jest.fn(async () => 4),
  },
}));

import request from "supertest";
import app from "../src/app";
import cartRepository from "../src/modules/cart/cartRepository";
import spaceRepository from "../src/modules/space/spaceRepository";
import { clientUser, sessionCookie } from "./helpers/session";

/** Ligne de panier telle que `readLineForUpdate` la renvoie. */
const ligne = (over: Record<string, unknown> = {}) => ({
  id: 5,
  quantity: 2,
  id_activity: 10,
  price_unit: "20.00",
  start_date: "2026-10-01",
  end_date: "2026-10-01",
  space_id: 3,
  time_slot_id: 1,
  space_category: "Openspace",
  capacity: 20,
  ...over,
});

const patch = (body: unknown) =>
  request(app)
    .patch("/api/cart/5")
    .set("Cookie", sessionCookie(clientUser))
    .send(body as object);

describe("PATCH /api/cart/:id — validation de la quantité", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cartRepository.readLineForUpdate as jest.Mock).mockResolvedValue(ligne());
    (cartRepository.updateQuantity as jest.Mock).mockResolvedValue(1);
    (spaceRepository.countBookedSeats as jest.Mock).mockResolvedValue(4);
    (spaceRepository.readForUpdate as jest.Mock).mockResolvedValue({
      id: 3,
      capacity: 20,
      space_category: "Openspace",
    });
  });

  test("un corps qui ne porte que total_price est refusé (400)", async () => {
    const res = await patch({ total_price: 0 });

    expect(res.status).toBe(400);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
  });

  test("total_price ne peut plus rien changer, même accompagné d'une quantité", async () => {
    const res = await patch({ quantity: 3, total_price: 0 });

    expect(res.status).toBe(204);
    // `stripUnknown` l'a retiré : il n'atteint jamais le dépôt.
    expect(cartRepository.updateQuantity).toHaveBeenCalledWith(
      connection,
      5,
      clientUser.id,
      3,
      expect.any(Number),
    );
  });

  test("quantity: 0 est refusé (400)", async () => {
    const res = await patch({ quantity: 0 });

    expect(res.status).toBe(400);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
  });

  test("une quantité négative est refusée (400)", async () => {
    const res = await patch({ quantity: -3 });

    expect(res.status).toBe(400);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
  });

  test("une quantité décimale est refusée (400)", async () => {
    const res = await patch({ quantity: 1.5 });

    expect(res.status).toBe(400);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
  });

  test("une quantité textuelle non numérique est refusée (400)", async () => {
    const res = await patch({ quantity: "beaucoup" });

    expect(res.status).toBe(400);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
  });

  test("un corps vide est refusé (400)", async () => {
    const res = await patch({});

    expect(res.status).toBe(400);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/cart/:id — capacité revérifiée", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cartRepository.readLineForUpdate as jest.Mock).mockResolvedValue(ligne());
    (cartRepository.updateQuantity as jest.Mock).mockResolvedValue(1);
    (spaceRepository.readForUpdate as jest.Mock).mockResolvedValue({
      id: 3,
      capacity: 20,
      space_category: "Openspace",
    });
    (spaceRepository.countBookedSeats as jest.Mock).mockResolvedValue(4);
  });

  test("999 places sur un espace de 20 sont refusées (409)", async () => {
    const res = await patch({ quantity: 999 });

    expect(res.status).toBe(409);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });

  test("la ligne modifiée ne se compte pas elle-même deux fois", async () => {
    // 4 places réservées dont les 2 de cette ligne : il en reste 18.
    (spaceRepository.countBookedSeats as jest.Mock).mockResolvedValue(4);

    const res = await patch({ quantity: 18 });

    expect(res.status).toBe(204);
    expect(cartRepository.updateQuantity).toHaveBeenCalled();
  });

  test("une place de trop est refusée (409)", async () => {
    const res = await patch({ quantity: 19 });

    expect(res.status).toBe(409);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
  });

  test("l'espace est relu sous verrou dans la transaction", async () => {
    await patch({ quantity: 3 });

    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(spaceRepository.readForUpdate).toHaveBeenCalledWith(connection, 3);
    expect(connection.commit).toHaveBeenCalled();
  });

  test("une ligne qui n'est pas la sienne reste un 404", async () => {
    (cartRepository.readLineForUpdate as jest.Mock).mockResolvedValue(null);

    const res = await patch({ quantity: 2 });

    expect(res.status).toBe(404);
    expect(cartRepository.updateQuantity).not.toHaveBeenCalled();
  });

  test("le total suit la quantité : il est recalculé depuis le prix unitaire", async () => {
    await patch({ quantity: 3 });

    // 20 € l'unité × 3 = 60 €, calculé par le serveur.
    expect(cartRepository.updateQuantity).toHaveBeenCalledWith(
      connection,
      5,
      clientUser.id,
      3,
      60,
    );
  });

  test("un « Local vide » est facturé au mois, pas au créneau", async () => {
    (cartRepository.readLineForUpdate as jest.Mock).mockResolvedValue(
      ligne({
        space_category: "Local vide",
        price_unit: "450.00",
        start_date: "2026-01-10",
        end_date: "2026-07-10",
      }),
    );
    (spaceRepository.readForUpdate as jest.Mock).mockResolvedValue({
      id: 3,
      capacity: 20,
      space_category: "Local vide",
    });

    await patch({ quantity: 1 });

    // 450 € × 6 mois.
    expect(cartRepository.updateQuantity).toHaveBeenCalledWith(
      connection,
      5,
      clientUser.id,
      1,
      2700,
    );
  });
});
