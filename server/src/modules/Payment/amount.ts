/**
 * Calcul du montant à facturer, à partir des lignes de panier lues en base.
 *
 * Fonction pure, en centimes entiers : c'est l'unité de Stripe, et cela
 * évite les surprises de l'arithmétique flottante sur les euros.
 */

type CartPriceRow = {
  quantity: number | string | null;
  price_unit: number | string | null;
};

/** Convertit une valeur MySQL (un DECIMAL revient en chaîne) en nombre sûr. */
const toNumber = (value: number | string | null | undefined): number => {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Total du panier en centimes. Une ligne aberrante compte pour zéro. */
const computeCartAmount = (rows: readonly CartPriceRow[]): number =>
  rows.reduce((total, row) => {
    const quantity = Math.trunc(toNumber(row.quantity));
    const priceUnit = toNumber(row.price_unit);

    if (quantity <= 0 || priceUnit <= 0) {
      return total;
    }

    return total + Math.round(priceUnit * 100) * quantity;
  }, 0);

export { computeCartAmount };
export type { CartPriceRow };
