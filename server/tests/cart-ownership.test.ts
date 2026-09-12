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

jest.mock("../src/modules/cart/cartRepository", () => ({
  __esModule: true,
  default: {
    readAll: jest.fn(async () => [{ id: 11 }]),
    create: jest.fn(async () => 11),
    updateQuantity: jest.fn(async () => 0),
    destroy: jest.fn(async () => 0),
    destroyAll: jest.fn(async () => 1),
  },
}));

jest.mock("../src/modules/event/eventRepository", () => ({
  __esModule: true,
  default: {
    readRemainingSlotsByEvent: jest.fn(async () => 50),
  },
}));

import app from "../src/app";
import cartRepository from "../src/modules/cart/cartRepository";
import { clientUser, sessionCookie } from "./helpers/session";

const OTHER_USER_ID = 999;

describe("propriété des lignes de panier", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/cart lit le panier de l'utilisateur du jeton", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", sessionCookie(clientUser));

    expect(res.status).toBe(200);
    expect(cartRepository.readAll).toHaveBeenCalledWith(clientUser.id);
  });

  test("GET /api/cart/:userId n'existe plus", async () => {
    const res = await request(app)
      .get(`/api/cart/${OTHER_USER_ID}`)
      .set("Cookie", sessionCookie(clientUser));

    expect(res.status).toBe(404);
    expect(cartRepository.readAll).not.toHaveBeenCalled();
  });

  test("PATCH /api/cart/:id filtre sur l'utilisateur et renvoie 404 si 0 ligne", async () => {
    (cartRepository.updateQuantity as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .patch("/api/cart/5")
      .set("Cookie", sessionCookie(clientUser))
      .send({ quantity: 3 });

    expect(res.status).toBe(404);
    expect(cartRepository.updateQuantity).toHaveBeenCalledWith(
      5,
      clientUser.id,
      3,
    );
  });

  test("PATCH /api/cart/:id renvoie 204 sur sa propre ligne", async () => {
    (cartRepository.updateQuantity as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .patch("/api/cart/5")
      .set("Cookie", sessionCookie(clientUser))
      .send({ quantity: 3 });

    expect(res.status).toBe(204);
  });

  test("DELETE /api/cart/:id filtre sur l'utilisateur et renvoie 404 si 0 ligne", async () => {
    (cartRepository.destroy as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .delete("/api/cart/5")
      .set("Cookie", sessionCookie(clientUser));

    expect(res.status).toBe(404);
    expect(cartRepository.destroy).toHaveBeenCalledWith(5, clientUser.id);
  });

  test("DELETE /api/cart/user/:userId ne vide que le panier du jeton", async () => {
    const res = await request(app)
      .delete(`/api/cart/user/${OTHER_USER_ID}`)
      .set("Cookie", sessionCookie(clientUser));

    expect(res.status).toBe(204);
    expect(cartRepository.destroyAll).toHaveBeenCalledWith(clientUser.id);
  });

  test("POST /api/cart utilise l'utilisateur du jeton, pas users_id du body", async () => {
    const res = await request(app)
      .post("/api/cart")
      .set("Cookie", sessionCookie(clientUser))
      .send({
        users_id: OTHER_USER_ID,
        event_id: 3,
        quantity: 1,
        total_price: 10,
        last_name: "Martin",
        first_name: "Dominique",
        email: "dominique@exemple.fr",
      });

    expect(res.status).toBe(201);
    expect(cartRepository.create).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ users_id: clientUser.id }),
    );
  });

  test("401 sans session sur les mutations du panier", async () => {
    const res = await request(app).patch("/api/cart/5").send({ quantity: 3 });

    expect(res.status).toBe(401);
  });
});
