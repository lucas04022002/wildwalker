import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import databaseLeLocal from "../../../database/client";
import {
  type CartPriceRow,
  MONTHLY_CATEGORY,
  lineAmountInEuros,
} from "../Payment/amount";
import billingRepository from "../shared/billingRepository";
import spaceRepository from "../space/spaceRepository";

type CartLine = CartPriceRow & {
  id: number;
  quantity: number;
  id_activity: number;
  space_id: number;
  time_slot_id: number;
  capacity: number;
};

/**
 * Panier devenu infaisable entre sa constitution et le paiement : la place
 * a été prise entre-temps. Porte un `status` pour que l'action réponde 409
 * plutôt que 500 — ce n'est pas une panne, c'est un refus métier.
 */
class CapacityExceededError extends Error {
  readonly status = 409;
  readonly available: number;

  constructor(available: number) {
    super(
      available > 0
        ? `Plus que ${available} place${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""} pour ce créneau`
        : "Plus aucune place disponible pour ce créneau",
    );
    this.name = "CapacityExceededError";
    this.available = available;
  }
}

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
            c.id_activity,
            a.start_date,
            a.end_date,
            a.space_id,
            a.time_slot_id,
            s.space_category,
            s.capacity
       FROM cart c
       JOIN activity a ON a.id = c.id_activity
       JOIN space s ON s.id = a.space_id
      WHERE c.users_id = ?
      FOR UPDATE`,
    [userId],
  );

  return rows as CartLine[];
};

/**
 * Refuse la ligne si la capacité de l'espace est dépassée.
 *
 * `countBookedSeats` compte le panier ET les réservations : la ligne en
 * cours de conversion s'y compte elle-même, on la retire donc du total. Un
 * « Local vide » se réserve par période, pas par place : la règle des
 * chevauchements le couvre ailleurs, la capacité ne s'y applique pas.
 */
const assertStillAvailable = async (
  connection: PoolConnection,
  line: CartLine,
  quantity: number,
): Promise<void> => {
  if (line.space_category === MONTHLY_CATEGORY) return;
  if (line.space_id == null || line.start_date == null) return;

  const bookingDate = new Date(line.start_date).toISOString().slice(0, 10);

  const booked = await spaceRepository.countBookedSeats(
    connection,
    Number(line.space_id),
    bookingDate,
    Number(line.time_slot_id),
  );

  const available = Math.max(Number(line.capacity) - (booked - quantity), 0);

  if (quantity > available) {
    throw new CapacityExceededError(available);
  }
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
      const quantity = Number(line.quantity ?? 0);

      // Dernier contrôle de capacité, à l'instant de l'écriture. Le panier
      // a pu être constitué il y a une heure : la place n'est réservée qu'au
      // moment où la réservation est écrite, pas avant.
      await assertStillAvailable(connection, line, quantity);

      // Même règle de prix que le paiement : quantité, et durée en mois pour
      // les locaux loués au mois. Un écart ici facturerait autre chose que ce
      // que Stripe a encaissé.
      const totalPrice = lineAmountInEuros(line);
      const billsNumber = await billingRepository.nextBillsNumber(
        connection,
        year,
      );

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
export { CapacityExceededError };
export type { CartLine };
