import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "../types/cart";
import { apiFetch } from "./apiFetch";

/**
 * Panier de l'utilisateur connecté, tel que le serveur le calcule.
 *
 * Aucun identifiant dans l'URL : le serveur lit celui de la session. Un
 * panier ne peut donc plus être consulté en changeant un numéro dans l'URL.
 *
 * Les montants ne sont PAS recalculés ici : `line_amount` et `total`
 * viennent du serveur, qui applique la même règle qu'au paiement (un
 * « Local vide » se loue au mois). L'écran affichait sinon un montant plus
 * bas que celui débité.
 */
type CartState = {
  items: CartItem[];
  total: number;
  loading: boolean;
};

const EMPTY: CartState = { items: [], total: 0, loading: true };

function useCart() {
  const [cart, setCart] = useState<CartState>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/cart", { method: "GET" });
      const data = res.ok ? await res.json() : null;

      // Un panier vide est un état à part entière : il doit effacer
      // l'affichage, pas laisser les lignes précédentes en place.
      setCart({
        items: Array.isArray(data?.items) ? data.items : [],
        total: Number(data?.total ?? 0),
        loading: false,
      });
    } catch {
      setCart({ items: [], total: 0, loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...cart, refresh };
}

export default useCart;
export type { CartState };
