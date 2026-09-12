import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, SessionUser } from "../../hooks/useSession";
import NavBar from "./NavBar";

const useSessionMock = vi.hoisted(() => vi.fn<() => Session>());

vi.mock("../../hooks/useSession", () => ({ useSession: useSessionMock }));

const client: SessionUser = {
  id: 7,
  email: "client@lelocal.fr",
  role: "client",
  firstname: "Chloé",
};

const session = (user: SessionUser | null, loading = false): Session => ({
  user,
  loading,
  refresh: vi.fn(async () => {}),
});

const renderNavBar = () =>
  render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>,
  );

describe("NavBar", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
  });

  it("n'affiche pas « Se connecter » tant que la session est inconnue", () => {
    useSessionMock.mockReturnValue(session(null, true));

    renderNavBar();

    // Sinon un utilisateur connecté voit passer le bouton de connexion à
    // chaque chargement de page.
    expect(screen.queryByText("Se connecter")).not.toBeInTheDocument();
    expect(screen.queryByText("Rejoindre")).not.toBeInTheDocument();
  });

  it("propose la connexion à un visiteur anonyme", () => {
    useSessionMock.mockReturnValue(session(null));

    renderNavBar();

    expect(screen.getByText("Se connecter")).toBeInTheDocument();
    expect(screen.getByText("Rejoindre")).toBeInTheDocument();
  });

  it("mène au tableau de bord quand la session existe", () => {
    useSessionMock.mockReturnValue(session(client));

    renderNavBar();

    expect(screen.queryByText("Se connecter")).not.toBeInTheDocument();
    const lien = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "/dashboard-client");
    expect(lien).toBeDefined();
  });
});
