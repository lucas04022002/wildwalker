import { useEffect, useState } from "react";
import type { CartItem } from "../types/cart";
import { apiFetch } from "./apiFetch";

/**
 * Panier de l'utilisateur connecté.
 *
 * Aucun identifiant dans l'URL : le serveur lit celui de la session. Un
 * panier ne peut donc plus être consulté en changeant un numéro dans l'URL.
 */
function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    apiFetch("/api/cart", { method: "GET" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCart(Array.isArray(data) ? data : []))
      .catch(() => setCart([]));
  }, []);

  return cart;
}

export default useCart;
