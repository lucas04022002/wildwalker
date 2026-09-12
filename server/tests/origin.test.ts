import request from "supertest";

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

jest.mock("../src/modules/event/eventRepository", () => ({
  __esModule: true,
  default: {
    readRemainingSlotsByEvent: jest.fn(async () => 50),
  },
}));

jest.mock("../src/modules/cart/cartRepository", () => ({
  __esModule: true,
  default: {
    readAll: jest.fn(async () => []),
    create: jest.fn(async () => 1),
    updateQuantity: jest.fn(async () => 1),
    destroy: jest.fn(async () => 1),
    destroyAll: jest.fn(async () => 1),
  },
}));

import app from "../src/app";
import { clientUser, sessionCookie } from "./helpers/session";

const body = {
  event_id: 3,
  quantity: 1,
  total_price: 10,
  last_name: "Martin",
  first_name: "Dominique",
  email: "dominique@exemple.fr",
};

describe("garde d'origine sur les routes non-GET", () => {
  test("403 quand sec-fetch-site vaut cross-site", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Cookie", sessionCookie(clientUser))
      .set("sec-fetch-site", "cross-site")
      .send(body);

    expect(res.status).toBe(403);
  });

  test("403 quand Origin est un site tiers", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Cookie", sessionCookie(clientUser))
      .set("Origin", "http://attaquant.test")
      .send(body);

    expect(res.status).toBe(403);
  });

  test("laisse passer sec-fetch-site: same-origin", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Cookie", sessionCookie(clientUser))
      .set("sec-fetch-site", "same-origin")
      .set("Origin", process.env.CLIENT_URL as string)
      .send(body);

    expect(res.status).not.toBe(403);
  });

  test("laisse passer une requête sans en-tête d'origine (outils, tests)", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Cookie", sessionCookie(clientUser))
      .send(body);

    expect(res.status).not.toBe(403);
  });

  test("n'applique pas la garde aux GET", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", sessionCookie(clientUser))
      .set("sec-fetch-site", "cross-site");

    expect(res.status).toBe(200);
  });

  test("403 sur DELETE cross-site, avant même l'authentification", async () => {
    const res = await request(app)
      .delete("/api/cart/1")
      .set("sec-fetch-site", "cross-site");

    expect(res.status).toBe(403);
  });
});
