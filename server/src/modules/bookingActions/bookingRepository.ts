import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import databaseLeLocal from "../../../database/client";

type CartLine = {
  id: number;
  quantity: number;
  price_unit: number | string | null;
  id_activity: number;
};

/**
 * Transforme le panier d'un utilisateur en réservations.
 *
 * Rien ne vient du client : ni l'identifiant de l'utilisateur (il vient du
 * jeton, via l'action), ni les prix (relus en base). Le tout dans une
 * transaction, les lignes du panier verrouillées par `FOR UPDATE` : deux
 * paiements simultanés ne peuvent pas créer deux fois les mêmes
 * réservations.
 */
const readCartForUpdate = async (
  connection: PoolConnection,
  userId: number,
): Promise<CartLine[]> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT c.id,
            c.quantity,
            COALESCE(c.price_unit, a.price_unit) AS price_unit,
            c.id_activity
       FROM cart c
       JOIN activity a ON a.id = c.id_activity
      WHERE c.users_id = ?
      FOR UPDATE`,
    [userId],
  );

  return rows as CartLine[];
};

/** Numéro de facture : `<année>-<n>`, compté dans la transaction courante. */
const nextBillsNumber = async (
  connection: PoolConnection,
  year: number,
): Promise<string> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM booking WHERE bills_number LIKE ?",
    [`${year}-%`],
  );

  const count = Number((rows as { count: number }[])[0].count);

  return `${year}-${count + 1}`;
};

/**
 * Crée les réservations du panier de `userId` et vide le panier.
 * Retourne le nombre de réservations créées.
 */
const createFromCart = async (userId: number): Promise<number> => {
  const connection = await databaseLeLocal.getConnection();

  try {
    await connection.beginTransaction();

    const lines = await readCartForUpdate(connection, userId);

    if (lines.length === 0) {
      await connection.rollback();
      return 0;
    }

    const year = new Date().getFullYear();

    for (const line of lines) {
      const priceUnit = Number(line.price_unit ?? 0);
      const quantity = Number(line.quantity ?? 0);
      const totalPrice = Math.round(priceUnit * quantity * 100) / 100;
      const billsNumber = await nextBillsNumber(connection, year);

      await connection.query(
        `INSERT INTO booking (users_id, bills_number, quantity, total_price, id_activity)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, billsNumber, quantity, totalPrice, line.id_activity],
      );
    }

    await connection.query("DELETE FROM cart WHERE users_id = ?", [userId]);

    await connection.commit();

    return lines.length;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export default { createFromCart };
export type { CartLine };
