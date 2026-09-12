import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const renderLogin = (
  initialEntry: { pathname: string; state?: unknown } | string = "/log-in",
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/log-in" element={<Login />} />
        <Route
          path="/dashboard-client"
          element={<p>tableau de bord client</p>}
        />
        <Route path="/dashboard-admin" element={<p>tableau de bord admin</p>} />
        <Route path="/cart" element={<p>panier</p>} />
      </Routes>
    </MemoryRouter>,
  );

const fillAndSubmit = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "client@lelocal.fr");
  await user.type(screen.getByLabelText("Mot de passe"), "motdepasse");
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
};

describe("Login", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche le message renvoyé par l'API en cas de 401", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "Email ou mot de passe incorrect." }, 401),
    );

    renderLogin();
    await fillAndSubmit();

    expect(
      await screen.findByText("Email ou mot de passe incorrect."),
    ).toBeInTheDocument();
  });

  it("n'écrit aucun jeton dans le stockage du navigateur après une connexion", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ user: { id: 7, role: "client" } }, 200),
    );

    renderLogin();
    await fillAndSubmit();

    // La session est un cookie httpOnly : rien ne doit être rangé ici.
    await screen.findByText("tableau de bord client");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("appelle la route client avec les identifiants et le cookie de session", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ user: { id: 7, role: "client" } }, 200),
    );

    renderLogin();
    await fillAndSubmit();

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/auth/login/client`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            email: "client@lelocal.fr",
            password: "motdepasse",
          }),
        }),
      ),
    );
  });

  it("redirige un admin vers son tableau de bord", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ user: { id: 1, role: "admin" } }, 200),
    );

    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Admin" }));
    await fillAndSubmit();

    expect(
      await screen.findByText("tableau de bord admin"),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}/api/auth/login/admin`,
      expect.anything(),
    );
  });

  it("ramène le client sur la page qu'il demandait avant la redirection", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ user: { id: 7, role: "client" } }, 200),
    );

    renderLogin({
      pathname: "/log-in",
      state: { from: { pathname: "/cart" } },
    });
    await fillAndSubmit();

    expect(await screen.findByText("panier")).toBeInTheDocument();
  });

  it("affiche le message d'inscription transmis par la page de création de compte", () => {
    renderLogin({
      pathname: "/log-in",
      state: { notice: "Si l'adresse est disponible, le compte est créé." },
    });

    expect(
      screen.getByText("Si l'adresse est disponible, le compte est créé."),
    ).toBeInTheDocument();
  });

  it("signale une panne réseau sans laisser le bouton bloqué", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    renderLogin();
    await fillAndSubmit();

    expect(
      await screen.findByText("Impossible de contacter le serveur."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeEnabled();
  });
});
