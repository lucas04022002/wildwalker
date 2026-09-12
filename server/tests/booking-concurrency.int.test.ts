/**
 * Concurrence réelle, contre un vrai MySQL.
 *
 * Deux scénarios que seul un vrai moteur peut trancher — un pool mocké ne
 * sait rien des verrous de ligne :
 *
 *   1. deux `POST /api/booking` simultanés sur un même panier payé : UN SEUL
 *      jeu de réservations doit exister à l'arrivée. Sans le `FOR UPDATE`
 *      de `readCartForUpdate`, les deux transactions lisent le même panier
 *      et facturent deux fois ;
 *   2. deux `POST /api/bookings` simultanés sur le MÊME créneau exclusif :
 *      un 201 et un refus. Sans le verrou `FOR UPDATE` sur `space`, les deux
 *      voient le créneau libre.
 *
 * Stripe est mocké ici (`jest.mock("stripe")`) : la clé de la CI est
 * factice, un vrai `paymentIntents.retrieve` échouerait. Le mock rend une
 * intention `succeeded` dont le montant est celui que le serveur vient de
 * calculer — c'est bien le chemin de vérification complet qui est exercé,
 * seule la réponse du réseau Stripe est simulée.
 */

import path from "node:path";

import type { Pool, RowDataPacket } from "mysql2/promise";
import request from "supertest";

import { createMigrationPool, runMigrations } from "../bin/migrate";
import { runSeed } from "../bin/seed";

/** Intention mockée : son montant est celui que le serveur a calculé. */
const stripeState = { amount: 0, status: "succeeded", userId: "" };

jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    paymentIntents: {
      create: jest.fn(
        async ({
          amount,
          metadata,
        }: { amount: number; metadata?: Record<string, string> }) => {
          stripeState.amount = amount;
          stripeState.userId = String(metadata?.userId ?? "");
          return { id: "pi_int_test", client_secret: "cs_int_test" };
        },
      ),
      retrieve: jest.fn(async (id: string) => ({
        id,
        status: stripeState.status,
        amount: stripeState.amount,
        currency: "eur",
        metadata: { userId: stripeState.userId },
      })),
    },
  })),
}));

const hasDatabase = (process.env.DB_HOST ?? "") !== "";
const describeWithDatabase = hasDatabase ? describe : describe.skip;

// Un client DIFFÉRENT de celui de booking.int.test.ts : les deux suites
// vident le panier de leur utilisateur, elles ne doivent pas se marcher
// dessus si jest les exécute en parallèle. Tous les clients du seed
// partagent le même mot de passe de démonstration.
const DEMO_CLIENT_EMAIL = "victoire.marchal722@free.fr";
const DEMO_CLIENT_PASSWORD = "demo-client-2026";

// « La Rotonde » : salle de réunion, donc un seul occupant par créneau.
const EXCLUSIVE_SPACE_ID = 5;
const MORNING_SLOT_ID = 1;
// Dates propres à CETTE suite : elle ne marche pas sur booking.int.test.ts.
const PAID_DATE = "2031-05-20";
const RACE_DATE = "2031-05-21";

describeWithDatabase("concurrence sur les réservations", () => {
  let pool: Pool;
  // biome-ignore lint/suspicious/noExplicitAny: l'app est importée après la config
  let app: any;
  let sessionCookie: string;
  let userId: number;

  /** Efface tout ce que cette suite a pu laisser, panier compris. */
  const nettoyer = async (date: string) => {
    await pool.query(
      `DELETE c FROM cart c
         JOIN activity a ON a.id = c.id_activity
        WHERE a.space_id = ? AND a.start_date = ?`,
      [EXCLUSIVE_SPACE_ID, date],
    );
    await pool.query(
      `DELETE b FROM booking b
         JOIN activity a ON a.id = b.id_activity
        WHERE a.space_id = ? AND a.start_date = ?`,
      [EXCLUSIVE_SPACE_ID, date],
    );
    await pool.query(
      "DELETE FROM activity WHERE space_id = ? AND start_date = ?",
      [EXCLUSIVE_SPACE_ID, date],
    );
  };

  const compterBookings = async (date: string): Promise<number> => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
         FROM booking b
         JOIN activity a ON a.id = b.id_activity
        WHERE a.space_id = ? AND a.start_date = ?`,
      [EXCLUSIVE_SPACE_ID, date],
    );
    return Number(rows[0].total);
  };

  const ajouterAuPanier = (date: string) =>
    request(app).post("/api/bookings").set("Cookie", sessionCookie).send({
      space_id: EXCLUSIVE_SPACE_ID,
      time_slot_id: MORNING_SLOT_ID,
      start_date: date,
      end_date: date,
      seats: null,
      months: null,
    });

  beforeAll(async () => {
    pool = createMigrationPool();

    await runMigrations(
      pool,
      path.join(__dirname, "..", "database", "migrations"),
    );

    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM users",
    );
    if (Number(users[0].total) === 0) {
      await runSeed(pool, path.join(__dirname, "..", "database", "seed.sql"));
    }

    await nettoyer(PAID_DATE);
    await nettoyer(RACE_DATE);

    app = (await import("../src/app")).default;

    const login = await request(app)
      .post("/api/auth/login/client")
      .send({ email: DEMO_CLIENT_EMAIL, password: DEMO_CLIENT_PASSWORD });

    expect(login.status).toBe(200);
    const cookies = login.headers["set-cookie"] as unknown as string[];
    sessionCookie = cookies[0].split(";")[0];

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [DEMO_CLIENT_EMAIL],
    );
    userId = Number(rows[0].id);
  }, 90_000);

  afterAll(async () => {
    await nettoyer(PAID_DATE);
    await nettoyer(RACE_DATE);
    await pool.end();
    const database = (await import("../database/client")).default;
    await database.end();
  });

  beforeEach(async () => {
    // Un panier propre avant chaque scénario.
    await pool.query("DELETE FROM cart WHERE users_id = ?", [userId]);
  });

  test("deux POST /api/booking simultanés ne créent qu'un jeu de réservations", async () => {
    await nettoyer(PAID_DATE);

    const ajout = await ajouterAuPanier(PAID_DATE);
    expect(ajout.status).toBe(201);

    // L'intention retient le montant calculé par le serveur : l'intention
    // relue portera exactement celui-là.
    stripeState.status = "succeeded";
    const intent = await request(app)
      .post("/api/payment/create-intent")
      .set("Cookie", sessionCookie);
    expect(intent.status).toBe(200);
    expect(stripeState.amount).toBeGreaterThan(0);

    const [a, b] = await Promise.all([
      request(app)
        .post("/api/booking")
        .set("Cookie", sessionCookie)
        .send({ paymentIntentId: "pi_int_test" }),
      request(app)
        .post("/api/booking")
        .set("Cookie", sessionCookie)
        .send({ paymentIntentId: "pi_int_test" }),
    ]);

    const statuts = [a.status, b.status];

    // Un seul 201 ; l'autre trouve le panier déjà vidé (400) ou la place
    // déjà prise (409). Jamais deux jeux de réservations.
    expect(statuts.filter((s) => s === 201)).toHaveLength(1);
    expect(statuts.some((s) => s === 400 || s === 409)).toBe(true);

    expect(await compterBookings(PAID_DATE)).toBe(1);

    const [restant] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM cart WHERE users_id = ?",
      [userId],
    );
    expect(Number(restant[0].total)).toBe(0);
  }, 60_000);

  test("deux POST /api/bookings simultanés sur le même créneau : un seul passe", async () => {
    await nettoyer(RACE_DATE);

    const [a, b] = await Promise.all([
      ajouterAuPanier(RACE_DATE),
      ajouterAuPanier(RACE_DATE),
    ]);

    const statuts = [a.status, b.status];
    const refus = statuts.find((s) => s !== 201) as number;

    expect(statuts.filter((s) => s === 201)).toHaveLength(1);
    // Le refus est un refus métier, pas une panne.
    expect(refus).toBeGreaterThanOrEqual(400);
    expect(refus).toBeLessThan(500);

    const [lignes] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
         FROM cart c
         JOIN activity a ON a.id = c.id_activity
        WHERE a.space_id = ? AND a.start_date = ?`,
      [EXCLUSIVE_SPACE_ID, RACE_DATE],
    );
    expect(Number(lignes[0].total)).toBe(1);
  }, 60_000);

  test("une intention non aboutie ne réserve rien (402)", async () => {
    await nettoyer(PAID_DATE);
    await ajouterAuPanier(PAID_DATE);

    await request(app)
      .post("/api/payment/create-intent")
      .set("Cookie", sessionCookie);

    stripeState.status = "requires_payment_method";

    const res = await request(app)
      .post("/api/booking")
      .set("Cookie", sessionCookie)
      .send({ paymentIntentId: "pi_int_test" });

    stripeState.status = "succeeded";

    expect(res.status).toBe(402);
    expect(await compterBookings(PAID_DATE)).toBe(0);
  }, 60_000);

  test("le compteur de factures ne rend jamais deux fois le même numéro", async () => {
    const year = new Date().getFullYear();
    const billingRepository = (
      await import("../src/modules/shared/billingRepository")
    ).default;

    const numeros = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          const numero = await billingRepository.nextBillsNumber(
            connection,
            year,
          );
          await connection.commit();
          return numero;
        } finally {
          connection.release();
        }
      }),
    );

    expect(new Set(numeros).size).toBe(5);
  }, 60_000);
});
