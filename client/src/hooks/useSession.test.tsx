import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "../context/SessionProvider";
import { useSession } from "./useSession";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Affiche l'état de la session sous une forme lisible dans le DOM. */
function Probe() {
  const { user, loading } = useSession();
  return (
    <p data-testid="etat">
      {loading ? "chargement" : (user?.email ?? "anonyme")}
    </p>
  );
}

const renderProbe = () =>
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );

describe("useSession", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("demande la session au serveur, cookie compris", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ user: { id: 7, email: "c@lelocal.fr" } }, 200),
    );

    renderProbe();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/auth/me`,
        expect.objectContaining({ credentials: "include" }),
      ),
    );
  });

  it("expose l'utilisateur renvoyé par /api/auth/me", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        { user: { id: 7, email: "c@lelocal.fr", role: "client" } },
        200,
      ),
    );

    renderProbe();

    expect(await screen.findByText("c@lelocal.fr")).toBeInTheDocument();
  });

  it("traite un 401 comme un visiteur anonyme, pas comme une erreur", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "Authentification requise." }, 401),
    );

    renderProbe();

    expect(await screen.findByText("anonyme")).toBeInTheDocument();
  });

  it("considère l'utilisateur anonyme si le serveur est injoignable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    renderProbe();

    expect(await screen.findByText("anonyme")).toBeInTheDocument();
  });

  it("n'interroge le serveur qu'une fois pour toute l'application", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ user: { id: 7, email: "c@lelocal.fr" } }, 200),
    );

    render(
      <SessionProvider>
        <Probe />
        <Probe />
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getAllByText("c@lelocal.fr")).toHaveLength(3),
    );
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  });
});
