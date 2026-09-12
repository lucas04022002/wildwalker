import type { ResultSetHeader, RowDataPacket } from "mysql2";
// Une connexion "Queryable" peut être soit le pool global, soit une connexion dédiée (utilisée dans une transaction, ex: readForUpdate)
import type { PoolConnection } from "mysql2/promise";
import databaseClient from "../../../database/client";

/** Ligne de panier relue sous verrou, pour revérifier prix et capacité. */
type CartLineForUpdate = {
  id: number;
  quantity: number;
  id_activity: number;
  price_unit: number | string;
  start_date: string | Date;
  end_date: string | Date;
  space_id: number;
  time_slot_id: number;
  space_category: string;
  capacity: number;
};

type CartItem = {
  users_id: number;
  id_activity: number;
  quantity: number;
  /** Prix d'une unité, durée comprise. Le total en découle, jamais l'inverse. */
  unitTotal: number;
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

/** Arrondi au centime : la colonne `total_price` est un DECIMAL(10,2). */
const round2 = (value: number): number => Math.round(value * 100) / 100;

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
    // Le total suit la quantité : sans cela la ligne fusionnée garderait le
    // total de la première réservation.
    await connection.query<ResultSetHeader>(
      "UPDATE cart SET quantity = ?, total_price = ? WHERE id = ?",
      [newQuantity, round2(item.unitTotal * newQuantity), existing[0].id],
    );
    return existing[0].id;
  }

  const [result] = await connection.query<ResultSetHeader>(
    "INSERT INTO cart (users_id, id_activity, quantity, total_price) VALUES (?, ?, ?, ?)",
    [
      item.users_id,
      item.id_activity,
      item.quantity,
      round2(item.unitTotal * item.quantity),
    ],
  );

  return result.insertId;
};

/**
 * Ligne de panier lue sous verrou, avec de quoi revérifier la capacité :
 * l'espace, son créneau, sa catégorie et sa période.
 *
 * À n'appeler que dans une transaction. Le `FOR UPDATE` verrouille la ligne
 * de panier pour la durée de la modification : deux augmentations simultanées
 * de la même ligne ne peuvent pas passer le contrôle de capacité chacune de
 * son côté.
 */
const readLineForUpdate = async (
  connection: PoolConnection,
  cartItemId: number,
  userId: number,
): Promise<CartLineForUpdate | null> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT c.id,
            c.quantity,
            c.id_activity,
            COALESCE(c.price_unit, a.price_unit) AS price_unit,
            a.start_date,
            a.end_date,
            a.space_id,
            a.time_slot_id,
            s.space_category,
            s.capacity
       FROM cart c
       JOIN activity a ON a.id = c.id_activity
       JOIN space s ON s.id = a.space_id
      WHERE c.id = ? AND c.users_id = ?
      FOR UPDATE`,
    [cartItemId, userId],
  );

  return (rows[0] as CartLineForUpdate) ?? null;
};

/**
 * Les mutations filtrent toujours sur le propriétaire de la ligne : le
 * `users_id` vient du jeton, jamais de l'URL. Zéro ligne touchée signifie
 * « pas à vous » aussi bien que « n'existe pas », et la réponse est la même
 * (404) dans les deux cas : rien ne fuit sur l'existence de la ligne.
 *
 * Le total accompagne la quantité : il est calculé par l'appelant depuis le
 * prix lu en base (`lineAmountInEuros`), jamais repris du corps de la
 * requête. Sans lui, la ligne garderait le total de la quantité précédente.
 */
const updateQuantity = async (
  connection: PoolConnection,
  cartItemId: number,
  userId: number,
  quantity: number,
  totalPrice: number,
) => {
  const [result] = await connection.query<ResultSetHeader>(
    "UPDATE cart SET quantity = ?, total_price = ? WHERE id = ? AND users_id = ?",
    [quantity, round2(totalPrice), cartItemId, userId],
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

export default {
  readAll,
  create,
  readLineForUpdate,
  updateQuantity,
  destroy,
};
export type { CartLineForUpdate };
