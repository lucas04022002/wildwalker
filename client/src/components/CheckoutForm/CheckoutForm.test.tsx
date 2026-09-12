import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutForm from "./CheckoutForm";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const confirmPayment = vi.hoisted(() =>
  vi.fn(async () => ({
    error: undefined as { message?: string } | undefined,
    paymentIntent: { id: "pi_test_123" } as { id: string } | undefined,
  })),
);

vi.mock("@stripe/react-stripe-js", () => ({
  PaymentElement: () => <div data-testid="carte-bancaire" />,
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}));

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const pay = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /payer/i }));
};

describe("CheckoutForm", () => {
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    onSuccess.mockClear();
    confirmPayment.mockResolvedValue({
      error: undefined,
      paymentIntent: { id: "pi_test_123" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enregistre la réservation puis prévient la page quand tout réussit", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ created: 2 }, 201));

    render(<CheckoutForm totalPrice={45} onSuccess={onSuccess} />);
    await pay();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}/api/booking`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("transmet la référence de l'intention de paiement au serveur", async () => {
    // Sans elle, le serveur n'a aucune preuve que la carte a été débitée :
    // c'est cette référence qu'il relit chez Stripe.
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ created: 1 }, 201));

    render(<CheckoutForm totalPrice={45} onSuccess={onSuccess} />);
    await pay();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      paymentIntentId: "pi_test_123",
    });
  });

  it("un refus de paiement (402) prévient sans écran de confirmation", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "Paiement non confirmé" }, 402),
    );

    render(<CheckoutForm totalPrice={45} onSuccess={onSuccess} />);
    await pay();

    expect(
      await screen.findByText(
        "Paiement encaissé mais réservation non enregistrée : contactez-nous en indiquant votre e-mail.",
      ),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("prévient l'utilisateur si le paiement passe mais pas la réservation", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ message: "Votre panier est vide." }, 400),
    );

    render(<CheckoutForm totalPrice={45} onSuccess={onSuccess} />);
    await pay();

    expect(
      await screen.findByText(
        "Paiement encaissé mais réservation non enregistrée : contactez-nous en indiquant votre e-mail.",
      ),
    ).toBeInTheDocument();
    // Surtout pas d'écran de confirmation : rien n'a été réservé.
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("prévient de la même façon si le réseau tombe après le paiement", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    render(<CheckoutForm totalPrice={45} onSuccess={onSuccess} />);
    await pay();

    expect(
      await screen.findByText(
        "Paiement encaissé mais réservation non enregistrée : contactez-nous en indiquant votre e-mail.",
      ),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("rend la main quoi qu'il arrive (le bouton ne reste pas bloqué)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    render(<CheckoutForm totalPrice={45} onSuccess={onSuccess} />);
    await pay();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /payer/i })).toBeEnabled(),
    );
  });

  it("affiche l'erreur de Stripe et n'appelle pas l'API de réservation", async () => {
    confirmPayment.mockResolvedValue({
      error: { message: "Carte refusée." },
      paymentIntent: undefined,
    });

    render(<CheckoutForm totalPrice={45} onSuccess={onSuccess} />);
    await pay();

    expect(await screen.findByText("Carte refusée.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
