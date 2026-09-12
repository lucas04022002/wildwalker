import type { RequestHandler } from "express";

import database from "../../../database/client";

/**
 * Sonde de santé.
 *
 * Elle ne se contente pas de répondre « le processus est vivant » : un
 * serveur qui écoute mais dont la base est injoignable n'est pas en état de
 * servir. Un vrai `SELECT 1` est donc émis à chaque appel, et la réponse
 * passe en 503 dès qu'il échoue — c'est ce que lit le `HEALTHCHECK` Docker
 * et l'orchestrateur derrière.
 */
const check: RequestHandler = async (_req, res) => {
  try {
    await database.query("SELECT 1");
    res.status(200).json({ ok: true, db: true });
  } catch {
    // Aucun détail de connexion renvoyé : la sonde est publique.
    res.status(503).json({ ok: false, db: false });
  }
};

export default { check };
export { check };
