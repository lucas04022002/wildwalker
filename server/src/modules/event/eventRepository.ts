import type { PoolConnection } from "mysql2/promise";
import databaseLeLocal from "../../../database/client";

import type { Result, Rows } from "../../../database/client";

type Activity = {
  id: number;
  space_name: string;
  name: string;
  start_date: string;
  end_date: string;
  start_hour: string;
  end_hour: string;
  description: string;
  url_image: string;
  price_unit: number;
  creator_id: number;
};

type Participants = {
  id_activity: number;
  name: string;
  sum_participants: number;
  remaining_slots: number;
  capacity: number;
};

class EventRepository {
  async read(id: number) {
    const [rows] = await databaseLeLocal.query<Rows>(
      "select * from activity where id = ?",
      [id],
    );

    return rows[0] as Activity;
  }

  async readAllUpcomingEvents() {
    const [rows] = await databaseLeLocal.query<Rows>(
      `SELECT
      a.id,
      a.name,
      a.start_date,
      a.end_date,
      a.description,
      a.url_image,
      a.price_unit,
      a.users_id as creator_id,
      s.space_name,
      t.start_hour,
      t.end_hour,
      s.capacity
    FROM activity AS a
    INNER JOIN time_slot AS t ON a.time_slot_id = t.id
    INNER JOIN space AS s ON a.space_id = s.id
    WHERE s.space_type = 'Evenements'
    AND a.start_date >= CURRENT_DATE()
    AND a.status = 'approved'
    ORDER BY a.start_date ASC 
  `,
    );

    return rows as Activity[];
  }

  // check participants and remaining slots for all events to map them
  async browseParticipantsToEvent() {
    const [rows] = await databaseLeLocal.query<Rows>(
      `SELECT
      a.id AS id_activity, -- On s'assure de récupérer l'ID de l'activité même sans booking
      a.name,
      s.capacity,
      IFNULL(SUM(b.quantity), 0) AS sum_participants,
      (s.capacity - IFNULL(SUM(b.quantity), 0)) AS remaining_slots
    FROM activity as a
    JOIN space as s ON a.space_id = s.id
    LEFT JOIN booking as b ON b.id_activity = a.id
    WHERE s.space_type = 'Evenements'
    AND a.status = 'approved'
    GROUP BY a.id, a.name, s.capacity`,
    );

    const formattedRows = rows.map((row) => ({
      id_activity: Number(row.id_activity),
      name: row.name,
      capacity: Number(row.capacity),
      sum_participants: Number(row.sum_participants),
      remaining_slots: Number(row.remaining_slots),
    }));

    return formattedRows as Participants[];
  }

  // check remaining slots when adding to cart
  async readRemainingSlotsByEvent(
    connection: PoolConnection,
    id: number,
  ): Promise<number | null> {
    const [rows] = await connection.query<Rows>(
      `
    SELECT 
      s.capacity,
      IFNULL(SUM(b.quantity), 0) AS sum_participants,
     (s.capacity - IFNULL(SUM(b.quantity), 0)) AS remaining_slots
    FROM activity as a
    JOIN space as s ON a.space_id = s.id
    LEFT JOIN booking as b ON b.id_activity = a.id
    WHERE a.id = ?
    GROUP BY s.capacity
    FOR UPDATE
  `,
      [id],
    );

    const row = rows[0];
    if (!row) return null;

    return Number(row.remaining_slots);
  }

  /**
   * Prix et durée d'une activité, lus sous verrou dans la transaction
   * d'ajout au panier. C'est cette lecture qui fixe le montant : le total
   * envoyé par le client n'est jamais utilisé.
   */
  async readPricingForUpdate(
    connection: PoolConnection,
    activityId: number,
  ): Promise<{
    price_unit: string | number;
    start_date: string | Date;
    end_date: string | Date;
    space_category: string;
  } | null> {
    const [rows] = await connection.query<Rows>(
      `SELECT a.price_unit, a.start_date, a.end_date, s.space_category
         FROM activity a
         JOIN space s ON s.id = a.space_id
        WHERE a.id = ?
        FOR UPDATE`,
      [activityId],
    );

    const row = rows[0];
    if (!row) return null;

    return row as {
      price_unit: string | number;
      start_date: string | Date;
      end_date: string | Date;
      space_category: string;
    };
  }

  async browseEventsOfTheDay(date: string) {
    const [rows] = await databaseLeLocal.query<Rows>(
      `SELECT
      a.id,
      a.name,
      a.start_date,
      a.end_date,
      a.description,
      a.url_image,
      a.price_unit,
       a.users_id as creator_id,
      s.space_name,
      t.start_hour,
      t.end_hour,
      s.capacity
    FROM activity AS a
    INNER JOIN time_slot AS t ON a.time_slot_id = t.id
    INNER JOIN space AS s ON a.space_id = s.id
    WHERE s.space_type = 'Evenements'
    AND a.status = 'approved'
    AND a.start_date = ?
    ORDER BY t.start_hour ASC  `,
      [date],
    );
    return rows as Activity[];
  }

  async processTotalPrice(quantity: number, id: number) {
    const [rows] = await databaseLeLocal.query<Rows>(
      `SELECT
      a.id,
      a.price_unit,
(? * a.price_unit) AS total_price
    FROM activity AS a
    INNER JOIN time_slot AS t ON a.time_slot_id = t.id
    INNER JOIN space AS s ON a.space_id = s.id
    WHERE a.id = ?
    AND s.space_type = 'Evenements'
    AND a.status = 'approved'`,
      [quantity, id],
    );

    const row = rows[0];
    if (!row) return null;

    return Number(row.total_price);
  }
}
export default new EventRepository();
