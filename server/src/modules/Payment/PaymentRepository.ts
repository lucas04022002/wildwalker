import Stripe from "stripe";
import databaseClient from "../../../database/client";
import type { Rows } from "../../../database/client";
import { type CartPriceRow, computeCartAmount } from "./amount";

/**
 * Stripe est instancié à la première utilisation : le module peut être
 * importé (tests, outillage) sans exiger `STRIPE_SECRET_KEY`.
 */
let stripeClient: Stripe | null = null;

const getStripe = (): Stripe => {
  if (stripeClient == null) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }

  return stripeClient;
};

/**
 * Lignes de panier d'un utilisateur, jointes au prix enregistré en base.
 *
 * `cart.price_unit` porte le prix effectif posé par le serveur au moment de
 * la réservation (majoration « Journée » comprise) ; il n'est écrit que par
 * le serveur. À défaut, on retombe sur le prix de l'activité.
 */
const readCartPriceRows = async (userId: number): Promise<CartPriceRow[]> => {
  const [rows] = await databaseClient.query<Rows>(
    `SELECT c.quantity, COALESCE(c.price_unit, a.price_unit) AS price_unit
       FROM cart c
       JOIN activity a ON a.id = c.id_activity
      WHERE c.users_id = ?`,
    [userId],
  );

  return rows as CartPriceRow[];
};

/** Montant à facturer, en centimes, pour le panier de cet utilisateur. */
const amountForUser = async (userId: number): Promise<number> =>
  computeCartAmount(await readCartPriceRows(userId));

/** `amountInCents` est déjà en centimes : aucune conversion ici. */
const createPaymentIntent = async (amountInCents: number) => {
  const paymentIntent = await getStripe().paymentIntents.create({
    amount: amountInCents,
    currency: "eur",
  });

  return paymentIntent.client_secret;
};

export default { amountForUser, createPaymentIntent, readCartPriceRows };
