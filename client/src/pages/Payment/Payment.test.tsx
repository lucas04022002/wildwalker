import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, SessionUser } from "../../hooks/useSession";
import Payment from "./Payment";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const useSessionMock = vi.hoisted(() => vi.fn<() => Session>());

vi.mock("../../hooks/useSession", () => ({ useSession: useSessionMock }));

// Stripe n'est pas joignable en test : le formulaire de carte est remplacé
// par un repère, ce qui laisse la page elle-même sous test.
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: () => Promise.resolve(null),
}));
vi.mock("../../components/CheckoutForm/CheckoutForm", () => ({
  default: ({
    totalPrice,
    onSuccess,
  }: {
    totalPrice: number;
    onSuccess: () => void;
  }) => (
    <button type="button" onClick={onSuccess}>
      Payer {totalPrice.toFixed(2)} €
    </button>
  ),
}));

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

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const renderPayment = () =>
  render(
    <MemoryRouter initialEntries={["/payment"]}>
      <Routes>
        <Route path="/payment" element={<Payment />} />
        <Route
          path="/confirmation"
          element={<p>merci pour votre commande</p>}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("Payment", () => {
  beforeEach(() => {
    // La clé est stubée explicitement : sans cela le test passait ou échouait
    // selon qu'un .env traînait sur la machine, et l'intégration continue
    // n'en a pas.
    vi.stubEnv("VITE_STRIPE_PUBLIC_KEY", "pk_test_pour_les_tests");
    vi.stubGlobal("fetch", vi.fn());
    useSessionMock.mockReturnValue(session(client));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("annonce l'indisponibilité quand la clé publique Stripe manque", async () => {
    vi.stubEnv("VITE_STRIPE_PUBLIC_KEY", "");
    renderPayment();

    expect(
      await screen.findByText(/paiement en ligne n.est pas disponible/i),
    ).toBeInTheDocument();
    // Aucune intention de paiement n'est demandée : il n'y a rien à finaliser.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("demande l'intention de paiement sans envoyer de montant", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ clientSecret: "cs_test", amount: 4500 }, 200),
    );

    renderPayment();

    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${API_URL}/api/payment/create-intent`);
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    // Aucun corps : le prix est celui du panier en base, pas celui du client.
    expect(init?.body).toBeUndefined();
  });

  it("affiche le montant calculé par le serveur, converti en euros", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ clientSecret: "cs_test", amount: 4500 }, 200),
    );

    renderPayment();

    // 4500 centimes en base → 45,00 € à l'écran.
    expect(await screen.findByText("45.00 €")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Payer 45.00 €" }),
    ).toBeInTheDocument();
  });

  it("affiche le message du serveur quand le panier est vide", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "Votre panier est vide." }, 400),
    );

    renderPayment();

    expect(
      await screen.findByText("Votre panier est vide."),
    ).toBeInTheDocument();
  });

  it("emmène à la confirmation une fois la réservation enregistrée", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ clientSecret: "cs_test", amount: 4500 }, 200),
    );

    renderPayment();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /payer/i }));

    expect(
      await screen.findByText("merci pour votre commande"),
    ).toBeInTheDocument();
  });

  it("explique la situation quand la session a disparu, au lieu de ne rien faire", async () => {
    useSessionMock.mockReturnValue(session(null));
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ clientSecret: "cs_test", amount: 4500 }, 200),
    );

    renderPayment();

    expect(
      await screen.findByText(
        "Votre session a expiré. Reconnectez-vous pour finaliser votre commande.",
      ),
    ).toBeInTheDocument();
  });

  it("ne vide plus le panier depuis le navigateur (le serveur le fait)", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ clientSecret: "cs_test", amount: 4500 }, 200),
    );

    renderPayment();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /payer/i }));
    await screen.findByText("merci pour votre commande");

    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes("/api/cart"))).toBe(false);
  });
});
