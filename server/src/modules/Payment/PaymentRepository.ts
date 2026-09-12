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
 *
 * La catégorie de l'espace et les dates de l'activité sont ramenées avec :
 * un « Local vide » se loue au mois, et son prix unitaire doit être
 * multiplié par la durée de la période (voir `amount.ts`).
 */
const readCartPriceRows = async (userId: number): Promise<CartPriceRow[]> => {
  const [rows] = await databaseClient.query<Rows>(
    `SELECT c.quantity,
            COALESCE(c.price_unit, a.price_unit) AS price_unit,
            a.start_date,
            a.end_date,
            s.space_category
       FROM cart c
       JOIN activity a ON a.id = c.id_activity
       JOIN space s ON s.id = a.space_id
      WHERE c.users_id = ?`,
    [userId],
  );

  return rows as CartPriceRow[];
};

/** Montant à facturer, en centimes, pour le panier de cet utilisateur. */
const amountForUser = async (userId: number): Promise<number> =>
  computeCartAmount(await readCartPriceRows(userId));

/**
 * `amountInCents` est déjà en centimes : aucune conversion ici.
 *
 * `metadata.userId` accompagne l'intention : au moment de réserver, le
 * serveur peut ainsi vérifier que le paiement présenté est bien celui de
 * l'utilisateur connecté, et pas celui de quelqu'un d'autre.
 */
const createPaymentIntent = async (
  amountInCents: number,
  userId: number,
): Promise<string | null> => {
  const paymentIntent = await getStripe().paymentIntents.create({
    amount: amountInCents,
    currency: "eur",
    metadata: { userId: String(userId) },
  });

  return paymentIntent.client_secret;
};

/** Intention de paiement telle que Stripe la connaît, lue à la source. */
type RetrievedIntent = {
  id: string;
  status: string;
  amount: number;
  metadata?: Record<string, string> | null;
};

/**
 * Relit une intention de paiement CHEZ STRIPE.
 *
 * C'est le seul moyen de savoir si l'argent est réellement arrivé : le
 * navigateur peut affirmer n'importe quoi, Stripe non.
 */
const retrievePaymentIntent = async (
  paymentIntentId: string,
): Promise<RetrievedIntent> =>
  (await getStripe().paymentIntents.retrieve(
    paymentIntentId,
  )) as unknown as RetrievedIntent;

export default {
  amountForUser,
  createPaymentIntent,
  readCartPriceRows,
  retrievePaymentIntent,
};
export type { RetrievedIntent };
