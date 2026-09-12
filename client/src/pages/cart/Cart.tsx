import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import "./Cart.css";
import { Link } from "react-router";
import { apiFetch } from "../../hooks/apiFetch";
import useCart from "../../hooks/useCart";
import type { CartItem } from "../../types/cart";

const PROMO_CODES: Record<string, number> = {
  PROMO10: 10,
  PROMO15: 15,
};

const formatHour = (hour: string) => {
  const [hours, minutes = "00"] = hour.split(":");
  return `${hours.padStart(2, "0")}:${minutes}`;
};

function Cart() {
  const cart = useCart();
  const [carts, setCarts] = useState<CartItem[]>(cart);
  const [message, setMessage] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState("");

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();

    if (PROMO_CODES[code]) {
      const percentage = PROMO_CODES[code];
      setDiscount(percentage);
      setPromoMessage(`Code appliqué : -${percentage}%`);
    } else {
      setDiscount(0);
      setPromoMessage("Code invalide");
    }
  };

  const totalPrice = carts.reduce(
    (total, item) => total + Number(item.price_unit) * item.quantity,
    0,
  );

  const discountAmount = (totalPrice * discount) / 100;
  const discountedTotal = totalPrice - discountAmount;
  useEffect(() => {
    if (cart.length > 0) {
      setCarts(cart);
    }
  }, [cart]);

  useEffect(() => {
    console.log(carts);
  }, [carts]);

  const increaseQuantity = async (id: number) => {
    const item = carts.find((i) => i.id === id);
    if (!item) return;

    const newQuantity = item.quantity + 1;

    try {
      await apiFetch(`/api/cart/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      setCarts((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                quantity: newQuantity,
              }
            : i,
        ),
      );
    } catch (error) {
      console.error("Erreur augmentation quantité :", error);
    }
  };

  const decreaseQuantity = async (id: number) => {
    const item = carts.find((i) => i.id === id);
    if (!item || item.quantity <= 1) return;

    const newQuantity = item.quantity - 1;

    try {
      await apiFetch(`/api/cart/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      setCarts((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                quantity: newQuantity,
              }
            : i,
        ),
      );
    } catch (error) {
      console.error("Erreur diminution quantité :", error);
    }
  };

  const deleteItem = async (id: number) => {
    try {
      await apiFetch(`/api/cart/${id}`, {
        method: "DELETE",
      });

      setCarts((prev) => prev.filter((item) => item.id !== id));
      setMessage("Article supprimé");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Erreur suppression :", error);
    }
  };

  if (carts.length === 0) {
    return (
      <section className="cart-page">
        <p className="cart-empty">Votre panier est vide.</p>
      </section>
    );
  }

  return (
    <section className="cart-page">
      <section className="cart-items-list">
        {carts.map((item) => (
          <article key={item.id} className="cart-item-card">
            <img
              src={
                item.url_image.startsWith("http")
                  ? item.url_image
                  : `${import.meta.env.VITE_API_URL}${item.url_image}`
              }
              alt={item.space_name}
              className="cart-item-image"
            />
            <div className="cart-item-content">
              <div className="cart-item-header">
                <div>
                  <p className="cart-space-name">{item.space_name}</p>
                  <h2 className="cart-activity-title">{item.name}</h2>
                </div>

                <button
                  type="button"
                  className="cart-delete-button"
                  onClick={() => deleteItem(item.id)}
                  aria-label="Supprimer l'article"
                >
                  <Trash2 />
                </button>
              </div>

              <p className="cart-activity-description">{item.description}</p>

              <div className="cart-item-footer">
                <div className="cart-item-informations">
                  <span>
                    {new Date(item.start_date).toLocaleDateString("fr-FR")}
                  </span>

                  <span>
                    Créneau : {item.slot} ({formatHour(item.start_hour)} -{" "}
                    {formatHour(item.end_hour)})
                  </span>
                </div>

                <div className="cart-item-actions">
                  <div className="cart-quantity-selector">
                    <button
                      type="button"
                      onClick={() => decreaseQuantity(item.id)}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => increaseQuantity(item.id)}
                    >
                      +
                    </button>
                  </div>

                  <span className="cart-item-price">
                    {(Number(item.price_unit) * item.quantity).toFixed(2)} €{" "}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <aside className="cart-summary">
        <div className="cart-summary-card">
          <h2>Récapitulatif</h2>

          <div className="cart-summary-row">
            <span>Sous-total</span>
            <span>{totalPrice.toFixed(2)} €</span>
          </div>

          {discount > 0 && (
            <div className="cart-summary-row cart-summary-discount">
              <span>Remise -{discount}%</span>
              <span>-{discountAmount.toFixed(2)} €</span>
            </div>
          )}

          <div className="cart-summary-total">
            <span>Total TTC</span>
            <span>{discountedTotal.toFixed(2)} €</span>
          </div>

          <div className="cart-promo-section">
            <label htmlFor="promo">Code promo</label>

            <div className="cart-promo-field">
              <input
                id="promo"
                type="text"
                placeholder="Saisissez votre code..."
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyPromo()}
              />
              <button type="button" onClick={applyPromo}>
                Appliquer
              </button>
            </div>

            {promoMessage && (
              <p
                className={
                  discount > 0 ? "cart-promo-success" : "cart-promo-error"
                }
              >
                {promoMessage}
              </p>
            )}
          </div>

          {/* Aucun montant ni panier transmis : la page de paiement demande
              le total au serveur, qui le calcule depuis le panier en base. */}
          <Link to="/payment">
            <button type="button" className="cart-payment-button">
              Procéder au paiement
            </button>
          </Link>
        </div>
        {message && <p className="cart-notification">{message}</p>}
      </aside>
    </section>
  );
}

export default Cart;
