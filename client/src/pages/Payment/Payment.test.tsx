import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Payment from "./Payment";

const API_URL = import.meta.env.VITE_API_URL ?? "";

// Stripe n'est pas joignable en test : le formulaire de carte est remplacé
// par un repère, ce qui laisse la page elle-même sous test.
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: () => Promise.resolve(null),
}));
vi.mock("../../components/CheckoutForm/CheckoutForm", () => ({
  default: ({ totalPrice }: { totalPrice: number }) => (
    <p data-testid="bouton-payer">Payer {totalPrice.toFixed(2)} €</p>
  ),
}));

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const renderPayment = () =>
  render(
    <MemoryRouter>
      <Payment />
    </MemoryRouter>,
  );

describe("Payment", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(screen.getByTestId("bouton-payer")).toHaveTextContent("45.00 €");
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
});
