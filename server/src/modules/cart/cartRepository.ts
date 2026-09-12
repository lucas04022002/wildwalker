import type { ResultSetHeader, RowDataPacket } from "mysql2";
// Une connexion "Queryable" peut être soit le pool global, soit une connexion dédiée (utilisée dans une transaction, ex: readForUpdate)
import type { PoolConnection } from "mysql2/promise";
import databaseClient from "../../../database/client";

type CartItem = {
  users_id: number;
  id_activity: number;
  quantity: number;
  total_price: number;
};

const readAll = async (userId: number) => {
  const [rows] = await databaseClient.query<RowDataPacket[]>(
    `
    SELECT
      c.id,
      c.quantity,
      c.total_price,
      COALESCE(c.price_unit, a.price_unit) AS price_unit,
      a.id AS id_activity,
      a.name,
      a.description,
      a.start_date,
      a.end_date,
      a.time_slot_id,
      ts.slot,
      ts.start_hour,
      ts.end_hour,
      s.id AS id_space,
      s.space_name,
      s.url_image,
      s.capacity,
      s.space_type,
      s.space_category

    FROM cart c

    JOIN activity a
      ON c.id_activity = a.id

    JOIN space s
      ON a.space_id = s.id

    JOIN time_slot ts
      ON a.time_slot_id = ts.id

    WHERE c.users_id = ?
    `,
    [userId],
  );

  return rows;
};

const create = async (
  connection: PoolConnection,
  item: Omit<CartItem, "id">,
) => {
  const [existing] = await connection.query<RowDataPacket[]>(
    "SELECT id, quantity FROM cart WHERE users_id = ? AND id_activity = ?",
    [item.users_id, item.id_activity],
  );

  if (existing.length > 0) {
    const newQuantity = existing[0].quantity + item.quantity;
    await connection.query<ResultSetHeader>(
      "UPDATE cart SET quantity = ? WHERE id = ?",
      [newQuantity, existing[0].id],
    );
    return existing[0].id;
  }

  const [result] = await connection.query<ResultSetHeader>(
    "INSERT INTO cart (users_id, id_activity, quantity, total_price) VALUES (?, ?, ?, ?)",
    [item.users_id, item.id_activity, item.quantity, item.total_price],
  );

  return result.insertId;
};

/**
 * Les mutations filtrent toujours sur le propriétaire de la ligne : le
 * `users_id` vient du jeton, jamais de l'URL. Zéro ligne touchée signifie
 * « pas à vous » aussi bien que « n'existe pas », et la réponse est la même
 * (404) dans les deux cas : rien ne fuit sur l'existence de la ligne.
 */
const updateQuantity = async (
  cartItemId: number,
  userId: number,
  quantity: number,
) => {
  const [result] = await databaseClient.query<ResultSetHeader>(
    "UPDATE cart SET quantity = ? WHERE id = ? AND users_id = ?",
    [quantity, cartItemId, userId],
  );

  return result.affectedRows;
};

const destroy = async (cartItemId: number, userId: number) => {
  const [result] = await databaseClient.query<ResultSetHeader>(
    "DELETE FROM cart WHERE id = ? AND users_id = ?",
    [cartItemId, userId],
  );

  return result.affectedRows;
};

const destroyAll = async (userId: number) => {
  const [result] = await databaseClient.query<ResultSetHeader>(
    "DELETE FROM cart WHERE users_id = ?",
    [userId],
  );

  return result.affectedRows;
};

export default { readAll, create, updateQuantity, destroy, destroyAll };
