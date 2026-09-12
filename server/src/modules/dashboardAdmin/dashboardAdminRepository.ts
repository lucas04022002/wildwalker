import databaseClient from "../../../database/client";
import type { Rows } from "../../../database/client";
import billingRepository from "../shared/billingRepository";

type Booking = {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  space_name: string;
  space_type: string;
  start_date: string;
  end_date: string;
  start_hour: string;
  end_hour: string;
  total_price: number;
  quantity: number;
};

type AdminStats = {
  occupancy_rate: number;
  bookings_count: number;
  active_members: number;
  claims_count: number;
};

type OccupancyTrendPoint = {
  day: string;
  rate: number;
};

type AdminClaimNotification = {
  id: number;
  title: string;
  detail: string;
  variant: "warning";
};

type Claim = {
  id: number;
  title: string;
  category: string;
  message: string;
  claim_date: string;
  firstname: string;
  lastname: string;
};

class DashboardAdminRepository {
  async readAdminStats(date: string) {
    const [rows] = await databaseClient.query<Rows>(
      `SELECT
        (
          SELECT ROUND(
            COUNT(
              DISTINCT CONCAT(a.space_id, '-', a.time_slot_id, '-', a.start_date)
            ) * 100 / NULLIF(
              (
                SELECT
                  COUNT(*) * (SELECT COUNT(*) FROM time_slot)
                FROM space
                WHERE space_type IN ('Coworking', 'Ateliers')
              ),
              0
            )
          )
          FROM booking b
          JOIN activity a ON b.id_activity = a.id
          JOIN space s ON a.space_id = s.id
          WHERE s.space_type IN ('Coworking', 'Ateliers')
          AND a.start_date = ?
        ) AS occupancy_rate,
        (
          SELECT COUNT(*)
          FROM booking b
          JOIN activity a ON b.id_activity = a.id
          WHERE a.start_date = ?
        ) AS bookings_count,
        (
          SELECT COUNT(DISTINCT b.users_id)
          FROM booking b
          JOIN activity a ON b.id_activity = a.id
          JOIN users u ON b.users_id = u.id
          WHERE a.start_date = ?
          AND u.role = 'client'
        ) AS active_members,
        (
          SELECT COUNT(*)
          FROM claim
          WHERE claim_date = ?
        ) AS claims_count`,
      [date, date, date, date],
    );
    return rows[0] as AdminStats;
  }

  async readAdminOccupancyTrend(date: string) {
    const [rows] = await databaseClient.query<Rows>(
      `WITH RECURSIVE dates AS (
        SELECT DATE_SUB(?, INTERVAL 6 DAY) AS selected_day
        UNION ALL
        SELECT DATE_ADD(selected_day, INTERVAL 1 DAY)
        FROM dates
        WHERE selected_day < DATE(?)
      )
      SELECT
        DATE_FORMAT(dates.selected_day, '%d/%m') AS day,
        COALESCE(
          ROUND(
            COUNT(
              DISTINCT CONCAT(a.space_id, '-', a.time_slot_id, '-', a.start_date)
            ) * 100 / NULLIF(
              (
                SELECT COUNT(*) * (SELECT COUNT(*) FROM time_slot)
                FROM space
                WHERE space_type IN ('Coworking', 'Ateliers')
              ),
              0
            )
          ),
          0
        ) AS rate
      FROM dates
      LEFT JOIN activity a ON a.start_date = dates.selected_day
      LEFT JOIN space s ON a.space_id = s.id
      LEFT JOIN booking b ON b.id_activity = a.id
      WHERE s.space_type IN ('Coworking', 'Ateliers') OR s.space_type IS NULL
      GROUP BY dates.selected_day
      ORDER BY dates.selected_day ASC`,
      [date, date],
    );

    return rows as OccupancyTrendPoint[];
  }

  async readAdminClaimNotifications() {
    const [rows] = await databaseClient.query<Rows>(
      `SELECT
        c.id,
        CONCAT('Réclamation: ', c.title) AS title,
        CONCAT(c.category, ' • ', c.claim_date) AS detail,
        'warning' AS variant
      FROM claim c
      ORDER BY c.id DESC`,
    );
    return rows as AdminClaimNotification[];
  }

  async readAdminBookings() {
    const [rows] = await databaseClient.query<Rows>(
      `SELECT 
        b.id,
        a.name,
        u.firstname,
        u.lastname,
        s.space_name,
        s.space_type,
        a.start_date,
        a.end_date,
        t.start_hour,
        t.end_hour,
        b.total_price,
        b.quantity
      FROM booking b
      JOIN activity a ON b.id_activity = a.id
      JOIN users u ON b.users_id = u.id
      JOIN space s ON a.space_id = s.id
      JOIN time_slot t ON a.time_slot_id = t.id
      ORDER BY a.start_date ASC, t.start_hour ASC`,
    );
    return rows as Booking[];
  }

  async readAllClaims() {
    const [rows] = await databaseClient.query<Rows>(
      `SELECT
        c.id,
        c.title,
        c.category,
        c.message,
        c.claim_date,
        u.firstname,
        u.lastname
      FROM claim c
      JOIN users u ON c.users_id = u.id
      ORDER BY c.claim_date DESC`,
    );
    return rows as Claim[];
  }

  async readAllEventRequests() {
    const [rows] = await databaseClient.query<Rows>(
      `SELECT
        a.id,
        a.name,
        a.description,
        a.start_date,
        a.end_date,
        a.status,
        s.space_name,
        t.start_hour,
        t.end_hour,
        u.firstname,
        u.lastname
      FROM activity a
      JOIN space s ON a.space_id = s.id
      JOIN time_slot t ON a.time_slot_id = t.id
      JOIN users u ON a.users_id = u.id
      WHERE s.space_type = 'Evenements'
      AND a.status IN ('pending', 'refused')
      ORDER BY a.start_date DESC`,
    );
    return rows;
  }

  async updateEventRequestStatus(
    activityId: number,
    status: "approved" | "refused",
  ) {
    await databaseClient.query("UPDATE activity SET status = ? WHERE id = ?", [
      status,
      activityId,
    ]);
  }

  async createBookingForRequest(activityId: number, userId: number) {
    const year = new Date().getFullYear();

    const [priceRows] = await databaseClient.query<Rows>(
      `SELECT s.price_unit FROM activity a 
     JOIN space s ON a.space_id = s.id 
     WHERE a.id = ?`,
      [activityId],
    );
    const priceUnit = (priceRows[0] as { price_unit: number }).price_unit;

    const billsNumber = await billingRepository.nextBillsNumber(
      databaseClient,
      year,
    );

    await databaseClient.query(
      `INSERT INTO booking (users_id, bills_number, quantity, total_price, id_activity, payment_status)
     VALUES (?, ?, 1, ?, ?, 'pending')`,
      [userId, billsNumber, priceUnit, activityId],
    );
  }

  async getEventRequest(activityId: number) {
    const [rows] = await databaseClient.query<Rows>(
      "SELECT id, users_id FROM activity WHERE id = ?",
      [activityId],
    );
    return rows[0] as { id: number; users_id: number };
  }
}

export default new DashboardAdminRepository();
