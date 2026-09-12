import request from "supertest";

const mockPaymentIntentCreate = jest.fn(async () => ({
  client_secret: "cs_test_factice",
}));

jest.mock("stripe", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockPaymentIntentCreate },
  })),
}));

const mockQuery = jest.fn(async () => [[], []]);

jest.mock("../database/client", () => ({
  __esModule: true,
  default: {
    query: (...args: unknown[]) => mockQuery(...(args as [])),
    getConnection: jest.fn(),
  },
}));

import app from "../src/app";
import {
  billableMonths,
  computeCartAmount,
  monthsBetween,
} from "../src/modules/Payment/amount";
import { clientUser, sessionCookie } from "./helpers/session";

describe("computeCartAmount", () => {
  test("2 places à 40 € font 8000 centimes", () => {
    expect(computeCartAmount([{ quantity: 2, price_unit: "40.00" }])).toBe(
      8000,
    );
  });

  test("additionne plusieurs lignes", () => {
    expect(
      computeCartAmount([
        { quantity: 2, price_unit: "40.00" },
        { quantity: 1, price_unit: 12.5 },
      ]),
    ).toBe(9250);
  });

  test("arrondit au centime, ligne par ligne", () => {
    expect(computeCartAmount([{ quantity: 3, price_unit: "19.99" }])).toBe(
      5997,
    );
  });

  test("un panier vide vaut 0", () => {
    expect(computeCartAmount([])).toBe(0);
  });

  test("ignore les valeurs manquantes ou aberrantes", () => {
    expect(
      computeCartAmount([
        { quantity: 1, price_unit: null },
        { quantity: -3, price_unit: "40.00" },
        { quantity: 2, price_unit: "10.00" },
      ]),
    ).toBe(2000);
  });

  test("facture un « Local vide » au mois : 25 € x 6 mois = 15000", () => {
    expect(
      computeCartAmount([
        {
          quantity: 1,
          price_unit: "25.00",
          space_category: "Local vide",
          start_date: "2026-01-10",
          end_date: "2026-07-10",
        },
      ]),
    ).toBe(15000);
  });

  test("ne multiplie pas par les mois hors « Local vide »", () => {
    expect(
      computeCartAmount([
        {
          quantity: 1,
          price_unit: "25.00",
          space_category: "Openspace",
          start_date: "2026-01-10",
          end_date: "2026-07-10",
        },
      ]),
    ).toBe(2500);
  });

  test("un « Local vide » compte au moins un mois", () => {
    expect(
      computeCartAmount([
        {
          quantity: 1,
          price_unit: "25.00",
          space_category: "Local vide",
          start_date: "2026-01-10",
          end_date: "2026-01-20",
        },
      ]),
    ).toBe(2500);
  });

  test("rend toujours un entier", () => {
    const amount = computeCartAmount([{ quantity: 3, price_unit: "0.105" }]);
    expect(Number.isInteger(amount)).toBe(true);
  });
});

describe("monthsBetween et billableMonths", () => {
  test("compte les mois entiers, jamais négatif", () => {
    expect(monthsBetween("2026-01-10", "2026-07-10")).toBe(6);
    expect(monthsBetween("2026-01-10", "2026-07-09")).toBe(5);
    expect(monthsBetween("2026-07-10", "2026-01-10")).toBe(0);
  });

  test("vaut 1 pour tout ce qui n'est pas mensuel", () => {
    expect(
      billableMonths({
        quantity: 1,
        price_unit: 10,
        space_category: "Atelier",
        start_date: "2026-01-10",
        end_date: "2026-07-10",
      }),
    ).toBe(1);
  });
});

describe("POST /api/payment/create-intent", () => {
  beforeEach(() => {
    mockPaymentIntentCreate.mockClear();
    mockQuery.mockReset();
    mockQuery.mockResolvedValue([
      [{ quantity: 2, price_unit: "40.00" }],
      [],
    ] as never);
  });

  test("ignore le montant du body et facture le panier lu en base", async () => {
    const res = await request(app)
      .post("/api/payment/create-intent")
      .set("Cookie", sessionCookie(clientUser))
      .send({ amount: 1 });

    expect(res.status).toBe(200);
    expect(mockPaymentIntentCreate).toHaveBeenCalledTimes(1);
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 8000, currency: "eur" }),
    );
  });

  test("lit le panier de l'utilisateur du jeton", async () => {
    await request(app)
      .post("/api/payment/create-intent")
      .set("Cookie", sessionCookie(clientUser))
      .send({ amount: 1, userId: 999 });

    const [, params] = mockQuery.mock.calls[0] as unknown as [string, number[]];
    expect(params).toEqual([clientUser.id]);
  });

  test("400 quand le panier est vide", async () => {
    mockQuery.mockResolvedValue([[], []] as never);

    const res = await request(app)
      .post("/api/payment/create-intent")
      .set("Cookie", sessionCookie(clientUser))
      .send({ amount: 5000 });

    expect(res.status).toBe(400);
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled();
  });

  test("un « Local vide » de six mois se facture 15000 centimes", async () => {
    mockQuery.mockResolvedValue([
      [
        {
          quantity: 1,
          price_unit: "25.00",
          space_category: "Local vide",
          start_date: "2026-01-10",
          end_date: "2026-07-10",
        },
      ],
      [],
    ] as never);

    const res = await request(app)
      .post("/api/payment/create-intent")
      .set("Cookie", sessionCookie(clientUser))
      .send({ amount: 2500 });

    expect(res.status).toBe(200);
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 15000 }),
    );
  });

  test("la requête du panier joint l'espace et les dates de l'activité", async () => {
    await request(app)
      .post("/api/payment/create-intent")
      .set("Cookie", sessionCookie(clientUser))
      .send({});

    const [sql] = mockQuery.mock.calls[0] as unknown as [string];
    expect(sql).toMatch(/space_category/i);
    expect(sql).toMatch(/start_date/i);
    expect(sql).toMatch(/end_date/i);
  });

  test("401 sans session", async () => {
    const res = await request(app)
      .post("/api/payment/create-intent")
      .send({ amount: 8000 });

    expect(res.status).toBe(401);
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled();
  });
});
