/**
 * Test d'intégration : il lui faut un vrai MySQL.
 *
 * Il ne tourne donc qu'en CI (ou sur une machine qui a une base), quand
 * `DB_HOST` est renseigné. Ailleurs, la suite entière est ignorée : pas de
 * Docker ni de MySQL sur le poste de développement.
 */

import path from "node:path";

import type { Pool, RowDataPacket } from "mysql2/promise";
import request from "supertest";

import { createMigrationPool, runMigrations } from "../bin/migrate";
import { runSeed } from "../bin/seed";

const hasDatabase = (process.env.DB_HOST ?? "") !== "";
const describeWithDatabase = hasDatabase ? describe : describe.skip;

const DEMO_CLIENT_EMAIL = "lucie.marie655@voila.fr";
const DEMO_CLIENT_PASSWORD = "demo-client-2026";

// « La Rotonde » : salle de réunion, donc un seul occupant par créneau.
const EXCLUSIVE_SPACE_ID = 5;
const MORNING_SLOT_ID = 1;
const BOOKING_DATE = "2030-03-14";

describeWithDatabase("réservation de bout en bout", () => {
  let pool: Pool;
  // biome-ignore lint/suspicious/noExplicitAny: l'app est importée après la config
  let app: any;
  let sessionCookie: string;

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

    await pool.query(
      `DELETE c FROM cart c
         JOIN activity a ON a.id = c.id_activity
        WHERE a.space_id = ? AND a.start_date = ?`,
      [EXCLUSIVE_SPACE_ID, BOOKING_DATE],
    );
    await pool.query(
      `DELETE b FROM booking b
         JOIN activity a ON a.id = b.id_activity
        WHERE a.space_id = ? AND a.start_date = ?`,
      [EXCLUSIVE_SPACE_ID, BOOKING_DATE],
    );
    await pool.query(
      "DELETE FROM activity WHERE space_id = ? AND start_date = ?",
      [EXCLUSIVE_SPACE_ID, BOOKING_DATE],
    );

    app = (await import("../src/app")).default;
  }, 60_000);

  afterAll(async () => {
    await pool.end();
    const database = (await import("../database/client")).default;
    await database.end();
  });

  test("le client de démo se connecte et reçoit un cookie de session", async () => {
    const res = await request(app)
      .post("/api/auth/login/client")
      .send({ email: DEMO_CLIENT_EMAIL, password: DEMO_CLIENT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies[0]).toMatch(/^ww_session=/);
    sessionCookie = cookies[0].split(";")[0];
  });

  test("réserve un créneau exclusif", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", sessionCookie)
      .send({
        space_id: EXCLUSIVE_SPACE_ID,
        time_slot_id: MORNING_SLOT_ID,
        start_date: BOOKING_DATE,
        end_date: BOOKING_DATE,
        seats: null,
        months: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.cartItemId).toBeGreaterThan(0);
  });

  test("refuse la seconde réservation du même créneau", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", sessionCookie)
      .send({
        space_id: EXCLUSIVE_SPACE_ID,
        time_slot_id: MORNING_SLOT_ID,
        start_date: BOOKING_DATE,
        end_date: BOOKING_DATE,
        seats: null,
        months: null,
      });

    expect(res.status).toBe(409);
  });

  test("le prix enregistré est celui de la base, pas celui du body", async () => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.price_unit, c.total_price
         FROM cart c
         JOIN activity a ON a.id = c.id_activity
        WHERE a.space_id = ? AND a.start_date = ?`,
      [EXCLUSIVE_SPACE_ID, BOOKING_DATE],
    );

    expect(rows).toHaveLength(1);
    expect(Number(rows[0].price_unit)).toBe(40);
    expect(Number(rows[0].total_price)).toBe(40);
  });
});
