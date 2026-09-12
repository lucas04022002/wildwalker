/**
 * Un envoi de fichier refusé est une erreur de l'appelant, pas une panne.
 *
 * Sans gestionnaire dédié, l'erreur de multer (type refusé, taille) filait
 * jusqu'au filet final : 500 « Erreur serveur. ». L'utilisateur qui envoie
 * un PDF de 40 Mo n'apprenait ni quoi ni pourquoi, et le journal d'erreurs
 * se remplissait de refus parfaitement attendus.
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
  default: { createEventRequest: jest.fn(async () => 1) },
}));

jest.mock("../src/modules/createEventForm/createEventFormRepository", () => ({
  __esModule: true,
  default: { isEventSlotTaken: jest.fn(async () => false) },
}));

import request from "supertest";
import app from "../src/app";
import { MAX_UPLOAD_BYTES } from "../src/upload/upload";
import { clientUser, sessionCookie } from "./helpers/session";

const ROUTE = "/api/dashboard/client/event-requests";

describe("envois de fichiers refusés", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  test("un type de fichier non supporté répond 400 avec un message lisible", async () => {
    const res = await request(app)
      .post(ROUTE)
      .set("Cookie", sessionCookie(clientUser))
      .attach("image", Buffer.from("%PDF-1.4"), {
        filename: "contrat.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Format non supporté. Utilisez JPG, PNG ou WEBP.",
    );
  });

  test("un fichier trop volumineux répond 400 en citant la limite", async () => {
    const res = await request(app)
      .post(ROUTE)
      .set("Cookie", sessionCookie(clientUser))
      .attach("image", Buffer.alloc(MAX_UPLOAD_BYTES + 1_024), {
        filename: "enorme.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Fichier trop volumineux : 5 Mo maximum.");
  });

  test("un champ de fichier inattendu répond 400, pas 500", async () => {
    const res = await request(app)
      .post(ROUTE)
      .set("Cookie", sessionCookie(clientUser))
      .attach("piece_jointe", Buffer.from("x"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Champ de fichier inattendu.");
  });

  test("un refus attendu n'encombre pas le journal d'erreurs", async () => {
    await request(app)
      .post(ROUTE)
      .set("Cookie", sessionCookie(clientUser))
      .attach("image", Buffer.from("%PDF-1.4"), {
        filename: "contrat.pdf",
        contentType: "application/pdf",
      });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("aucun refus ne laisse fuiter « Erreur serveur. »", async () => {
    const res = await request(app)
      .post(ROUTE)
      .set("Cookie", sessionCookie(clientUser))
      .attach("image", Buffer.from("GIF89a"), {
        filename: "anim.gif",
        contentType: "image/gif",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).not.toBe("Erreur serveur.");
  });
});
