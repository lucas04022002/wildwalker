/**
 * Corps de `POST /api/cart`.
 *
 * Ni `users_id` ni `total_price` : le serveur prend le premier dans le cookie
 * de session et calcule le second à partir du prix en base.
 */
export type CartItem = {
  event_id: number;
  quantity: number;
  last_name?: string;
  first_name?: string;
  email?: string;
};
