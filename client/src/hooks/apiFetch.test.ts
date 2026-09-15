import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiList, apiOne, logout } from "./apiFetch";

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

/**
 * En production, l'image Docker sert le client et l'API depuis le même
 * processus : le build est fait avec `VITE_API_URL=""`. Le préfixe vide doit
 * donner une URL relative — surtout pas la chaîne « undefined ».
 */
describe("apiFetch sans VITE_API_URL (production, même origine)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("appelle une URL relative quand la variable est vide", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse()),
    );

    const { apiFetch: freshFetch } = await import("./apiFetch");
    await freshFetch("/api/cart");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/cart");
  });

  it("n'écrit jamais « undefined » dans l'URL si la variable n'existe pas", async () => {
    vi.stubEnv("VITE_API_URL", undefined as unknown as string);
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse()),
    );

    const { apiFetch: freshFetch } = await import("./apiFetch");
    await freshFetch("/api/cart");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toContain("undefined");
    expect(url).toBe("/api/cart");
  });
});

/**
 * Ces tests décrivent la panne réelle du 15/09/2026 : une session expirée
 * renvoyait `401 {"message": "..."}`, l'objet atterrissait dans un état
 * déclaré comme tableau, et le premier `.slice()` faisait tomber toute la
 * page. Le garde-fou doit donc tenir sur le statut ET sur la forme.
 */
describe("apiList", () => {
  const reponse = (corps: unknown, status = 200) =>
    new Response(JSON.stringify(corps), { status });

  const simuler = (r: Response) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => r),
    );

  it("rend la liste quand le serveur répond une liste", async () => {
    simuler(reponse([{ id: 1 }, { id: 2 }]));
    expect(await apiList("/api/spaces")).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("rend une liste vide sur 401, sans propager l'objet d'erreur", async () => {
    simuler(reponse({ message: "Veuillez vous connecter." }, 401));
    expect(await apiList("/api/spaces")).toEqual([]);
  });

  it("rend une liste vide si un 200 rapporte autre chose qu'une liste", async () => {
    simuler(reponse({ message: "surprise" }));
    expect(await apiList("/api/spaces")).toEqual([]);
  });

  it("rend une liste vide si le serveur est injoignable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("réseau");
      }),
    );
    expect(await apiList("/api/spaces")).toEqual([]);
  });

  it("rend une liste vide si le corps n'est pas du JSON", async () => {
    simuler(new Response("<html>502</html>", { status: 200 }));
    expect(await apiList("/api/spaces")).toEqual([]);
  });
});

describe("apiOne", () => {
  it("rend l'objet quand le serveur répond 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ id: 7 }), { status: 200 }),
      ),
    );
    expect(await apiOne("/api/invoice/7")).toEqual({ id: 7 });
  });

  it("rend null sur une erreur, pour ne pas confondre un échec avec un objet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Introuvable." }), {
            status: 404,
          }),
      ),
    );
    expect(await apiOne("/api/invoice/7")).toBeNull();
  });
});
