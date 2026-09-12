import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

/**
 * Une connexion "Queryable" peut être soit le pool global, soit une
 * connexion dédiée (utilisée dans une transaction).
 */
type Queryable = Pool | PoolConnection;

/**
 * Numéro de facture : `<année>-<n>`, compté sur la table `booking`.
 *
 * Logique partagée entre le paiement du panier (`bookingActions/bookingRepository.ts`,
 * dans une transaction) et la création d'une réservation depuis une demande
 * d'événement approuvée par un admin (`dashboardAdmin/dashboardAdminRepository.ts`,
 * hors transaction) : les deux comptaient déjà `<année>-%` de façon identique.
 */
const nextBillsNumber = async (
  connection: Queryable,
  year: number,
): Promise<string> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM booking WHERE bills_number LIKE ?",
    [`${year}-%`],
  );

  const count = Number((rows as { count: number }[])[0].count);

  return `${year}-${count + 1}`;
};

export default { nextBillsNumber };
