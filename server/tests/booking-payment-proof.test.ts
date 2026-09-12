/**
 * `POST /api/booking` exige une PREUVE de paiement.
 *
 * Avant : la route transformait le panier en réservations sur la seule foi
 * du navigateur. Un `curl` avec un cookie de session valide suffisait donc à
 * réserver sans jamais payer — la route ne savait rien de Stripe.
 *
 * Désormais le serveur demande l'intention de paiement à Stripe et la
 * confronte au panier : statut `succeeded`, montant exact, et même
 * utilisateur (via `metadata.userId`, posé à la création de l'intention).
 */

const retrieve = jest.fn();
const create = jest.fn(async () => ({
  client_secret: "cs_test_123",
  id: "pi_test_123",
}));

jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    paymentIntents: { retrieve, create },
  })),
}));

const query = jest.fn(async () => [[], []]);

jest.mock("../database/client", () => ({
  __esModule: true,
  default: { query, getConnection: jest.fn() },
}));

jest.mock("../src/modules/bookingActions/bookingRepository", () => ({
  __esModule: true,
  default: { createFromCart: jest.fn(async () => 2) },
  CapacityExceededError: class extends Error {},
}));

import request from "supertest";
import app from "../src/app";
import bookingRepository from "../src/modules/bookingActions/bookingRepository";
import { clientUser, sessionCookie } from "./helpers/session";

/** Panier à 52,50 € = 5250 centimes. */
const PANIER = [
  {
    quantity: 2,
    price_unit: "20.00",
    space_category: "Openspace",
    start_date: "2026-10-01",
    end_date: "2026-10-01",
  },
  {
    quantity: 1,
    price_unit: "12.50",
    space_category: "Openspace",
    start_date: "2026-10-02",
    end_date: "2026-10-02",
  },
];
const MONTANT = 5250;

const intention = (over: Record<string, unknown> = {}) => ({
  id: "pi_test_123",
  status: "succeeded",
  amount: MONTANT,
  currency: "eur",
  metadata: { userId: String(clientUser.id) },
  ...over,
});

const reserver = (body: unknown) =>
  request(app)
    .post("/api/booking")
    .set("Cookie", sessionCookie(clientUser))
    .send(body as object);

/** Le panier est lu en base : c'est le pool mocké qui le rend. */
const panierEnBase = (rows: unknown[]) =>
  // biome-ignore lint/suspicious/noExplicitAny: forme de retour de mysql2
  query.mockResolvedValue([rows, []] as any);

describe("POST /api/booking — preuve de paiement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    panierEnBase(PANIER);
    retrieve.mockResolvedValue(intention());
    (bookingRepository.createFromCart as jest.Mock).mockResolvedValue(2);
  });

  test("un paiement confirmé au bon montant crée les réservations", async () => {
    const res = await reserver({ paymentIntentId: "pi_test_123" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 2 });
    expect(retrieve).toHaveBeenCalledWith("pi_test_123");
    expect(bookingRepository.createFromCart).toHaveBeenCalledWith(
      clientUser.id,
    );
  });

  test("un montant qui ne correspond pas au panier : 402, aucune réservation", async () => {
    retrieve.mockResolvedValue(intention({ amount: 100 }));

    const res = await reserver({ paymentIntentId: "pi_test_123" });

    expect(res.status).toBe(402);
    expect(res.body.message).toBe("Paiement non confirmé");
    expect(bookingRepository.createFromCart).not.toHaveBeenCalled();
  });

  test("une intention non aboutie : 402, aucune réservation", async () => {
    retrieve.mockResolvedValue(
      intention({ status: "requires_payment_method" }),
    );

    const res = await reserver({ paymentIntentId: "pi_test_123" });

    expect(res.status).toBe(402);
    expect(bookingRepository.createFromCart).not.toHaveBeenCalled();
  });

  test("l'intention d'un autre utilisateur : 402, aucune réservation", async () => {
    retrieve.mockResolvedValue(intention({ metadata: { userId: "999" } }));

    const res = await reserver({ paymentIntentId: "pi_test_123" });

    expect(res.status).toBe(402);
    expect(bookingRepository.createFromCart).not.toHaveBeenCalled();
  });

  test("une référence inconnue de Stripe : 402, aucune réservation", async () => {
    retrieve.mockRejectedValue(new Error("No such payment_intent"));

    const res = await reserver({ paymentIntentId: "pi_inexistant" });

    expect(res.status).toBe(402);
    expect(bookingRepository.createFromCart).not.toHaveBeenCalled();
  });

  test("sans référence de paiement : 400, et Stripe n'est même pas appelé", async () => {
    const res = await reserver({});

    expect(res.status).toBe(400);
    expect(retrieve).not.toHaveBeenCalled();
    expect(bookingRepository.createFromCart).not.toHaveBeenCalled();
  });

  test("une référence vide ou non textuelle est refusée (400)", async () => {
    expect((await reserver({ paymentIntentId: "" })).status).toBe(400);
    expect((await reserver({ paymentIntentId: 42 })).status).toBe(400);
    expect((await reserver({ paymentIntentId: null })).status).toBe(400);
    expect(bookingRepository.createFromCart).not.toHaveBeenCalled();
  });

  test("un panier vide est refusé avant même d'interroger Stripe (400)", async () => {
    panierEnBase([]);

    const res = await reserver({ paymentIntentId: "pi_test_123" });

    expect(res.status).toBe(400);
    expect(retrieve).not.toHaveBeenCalled();
    expect(bookingRepository.createFromCart).not.toHaveBeenCalled();
  });

  test("sans session, la route reste fermée (401)", async () => {
    const res = await request(app)
      .post("/api/booking")
      .send({ paymentIntentId: "pi_test_123" });

    expect(res.status).toBe(401);
    expect(bookingRepository.createFromCart).not.toHaveBeenCalled();
  });

  test("une intention sans metadata reste acceptée si statut et montant collent", async () => {
    // Intentions créées avant l'ajout de `metadata.userId` : le montant et
    // le statut suffisent, on ne rejette pas ce qu'on ne peut pas vérifier.
    retrieve.mockResolvedValue(intention({ metadata: {} }));

    const res = await reserver({ paymentIntentId: "pi_test_123" });

    expect(res.status).toBe(201);
  });
});

describe("POST /api/payment/create-intent — l'intention porte son client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    panierEnBase(PANIER);
  });

  test("`metadata.userId` est posé à la création", async () => {
    const res = await request(app)
      .post("/api/payment/create-intent")
      .set("Cookie", sessionCookie(clientUser));

    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: MONTANT,
        currency: "eur",
        metadata: { userId: String(clientUser.id) },
      }),
    );
  });
});
