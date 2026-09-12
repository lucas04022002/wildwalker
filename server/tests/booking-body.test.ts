import request from "supertest";

type QueryCall = [string, unknown[]?];

/**
 * Montant de l'intention de paiement mockée. Réglé par chaque test à la
 * valeur que le serveur calcule pour le panier courant : `POST /api/booking`
 * exige désormais une preuve de paiement, et refuse (402) tout montant qui
 * ne correspond pas exactement au panier.
 */
const mockStripe = { amount: 0, status: "succeeded" };

const calls: QueryCall[] = [];

const STANDARD_LINE = {
  id: 11,
  quantity: 2,
  price_unit: "40.00",
  id_activity: 3,
  space_category: "Openspace",
  start_date: "2026-10-01",
  end_date: "2026-10-01",
};

const MONTHLY_LINE = {
  id: 12,
  quantity: 1,
  price_unit: "25.00",
  id_activity: 4,
  space_category: "Local vide",
  start_date: "2026-01-10",
  end_date: "2026-07-10",
};

let cartRows: Record<string, unknown>[] = [STANDARD_LINE];

const connection = {
  query: jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push([sql, params]);

    if (/from\s+cart\s+c/i.test(sql)) {
      return [cartRows, []];
    }

    if (/count\(\*\)/i.test(sql)) {
      return [[{ count: 0 }], []];
    }

    // Compteur de factures (migration 0002) : l'upsert ne rend rien, la
    // lecture rend la valeur courante.
    if (/select\s+`last`\s+from\s+invoice_counter/i.test(sql)) {
      return [[{ last: 1 }], []];
    }

    if (/from\s+time_slot/i.test(sql)) {
      return [[{ id: 1, slot: "Matin" }], []];
    }

    return [{ insertId: 1, affectedRows: 1 }, []];
  }),
  beginTransaction: jest.fn(async () => undefined),
  commit: jest.fn(async () => undefined),
  rollback: jest.fn(async () => undefined),
  release: jest.fn(() => undefined),
};

jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    paymentIntents: {
      create: jest.fn(async () => ({
        id: "pi_test",
        client_secret: "cs_test",
      })),
      retrieve: jest.fn(async (id: string) => ({
        id,
        status: mockStripe.status,
        amount: mockStripe.amount,
        currency: "eur",
        metadata: {},
      })),
    },
  })),
}));

jest.mock("../src/modules/space/spaceRepository", () => ({
  __esModule: true,
  default: {
    readForUpdate: jest.fn(async () => ({
      id: 1,
      space_name: "Open space",
      description: "",
      capacity: 10,
      url_image: "open.webp",
      price_unit: "25.00",
      space_type: "bureau",
      space_category: "Open space",
    })),
    countBookedSeats: jest.fn(async () => 0),
    isSlotTaken: jest.fn(async () => false),
    hasOverlappingDateRange: jest.fn(async () => false),
  },
}));

jest.mock("../src/modules/activity/activityRepository", () => ({
  __esModule: true,
  default: {
    findOrCreate: jest.fn(async () => ({ id: 3, price_unit: "25.00" })),
    create: jest.fn(async () => ({ id: 3, price_unit: "25.00" })),
  },
}));

/**
 * Le pool sert la lecture de prix du panier (`readCartPriceRows`), celle qui
 * fixe le montant attendu de l'intention de paiement. Les écritures passent
 * par la connexion dédiée ci-dessus.
 */
const pool = {
  query: jest.fn(async (sql: string) =>
    /from\s+cart\s+c/i.test(sql) ? [cartRows, []] : [[], []],
  ),
  getConnection: jest.fn(async () => connection),
};

jest.mock("../database/client", () => ({
  __esModule: true,
  default: pool,
}));

import app from "../src/app";
import { computeCartAmount } from "../src/modules/Payment/amount";
import { clientUser, sessionCookie } from "./helpers/session";

const findCall = (pattern: RegExp): QueryCall | undefined =>
  calls.find(([sql]) => pattern.test(sql));

/** Règle l'intention mockée sur le montant exact du panier courant. */
const intentionValide = () => {
  mockStripe.status = "succeeded";
  // biome-ignore lint/suspicious/noExplicitAny: lignes de panier de test
  mockStripe.amount = computeCartAmount(cartRows as any);
};

/** Corps minimal de `POST /api/booking` : la référence de paiement. */
const PREUVE = { paymentIntentId: "pi_test" };

describe("POST /api/booking", () => {
  beforeEach(() => {
    calls.length = 0;
    cartRows = [STANDARD_LINE];
    jest.clearAllMocks();
    intentionValide();
  });

  test("ignore userId et price_unit du body", async () => {
    const res = await request(app)
      .post("/api/booking")
      .set("Cookie", sessionCookie(clientUser))
      .send({
        ...PREUVE,
        userId: 999,
        cartItems: [{ id_activity: 3, quantity: 2, price_unit: 0.01 }],
      });

    expect(res.status).toBe(201);

    const select = findCall(/from\s+cart\s+c/i);
    expect(select?.[1]).toEqual([clientUser.id]);

    const insert = findCall(/insert\s+into\s+booking/i);
    expect(insert).toBeDefined();
    const params = insert?.[1] as unknown[];
    expect(params[0]).toBe(clientUser.id);
    expect(params[0]).not.toBe(999);
    expect(params).toContain(80);
    expect(params).not.toContain(0.02);
  });

  test("verrouille les lignes du panier dans une transaction", async () => {
    await request(app)
      .post("/api/booking")
      .set("Cookie", sessionCookie(clientUser))
      .send(PREUVE);

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(findCall(/from\s+cart\s+c/i)?.[0]).toMatch(/for\s+update/i);
  });

  test("vide le panier de l'utilisateur du jeton", async () => {
    await request(app)
      .post("/api/booking")
      .set("Cookie", sessionCookie(clientUser))
      .send({ ...PREUVE, userId: 999 });

    const remove = findCall(/delete\s+from\s+cart/i);
    expect(remove?.[1]).toEqual([clientUser.id]);
  });

  test("un « Local vide » de six mois se réserve 150 €", async () => {
    cartRows = [MONTHLY_LINE];
    intentionValide();

    const res = await request(app)
      .post("/api/booking")
      .set("Cookie", sessionCookie(clientUser))
      .send(PREUVE);

    expect(res.status).toBe(201);

    const insert = findCall(/insert\s+into\s+booking/i);
    const params = insert?.[1] as unknown[];
    expect(params[3]).toBe(150);
  });

  test("la lecture du panier joint l'espace et les dates de l'activité", async () => {
    await request(app)
      .post("/api/booking")
      .set("Cookie", sessionCookie(clientUser))
      .send(PREUVE);

    const select = findCall(/from\s+cart\s+c/i);
    expect(select?.[0]).toMatch(/space_category/i);
    expect(select?.[0]).toMatch(/start_date/i);
  });

  test("401 sans session", async () => {
    const res = await request(app)
      .post("/api/booking")
      .send({ userId: 999, cartItems: [] });

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
});

describe("POST /api/bookings (ajout au panier)", () => {
  beforeEach(() => {
    calls.length = 0;
    jest.clearAllMocks();
  });

  test("401 sans session", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .send({ space_id: 1, start_date: "2026-10-01", end_date: "2026-10-01" });

    expect(res.status).toBe(401);
  });

  test("recalcule le prix depuis l'espace et ignore users_id du body", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set("Cookie", sessionCookie(clientUser))
      .send({
        space_id: 1,
        time_slot_id: 1,
        start_date: "2026-10-01",
        end_date: "2026-10-01",
        seats: 2,
        months: null,
        users_id: 999,
        total_price: 0.02,
        effective_price: 0.01,
      });

    expect(res.status).toBe(201);

    const insert = findCall(/insert\s+into\s+cart/i);
    const params = insert?.[1] as unknown[];
    expect(params).toEqual([2, 50, 25, clientUser.id, 3]);
  });
});
