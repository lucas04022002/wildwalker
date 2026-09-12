/**
 * Calcul du montant à facturer, à partir des lignes de panier lues en base.
 *
 * Fonctions pures, en centimes entiers : c'est l'unité de Stripe, et cela
 * évite les surprises de l'arithmétique flottante sur les euros.
 *
 * C'est le seul endroit où se décide le prix d'une ligne de panier. Le
 * paiement (`PaymentRepository`) et la réservation (`bookingRepository`)
 * s'appuient tous les deux dessus : ils ne peuvent donc pas diverger.
 */

/** Catégorie d'espace facturée au mois et non au créneau. */
const MONTHLY_CATEGORY = "Local vide";

type DateLike = string | Date | null | undefined;

type CartPriceRow = {
  quantity: number | string | null;
  price_unit: number | string | null;
  space_category?: string | null;
  start_date?: DateLike;
  end_date?: DateLike;
};

/** Convertit une valeur MySQL (un DECIMAL revient en chaîne) en nombre sûr. */
const toNumber = (value: number | string | null | undefined): number => {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Nombre de mois entiers entre deux dates (arrondi à l'entier inférieur,
 * jamais négatif). Même règle que celle affichée au client, mais calculée
 * ici : c'est cette valeur-là qui fait foi.
 */
const monthsBetween = (start: DateLike, end: DateLike): number => {
  if (start == null || end == null) return 0;

  const from = new Date(start);
  const to = new Date(end);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;

  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());

  if (to.getDate() < from.getDate()) months -= 1;

  return Math.max(months, 0);
};

/**
 * Multiplicateur de durée d'une ligne.
 *
 * Un « Local vide » se loue au mois : son prix unitaire est mensuel, et la
 * ligne de panier porte les dates de la période. Tout le reste se facture au
 * créneau, donc une fois. Un local dont la période est plus courte qu'un mois
 * compte tout de même pour un mois plein.
 */
const billableMonths = (row: CartPriceRow): number => {
  if (row.space_category !== MONTHLY_CATEGORY) return 1;

  return Math.max(monthsBetween(row.start_date, row.end_date), 1);
};

/** Montant d'une ligne, en centimes. Une ligne aberrante vaut zéro. */
const lineAmountInCents = (row: CartPriceRow): number => {
  const quantity = Math.trunc(toNumber(row.quantity));
  const priceUnit = toNumber(row.price_unit);

  if (quantity <= 0 || priceUnit <= 0) return 0;

  return Math.round(priceUnit * 100) * quantity * billableMonths(row);
};

/** Total du panier en centimes. */
const computeCartAmount = (rows: readonly CartPriceRow[]): number =>
  rows.reduce((total, row) => total + lineAmountInCents(row), 0);

/** Le même montant, exprimé en euros à deux décimales (colonnes DECIMAL). */
const lineAmountInEuros = (row: CartPriceRow): number =>
  lineAmountInCents(row) / 100;

export {
  MONTHLY_CATEGORY,
  billableMonths,
  computeCartAmount,
  lineAmountInCents,
  lineAmountInEuros,
  monthsBetween,
};
export type { CartPriceRow, DateLike };
