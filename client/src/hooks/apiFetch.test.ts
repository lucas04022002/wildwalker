import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, logout } from "./apiFetch";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const okResponse = () => new Response("{}", { status: 200 });

/**
 * `window.location` est remplaçable dans jsdom (propriété configurable), mais
 * pas espionnable méthode par méthode : on la remplace entièrement le temps du
 * test, puis on remet l'originale.
 */
const realLocation = window.location;
const stubLocation = () => {
  const fake = { href: "" } as Location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: fake,
  });
  return fake;
};

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse()),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    });
  });

  it("envoie le cookie de session avec credentials: include", async () => {
    await apiFetch("/api/cart");

    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}/api/cart`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("n'ajoute jamais d'en-tête Authorization", async () => {
    await apiFetch("/api/cart", { method: "POST", body: "{}" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;

    expect(Object.keys(headers)).not.toContain("Authorization");
    expect(JSON.stringify(headers)).not.toMatch(/Bearer/);
  });

  it("ignore un jeton resté dans le stockage du navigateur", async () => {
    // Un utilisateur qui avait l'ancienne version du site garde un "token"
    // dans son navigateur. Il ne doit plus servir à rien.
    localStorage.setItem("token", "vieux-jeton");
    sessionStorage.setItem("token", "vieux-jeton");

    await apiFetch("/api/cart");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(`${url}${JSON.stringify(init)}`).not.toContain("vieux-jeton");
  });

  it("laisse le navigateur poser le Content-Type d'un FormData", async () => {
    await apiFetch("/api/upload", { method: "POST", body: new FormData() });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;

    expect(headers["Content-Type"]).toBeUndefined();
  });
});

describe("logout", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse()),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    });
  });

  it("ferme la session côté serveur puis renvoie au login", async () => {
    const location = stubLocation();

    await logout();

    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}/api/auth/logout`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(location.href).toBe("/log-in");
  });

  it("renvoie au login même si le serveur est injoignable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const location = stubLocation();

    await logout();

    expect(location.href).toBe("/log-in");
  });
});
