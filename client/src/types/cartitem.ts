/**
 * Corps de `POST /api/cart`.
 *
 * Distinct de `CartItem` (types/cart.ts), qui décrit une ligne de panier LUE
 * depuis l'API : deux formes différentes ne doivent pas porter le même nom.
 * Ni `users_id` ni `total_price` ici : le serveur prend le premier dans le
 * cookie de session et calcule le second à partir du prix en base.
 */
export type CartItemPayload = {
  event_id: number;
  quantity: number;
  last_name?: string;
  first_name?: string;
  email?: string;
};
