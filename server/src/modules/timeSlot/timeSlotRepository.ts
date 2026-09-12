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
  // The C of CRUD - Create operation
  /* 
  async create(time_slot: Omit<TimeSlot, "id">) {
    // Execute the SQL INSERT query to add a new item to the "item" table
    const [result] = await databaseLeLocal.query<Result>(
      "insert into item (title, user_id) values (?, ?)",
      [time_slot.time_slot_name, time_slot.id],
    );

    // Return the ID of the newly inserted item
    return result.insertId;
  } */

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

  // The U of CRUD - Update operation
  // TODO: Implement the update operation to modify an existing item

  // async update(item: Item) {
  //   ...
  // }

  // The D of CRUD - Delete operation
  // TODO: Implement the delete operation to remove an item by its ID

  // async delete(id: number) {
  //   ...
  // }
}

export default new TimeSlotRepository();
