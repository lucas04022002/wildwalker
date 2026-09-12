/**
 * `POST /api/dashboard/client/event-requests`.
 *
 * Le corps arrive en multipart (il porte une image) : tout y est du texte.
 * `Number(req.body.price_unit) ?? 0` ne rattrapait rien — `Number("abc")`
 * vaut `NaN`, qui n'est pas `null`, et le `NaN` partait en base. Un schéma
 * Joi, comme pour le panier, refuse le corps avant d'atteindre le dépôt.
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
  default: {
    createEventRequest: jest.fn(async () => 42),
  },
}));

jest.mock("../src/modules/createEventForm/createEventFormRepository", () => ({
  __esModule: true,
  default: {
    isEventSlotTaken: jest.fn(async () => false),
  },
}));

import request from "supertest";
import app from "../src/app";
import dashboardClientRepository from "../src/modules/dashboardClient/dashboardClientRepository";
import { clientUser, sessionCookie } from "./helpers/session";

const valide = {
  name: "Atelier poterie",
  description: "Deux heures de tour",
  start_date: "2026-10-01",
  end_date: "2026-10-01",
  space_id: "3",
  time_slot_id: "1",
  price_unit: "25",
};

const post = (body: Record<string, unknown>) =>
  request(app)
    .post("/api/dashboard/client/event-requests")
    .set("Cookie", sessionCookie(clientUser))
    .field(
      Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
    );

describe("POST /api/dashboard/client/event-requests — corps validé", () => {
  beforeEach(() => jest.clearAllMocks());

  test("une demande complète passe", async () => {
    const res = await post(valide);

    expect(res.status).toBe(201);
    expect(dashboardClientRepository.createEventRequest).toHaveBeenCalledWith(
      expect.objectContaining({ price_unit: 25, users_id: clientUser.id }),
    );
  });

  test("un prix gratuit (0) est accepté", async () => {
    const res = await post({ ...valide, price_unit: "0" });

    expect(res.status).toBe(201);
    expect(dashboardClientRepository.createEventRequest).toHaveBeenCalledWith(
      expect.objectContaining({ price_unit: 0 }),
    );
  });

  test("un prix non numérique est refusé (400)", async () => {
    const res = await post({ ...valide, price_unit: "gratuit" });

    expect(res.status).toBe(400);
    expect(dashboardClientRepository.createEventRequest).not.toHaveBeenCalled();
  });

  test("un prix négatif est refusé (400)", async () => {
    const res = await post({ ...valide, price_unit: "-10" });

    expect(res.status).toBe(400);
    expect(dashboardClientRepository.createEventRequest).not.toHaveBeenCalled();
  });

  test("un prix infini est refusé (400)", async () => {
    const res = await post({ ...valide, price_unit: "Infinity" });

    expect(res.status).toBe(400);
    expect(dashboardClientRepository.createEventRequest).not.toHaveBeenCalled();
  });

  test("un espace manquant est refusé (400)", async () => {
    const { space_id, ...sansEspace } = valide;

    const res = await post(sansEspace);

    expect(res.status).toBe(400);
    expect(dashboardClientRepository.createEventRequest).not.toHaveBeenCalled();
  });

  test("une date au mauvais format est refusée (400)", async () => {
    const res = await post({ ...valide, start_date: "01/10/2026" });

    expect(res.status).toBe(400);
    expect(dashboardClientRepository.createEventRequest).not.toHaveBeenCalled();
  });
});
