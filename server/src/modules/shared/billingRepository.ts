import type { PoolConnection, RowDataPacket } from "mysql2/promise";

/**
 * Numéro de facture : `<année>-<n>`, servi par le compteur dédié
 * `invoice_counter` (migration 0002).
 *
 * L'ancienne version comptait les lignes de `booking` dont le
 * `bills_number` commençait par l'année, puis ajoutait 1. Trois défauts,
 * tous silencieux :
 *
 *   1. deux paiements simultanés lisaient le même compte et émettaient DEUX
 *      FOIS le même numéro de facture ;
 *   2. supprimer une réservation faisait revenir un numéro déjà utilisé ;
 *   3. le `COUNT(*)` balayait la table, de plus en plus lentement.
 *
 * L'upsert ci-dessous incrémente sous verrou de ligne ; la lecture qui suit
 * a lieu dans la MÊME transaction, donc derrière ce verrou. D'où la
 * signature : une `PoolConnection`, pas le pool. Avec le pool, les deux
 * requêtes pourraient partir sur deux connexions différentes — et le verrou
 * ne servirait plus à rien.
 */
const nextBillsNumber = async (
  connection: PoolConnection,
  year: number,
): Promise<string> => {
  await connection.query(
    "INSERT INTO invoice_counter (`year`, `last`) VALUES (?, 1) ON DUPLICATE KEY UPDATE `last` = `last` + 1",
    [year],
  );

  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT `last` FROM invoice_counter WHERE `year` = ?",
    [year],
  );

  return `${year}-${Number(rows[0].last)}`;
};

export default { nextBillsNumber };
