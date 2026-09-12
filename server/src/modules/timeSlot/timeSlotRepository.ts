import type { PoolConnection } from "mysql2/promise";
import databaseLeLocal from "../../../database/client";

import type { Rows } from "../../../database/client";

type TimeSlot = {
  id: number;
  slot: string;
  start_hour: string;
  end_hour: string;
};

class TimeSlotRepository {
  // The Rs of CRUD - Read operations

  async read(id: number) {
    // Execute the SQL SELECT query to retrieve a specific item by its ID
    const [rows] = await databaseLeLocal.query<Rows>(
      "select * from item where id = ?",
      [id],
    );

    // Return the first row of the result, which represents the item
    return rows[0] as TimeSlot;
  }

  async readAll() {
    // Execute the SQL SELECT query to retrieve all items from the "item" table
    const [rows] = await databaseLeLocal.query<Rows>("select * from time_slot");

    // Return the array of items
    return rows as TimeSlot[];
  }

  /**
   * Lit un créneau depuis la connexion en cours (donc à l'intérieur de la
   * transaction de réservation) : c'est cette lecture qui décide de la
   * majoration « Journée », côté serveur.
   */
  async readForBooking(
    connection: PoolConnection,
    id: number,
  ): Promise<TimeSlot | null> {
    const [rows] = await connection.query<Rows>(
      "SELECT id, slot, start_hour, end_hour FROM time_slot WHERE id = ?",
      [id],
    );

    return (rows[0] as TimeSlot) ?? null;
  }

  // Les créneaux sont des données de référence : ils sont posés par la
  // migration et le seed, et aucune route ne les modifie. Pas d'`update` ni
  // de `delete` ici — les deux TODO du gabarit sont retirés plutôt que
  // laissés à traîner comme une dette imaginaire.
}

export default new TimeSlotRepository();
