import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, SessionUser } from "../hooks/useSession";
import RequireRole from "./RequireRole";

const useSessionMock = vi.hoisted(() => vi.fn<() => Session>());

vi.mock("../hooks/useSession", () => ({
  useSession: useSessionMock,
}));

const client: SessionUser = {
  id: 7,
  email: "client@lelocal.fr",
  role: "client",
  firstname: "Chloé",
};

const admin: SessionUser = { ...client, id: 1, role: "admin" };

const session = (user: SessionUser | null, loading = false): Session => ({
  user,
  loading,
  refresh: vi.fn(async () => {}),
});

/**
 * Rend la garde sur `/cart`, avec des pages repères pour `/log-in` et `/`
 * afin de lire où la redirection a réellement mené.
 */
const renderGuard = (role: "client" | "admin" = "client") =>
  render(
    <MemoryRouter initialEntries={["/cart"]}>
      <Routes>
        <Route
          path="/cart"
          element={
            <RequireRole requiredRole={role}>
              <p>contenu protégé</p>
            </RequireRole>
          }
        />
        <Route path="/log-in" element={<p>page de connexion</p>} />
        <Route path="/" element={<p>accueil</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("RequireRole", () => {
  beforeEach(() => {
    useSessionMock.mockReset();
  });

  it("ne rend rien tant que la session est en cours de chargement", () => {
    useSessionMock.mockReturnValue(session(null, true));

    const { container } = renderGuard();

    expect(screen.queryByText("contenu protégé")).not.toBeInTheDocument();
    expect(screen.queryByText("page de connexion")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renvoie au login quand il n'y a pas de session", () => {
    useSessionMock.mockReturnValue(session(null));

    renderGuard();

    expect(screen.getByText("page de connexion")).toBeInTheDocument();
    expect(screen.queryByText("contenu protégé")).not.toBeInTheDocument();
  });

  it("garde en mémoire la page demandée pour y revenir après connexion", () => {
    useSessionMock.mockReturnValue(session(null));

    const role = "client" as const;

    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <Routes>
          <Route
            path="/cart"
            element={
              <RequireRole requiredRole={role}>
                <p>contenu protégé</p>
              </RequireRole>
            }
          />
          <Route path="/log-in" element={<FromProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("from")).toHaveTextContent("/cart");
  });

  it("renvoie à l'accueil quand le rôle ne correspond pas", () => {
    useSessionMock.mockReturnValue(session(admin));

    renderGuard("client");

    expect(screen.getByText("accueil")).toBeInTheDocument();
    expect(screen.queryByText("contenu protégé")).not.toBeInTheDocument();
  });

  it("rend l'enfant quand le rôle correspond", () => {
    useSessionMock.mockReturnValue(session(client));

    renderGuard("client");

    expect(screen.getByText("contenu protégé")).toBeInTheDocument();
  });

  it("rend l'enfant d'une route admin pour un admin", () => {
    useSessionMock.mockReturnValue(session(admin));

    renderGuard("admin");

    expect(screen.getByText("contenu protégé")).toBeInTheDocument();
  });
});

/** Page repère qui affiche le chemin transmis dans `state.from`. */
function FromProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)
    ?.from;
  return <p data-testid="from">{from?.pathname ?? "aucun"}</p>;
}
