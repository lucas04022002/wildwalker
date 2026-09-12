/**
 * `GET /api/cart` annonce le montant que le serveur facturera.
 *
 * Le client recalculait `price_unit × quantity`, ce qui sous-facture un
 * « Local vide » loué au mois d'un facteur égal au nombre de mois. Le
 * montant d'une ligne est désormais calculé ici, par la même fonction que
 * celle du paiement (`amount.ts`), et le client se contente de l'afficher.
 */

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
    readAll: jest.fn(async () => []),
    create: jest.fn(),
    readLineForUpdate: jest.fn(),
    updateQuantity: jest.fn(),
    destroy: jest.fn(),
  },
}));

import request from "supertest";
import app from "../src/app";
import cartRepository from "../src/modules/cart/cartRepository";
import { clientUser, sessionCookie } from "./helpers/session";

const get = () =>
  request(app).get("/api/cart").set("Cookie", sessionCookie(clientUser));

describe("GET /api/cart — montants calculés par le serveur", () => {
  beforeEach(() => jest.clearAllMocks());

  test("chaque ligne porte son montant, et le panier son total", async () => {
    (cartRepository.readAll as jest.Mock).mockResolvedValue([
      {
        id: 1,
        quantity: 2,
        price_unit: "20.00",
        space_category: "Openspace",
        start_date: "2026-10-01",
        end_date: "2026-10-01",
      },
      {
        id: 2,
        quantity: 1,
        price_unit: "12.50",
        space_category: "Openspace",
        start_date: "2026-10-02",
        end_date: "2026-10-02",
      },
    ]);

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].line_amount).toBe(40);
    expect(res.body.items[1].line_amount).toBe(12.5);
    expect(res.body.total).toBe(52.5);
  });

  test("un « Local vide » de 6 mois vaut son prix mensuel × 6", async () => {
    (cartRepository.readAll as jest.Mock).mockResolvedValue([
      {
        id: 1,
        quantity: 1,
        price_unit: "450.00",
        space_category: "Local vide",
        start_date: "2026-01-10",
        end_date: "2026-07-10",
      },
    ]);

    const res = await get();

    expect(res.body.items[0].line_amount).toBe(2700);
    expect(res.body.total).toBe(2700);
  });

  test("le total de l'écran est celui que Stripe encaissera", async () => {
    const lignes = [
      {
        id: 1,
        quantity: 1,
        price_unit: "450.00",
        space_category: "Local vide",
        start_date: "2026-01-10",
        end_date: "2026-07-10",
      },
      {
        id: 2,
        quantity: 3,
        price_unit: "20.00",
        space_category: "Openspace",
        start_date: "2026-10-01",
        end_date: "2026-10-01",
      },
    ];
    (cartRepository.readAll as jest.Mock).mockResolvedValue(lignes);

    const res = await get();

    const { computeCartAmount } = await import("../src/modules/Payment/amount");

    expect(res.body.total).toBe(computeCartAmount(lignes) / 100);
  });

  test("un panier vide renvoie une liste vide et un total nul", async () => {
    (cartRepository.readAll as jest.Mock).mockResolvedValue([]);

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0 });
  });
});
