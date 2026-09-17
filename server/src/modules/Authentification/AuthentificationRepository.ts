import databaseLeLocal from "../../../database/client";
import type { Result, Rows } from "../../../database/client";

type UserRow = {
  id: number;
  phone_number: string;
  email: string;
  lastname: string;
  password: string;
  city: string | null;
  adress: string | null;
  role: string;
  profile_image: string | null;
  firstname: string;
  signing_date: string;
};

type SafeUser = Omit<UserRow, "password">;

const SAFE_USER_FIELDS =
  "id, phone_number, email, lastname, city, adress, role, profile_image, firstname, signing_date";

const findByEmail = async (email: string): Promise<UserRow | null> => {
  const [rows] = await databaseLeLocal.query<Rows>(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return (rows[0] as UserRow) ?? null;
};

/**
 * La colonne `phone_number` porte une contrainte UNIQUE en base, au même titre
 * que `email`. L'inscription ne vérifiait que l'e-mail : un numéro déjà pris
 * partait donc jusqu'à l'INSERT et remontait en erreur 500.
 */
const findByPhone = async (phoneNumber: string): Promise<UserRow | null> => {
  const [rows] = await databaseLeLocal.query<Rows>(
    "SELECT * FROM users WHERE phone_number = ? LIMIT 1",
    [phoneNumber],
  );
  return (rows[0] as UserRow) ?? null;
};

const findById = async (id: number): Promise<SafeUser | null> => {
  const [rows] = await databaseLeLocal.query<Rows>(
    `SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  return (rows[0] as SafeUser) ?? null;
};

const create = async (user: {
  firstname: string;
  lastname: string;
  email: string;
  passwordHash: string;
  phone_number: string;
  city?: string | null;
  adress?: string | null;
}): Promise<SafeUser | null> => {
  const [result] = await databaseLeLocal.query<Result>(
    `INSERT INTO users
      (phone_number, email, lastname, password, city, adress, role, firstname)
     VALUES (?, ?, ?, ?, ?, ?, 'client', ?)`,
    [
      user.phone_number,
      user.email,
      user.lastname,
      user.passwordHash,
      user.city ?? null,
      user.adress ?? null,
      user.firstname,
    ],
  );
  return findById(result.insertId);
};

export default { findByEmail, findByPhone, findById, create };
export type { UserRow, SafeUser };
