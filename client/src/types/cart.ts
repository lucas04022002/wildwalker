export type CartItem = {
  id: number;
  quantity: number;
  total_price: number;
  id_activity: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  time_slot_id: number;
  slot: string;
  start_hour: string;
  end_hour: string;
  price_unit: number;
  id_space: number;
  space_name: string;
  url_image: string;
  /**
   * Montant de la ligne en euros, calculé par le serveur (`amount.ts`).
   * Le client ne le recalcule jamais : un « Local vide » se loue au mois,
   * et `price_unit × quantity` sous-facturerait la location.
   */
  line_amount: number;
};
