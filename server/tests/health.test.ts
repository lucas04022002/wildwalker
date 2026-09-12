import request from "supertest";

const query = jest.fn();

jest.mock("../database/client", () => ({
  __esModule: true,
  default: {
    query,
    getConnection: jest.fn(),
  },
}));

import app from "../src/app";

describe("GET /api/health", () => {
  beforeEach(() => {
    query.mockReset();
  });

  test("200 et db:true quand la base répond", async () => {
    query.mockResolvedValue([[{ "1": 1 }], []]);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true });
    // Une vraie requête, pas une réponse en dur.
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  test("503 et db:false quand la base est injoignable", async () => {
    query.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, db: false });
  });

  test("ne fuite aucun détail de connexion", async () => {
    query.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:3306"));

    const res = await request(app).get("/api/health");

    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.5|3306/);
  });

  test("une route /api inconnue reste du JSON, pas l'index du client", async () => {
    const res = await request(app).get("/api/inexistante");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Route inconnue." });
  });
});
