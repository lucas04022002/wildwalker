import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "./hooks/useSession";
import { routes } from "./main";

const useSessionMock = vi.hoisted(() => vi.fn<() => Session>());

vi.mock("./hooks/useSession", () => ({
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

// Stripe monte un script au chargement du module : inutile ici.
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: () => Promise.resolve(null),
}));

const anonyme: Session = {
  user: null,
  loading: false,
  refresh: vi.fn(async () => {}),
};

/** Les six routes que la refonte doit fermer aux visiteurs anonymes. */
const PROTEGEES = [
  "/dashboard-client",
  "/cart",
  "/payment",
  "/confirmation",
  "/invoice/12",
  "/dashboard-admin",
];

describe("routes protégées (main.tsx)", () => {
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

  it.each(PROTEGEES)("%s renvoie un anonyme vers /log-in", (path) => {
    const router = createMemoryRouter(routes, { initialEntries: [path] });

    render(<RouterProvider router={router} />);

    expect(router.state.location.pathname).toBe("/log-in");
  });

  it("laisse l'accueil ouvert à tout le monde", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });

    render(<RouterProvider router={router} />);

    expect(router.state.location.pathname).toBe("/");
    expect(screen.queryByText(/Saisissez vos identifiants/)).toBeNull();
  });
});
