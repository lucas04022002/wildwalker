import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import databaseLeLocal from "../../../database/client";
import type { Rows } from "../../../database/client";

/**
 * Jetons de réinitialisation.
 *
 * Le jeton n'existe en clair qu'à deux endroits : le message envoyé, et le
 * lien que la personne clique. La base n'en garde que l'empreinte — la lire
 * ne permet donc de prendre aucun compte.
 */

/** Trente minutes : assez pour relever ses e-mails, trop peu pour traîner. */
const DUREE_VALIDITE_MS = 30 * 60 * 1000;

/** 32 octets tirés au hasard : la devinette n'est pas une stratégie. */
const OCTETS_JETON = 32;

const empreinte = (jeton: string): string =>
  createHash("sha256").update(jeton).digest("hex");

const creerJeton = (): string => randomBytes(OCTETS_JETON).toString("hex");

/**
 * Comparaison à temps constant de deux empreintes.
 *
 * La recherche se fait par clé primaire, donc l'égalité est déjà décidée par
 * la base ; cette fonction sert aux comparaisons faites en mémoire.
 */
const empreintesEgales = (a: string, b: string): boolean => {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

type DemandeValide = { users_id: number };

/**
 * Ouvre une demande et rend le jeton EN CLAIR — la seule fois où il existe
 * hors du message. Toute demande antérieure du même compte est annulée : deux
 * liens valides en même temps, c'est une surface pour rien.
 */
const ouvrir = async (userId: number): Promise<string> => {
  await databaseLeLocal.query(
    "UPDATE password_reset SET used_at = NOW() WHERE users_id = ? AND used_at IS NULL",
    [userId],
  );

  const jeton = creerJeton();
  const expiresAt = new Date(Date.now() + DUREE_VALIDITE_MS);

  await databaseLeLocal.query(
    "INSERT INTO password_reset (token_hash, users_id, expires_at) VALUES (?, ?, ?)",
    [empreinte(jeton), userId, expiresAt],
  );

  return jeton;
};

/** La demande désignée par ce jeton, si elle est encore utilisable. */
const lire = async (jeton: string): Promise<DemandeValide | null> => {
  const [rows] = await databaseLeLocal.query<Rows>(
    `SELECT users_id FROM password_reset
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
      LIMIT 1`,
    [empreinte(jeton)],
  );

  return (rows[0] as DemandeValide) ?? null;
};

/**
 * Consomme la demande. Le `used_at IS NULL` dans le WHERE fait la course à
 * notre place : deux clics simultanés sur le même lien, un seul change le mot
 * de passe.
 */
const consommer = async (jeton: string): Promise<boolean> => {
  const [result] = await databaseLeLocal.query(
    `UPDATE password_reset SET used_at = NOW()
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()`,
    [empreinte(jeton)],
  );

  return (result as { affectedRows?: number }).affectedRows === 1;
};

/** Efface les demandes périmées : leur jeton ne vaut plus rien. */
const purgerExpirees = async (): Promise<void> => {
  await databaseLeLocal.query(
    "DELETE FROM password_reset WHERE expires_at <= NOW()",
  );
};

export default { consommer, empreinte, lire, ouvrir, purgerExpirees };
export {
  DUREE_VALIDITE_MS,
  consommer,
  empreinte,
  empreintesEgales,
  lire,
  ouvrir,
  purgerExpirees,
};
