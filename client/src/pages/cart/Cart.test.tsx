import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "../../types/cart";
import Cart from "./Cart";

const ligne = (over: Partial<CartItem>): CartItem => ({
  id: 1,
  quantity: 1,
  total_price: 20,
  id_activity: 10,
  name: "Atelier poterie",
  description: "Deux heures de tour",
  start_date: "2026-10-01T00:00:00.000Z",
  end_date: "2026-10-01T00:00:00.000Z",
  time_slot_id: 1,
  slot: "Matin",
  start_hour: "9:00",
  end_hour: "12:00",
  price_unit: 20,
  id_space: 3,
  space_name: "Le Studio",
  url_image: "/uploads/poterie.png",
  line_amount: 20,
  ...over,
});

/** Réponse de `GET /api/cart` : le serveur envoie ses propres montants. */
const panier = (items: CartItem[], total: number) =>
  new Response(JSON.stringify({ items, total }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const renderCart = () =>
  render(
    <MemoryRouter>
      <Cart />
    </MemoryRouter>,
  );

describe("Cart", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche le total annoncé par le serveur, sans le recalculer", async () => {
    vi.mocked(fetch).mockResolvedValue(
      panier(
        [
          ligne({ id: 1, price_unit: 20, quantity: 2, line_amount: 40 }),
          ligne({
            id: 2,
            price_unit: 12.5,
            quantity: 1,
            line_amount: 12.5,
            name: "Coworking",
          }),
        ],
        52.5,
      ),
    );

    renderCart();

    const total = await screen.findByTestId("cart-total");
    expect(total).toHaveTextContent("52.50 €");
    expect(within(total).queryByText(/remise/i)).not.toBeInTheDocument();
  });

  it("affiche le montant d'un « Local vide » loué au mois, pas le prix mensuel", async () => {
    // 450 €/mois sur 6 mois : le serveur annonce 2700, le client l'affiche.
    // L'ancien calcul `price_unit × quantity` affichait 450.
    vi.mocked(fetch).mockResolvedValue(
      panier(
        [
          ligne({
            id: 1,
            price_unit: 450,
            quantity: 1,
            line_amount: 2700,
            name: "Local 12 m²",
          }),
        ],
        2700,
      ),
    );

    renderCart();

    expect(await screen.findByTestId("cart-total")).toHaveTextContent(
      "2700.00 €",
    );
    expect(screen.queryByText(/^450\.00 €/)).not.toBeInTheDocument();
  });

  it("n'offre plus de code promo : le montant dû est celui du serveur", async () => {
    vi.mocked(fetch).mockResolvedValue(
      panier(
        [ligne({ id: 1, price_unit: 20, quantity: 2, line_amount: 40 })],
        40,
      ),
    );

    renderCart();

    await screen.findByTestId("cart-total");
    expect(screen.queryByLabelText(/code promo/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /appliquer/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/remise/i)).not.toBeInTheDocument();
  });

  it("annonce un panier vide sans planter", async () => {
    vi.mocked(fetch).mockResolvedValue(panier([], 0));

    renderCart();

    expect(
      await screen.findByText("Votre panier est vide."),
    ).toBeInTheDocument();
  });

  it("un panier vidé côté serveur efface l'affichage", async () => {
    // Premier rendu : une ligne. Puis le serveur renvoie un panier vide
    // (article supprimé ailleurs, panier converti en réservations...).
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        panier(
          [ligne({ id: 1, price_unit: 20, quantity: 1, line_amount: 20 })],
          20,
        ),
      )
      .mockResolvedValue(panier([], 0));

    renderCart();

    await screen.findByText("Atelier poterie");

    // La suppression relit le panier : il est vide, l'écran doit le dire.
    (await screen.findByLabelText("Supprimer l'article")).click();

    await waitFor(() =>
      expect(screen.getByText("Votre panier est vide.")).toBeInTheDocument(),
    );
  });
});
