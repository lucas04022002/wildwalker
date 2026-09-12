import { render, screen, within } from "@testing-library/react";
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
  ...over,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
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

  it("affiche un total égal à la somme des lignes", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([
        ligne({ id: 1, price_unit: 20, quantity: 2 }),
        ligne({ id: 2, price_unit: 12.5, quantity: 1, name: "Coworking" }),
      ]),
    );

    renderCart();

    // 20 × 2 + 12,50 = 52,50 € — le même calcul que celui du serveur.
    const total = await screen.findByTestId("cart-total");
    expect(total).toHaveTextContent("52.50 €");
    expect(within(total).queryByText(/remise/i)).not.toBeInTheDocument();
  });

  it("n'offre plus de code promo : le montant dû est celui du serveur", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([ligne({ id: 1, price_unit: 20, quantity: 2 })]),
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
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    renderCart();

    expect(
      await screen.findByText("Votre panier est vide."),
    ).toBeInTheDocument();
  });
});
