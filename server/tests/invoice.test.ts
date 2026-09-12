/**
 * `GET /api/invoice/:bookingId`.
 *
 * La requête filtre déjà sur `users_id` : une facture qui n'est pas la
 * vôtre ne remonte pas. Mais l'action renvoyait alors `undefined` avec un
 * 200, et le client affichait une facture vide au lieu d'une erreur.
 */

jest.mock("../database/client", () => ({
  __esModule: true,
  default: {
    query: jest.fn(async () => [[], []]),
    getConnection: jest.fn(),
  },
}));

jest.mock("../src/modules/dashboardClient/dashboardClientRepository", () => ({
  __esModule: true,
  default: { readInvoiceById: jest.fn() },
}));

import request from "supertest";
import app from "../src/app";
import dashboardClientRepository from "../src/modules/dashboardClient/dashboardClientRepository";
import { clientUser, sessionCookie } from "./helpers/session";

const lire = (id: number | string) =>
  request(app)
    .get(`/api/invoice/${id}`)
    .set("Cookie", sessionCookie(clientUser));

describe("GET /api/invoice/:bookingId", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renvoie la facture de l'utilisateur", async () => {
    (dashboardClientRepository.readInvoiceById as jest.Mock).mockResolvedValue({
      id: 12,
      bills_number: "2026-3",
      total_price: 40,
    });

    const res = await lire(12);

    expect(res.status).toBe(200);
    expect(res.body.bills_number).toBe("2026-3");
    expect(dashboardClientRepository.readInvoiceById).toHaveBeenCalledWith(
      12,
      clientUser.id,
    );
  });

  test("une facture introuvable répond 404, pas 200 avec un corps vide", async () => {
    (dashboardClientRepository.readInvoiceById as jest.Mock).mockResolvedValue(
      undefined,
    );

    const res = await lire(4242);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Facture introuvable." });
  });

  test("la facture d'un autre utilisateur est un 404, pas une fuite", async () => {
    // Le dépôt filtre sur `users_id` : rien ne remonte, et la réponse est
    // la même que pour une facture inexistante.
    (dashboardClientRepository.readInvoiceById as jest.Mock).mockResolvedValue(
      undefined,
    );

    const res = await lire(1);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/users_id|bills_number/);
  });

  test("sans session, la route est fermée (401)", async () => {
    const res = await request(app).get("/api/invoice/12");

    expect(res.status).toBe(401);
    expect(dashboardClientRepository.readInvoiceById).not.toHaveBeenCalled();
  });
});
