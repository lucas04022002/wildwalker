import databaseLeLocal from "../../../database/client";
import type { Rows } from "../../../database/client";

/**
 * Sessions révoquées.
 *
 * Un JWT est valable tant que sa signature tient et que sa date n'est pas
 * passée : le serveur n'a aucun moyen, par lui-même, de le rendre caduc.
 * Cette table est ce moyen. Elle ne contient que les jetons explicitement
 * révoqués — une ligne par déconnexion, effacée dès que le jeton aurait
 * expiré de toute façon.
 */

/** Toutes les N révocations, on balaie les lignes devenues inutiles. */
const NETTOYAGE_TOUS_LES = 50;

let revocationsDepuisNettoyage = 0;

/** Efface les lignes dont le jeton a expiré : leur signature ne vaut plus rien. */
const purgerExpirees = async (): Promise<void> => {
  await databaseLeLocal.query(
    "DELETE FROM revoked_session WHERE expires_at <= NOW()",
  );
};

/**
 * Note un jeton comme révoqué.
 *
 * `INSERT IGNORE` : révoquer deux fois le même jeton n'est pas une erreur —
 * deux onglets qui se déconnectent en même temps, par exemple.
 */
const revoke = async (jti: string, expiresAt: Date): Promise<void> => {
  await databaseLeLocal.query(
    "INSERT IGNORE INTO revoked_session (jti, expires_at) VALUES (?, ?)",
    [jti, expiresAt],
  );

  revocationsDepuisNettoyage += 1;

  if (revocationsDepuisNettoyage >= NETTOYAGE_TOUS_LES) {
    revocationsDepuisNettoyage = 0;
    await purgerExpirees();
  }
};

/** Ce jeton a-t-il été révoqué ? Appelé à chaque requête authentifiée. */
const isRevoked = async (jti: string): Promise<boolean> => {
  const [rows] = await databaseLeLocal.query<Rows>(
    "SELECT 1 FROM revoked_session WHERE jti = ? LIMIT 1",
    [jti],
  );

  return rows.length > 0;
};

export default { isRevoked, purgerExpirees, revoke };
export { NETTOYAGE_TOUS_LES, isRevoked, purgerExpirees, revoke };
