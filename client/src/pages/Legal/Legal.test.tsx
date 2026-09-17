import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../hooks/useSession";
import { routes } from "../../main";

const useSessionMock = vi.hoisted(() => vi.fn<() => Session>());

vi.mock("../../hooks/useSession", () => ({
  useSession: useSessionMock,
  SessionContext: {
    Provider: ({ children }: { children: unknown }) => children,
  },
  useSessionLoader: () => ({
    user: null,
    loading: false,
    refresh: async () => {},
  }),
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: () => Promise.resolve(null),
}));

const anonyme: Session = {
  user: null,
  loading: false,
  refresh: vi.fn(async () => {}),
};

const ouvrir = (chemin: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [chemin] });
  render(<RouterProvider router={router} />);
  return router;
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("[]", { status: 200 })),
  );
  useSessionMock.mockReturnValue(anonyme);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Le site n'avait aucune page légale : `/mentions-legales` répondait par
 * l'écran d'erreur du routeur, et le pied de page écrivait « Mentions
 * légales » en texte brut, sans rien derrière.
 */
describe("mentions légales", () => {
  it("la route existe et s'ouvre sans compte", () => {
    const router = ouvrir("/mentions-legales");

    expect(router.state.location.pathname).toBe("/mentions-legales");
    expect(
      screen.getByRole("heading", { level: 1, name: "Mentions légales" }),
    ).toBeInTheDocument();
  });

  it("annonce que le site est une démonstration, avant tout le reste", () => {
    ouvrir("/mentions-legales");

    // Deux mentions : l'avertissement en tête, et le premier point des
    // conditions. On vise celui qui doit se lire avant tout le reste.
    expect(
      screen.getByText("Le Local est un projet de démonstration."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/aucun paiement n'est encaissé/i),
    ).toBeInTheDocument();
  });

  it("nomme l'éditeur, l'hébergeur et un contact", () => {
    ouvrir("/mentions-legales");

    expect(screen.getAllByText("Lucas Guilhot").length).toBeGreaterThan(0);
    expect(screen.getByText(/OVH SAS/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@/ })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:"),
    );
  });

  it("n'affiche aucun champ « À COMPLÉTER »", () => {
    ouvrir("/mentions-legales");

    expect(screen.queryByText(/À COMPLÉTER/i)).toBeNull();
  });

  it("n'affirme plus l'existence d'une association loi 1901", () => {
    ouvrir("/");

    expect(screen.queryByText(/Association loi 1901/i)).toBeNull();
  });

  it("le pied de page mène à la page, au lieu de l'écrire en texte mort", () => {
    ouvrir("/");

    expect(
      screen.getByRole("link", { name: "Mentions légales" }),
    ).toHaveAttribute("href", "/mentions-legales");
  });
});
