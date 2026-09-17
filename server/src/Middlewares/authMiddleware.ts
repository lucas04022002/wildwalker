import type { RequestHandler } from "express";
import jwtUtil, { COOKIE_NAME } from "../modules/Authentification/Jwt";
import sessionRepository from "../modules/Authentification/SessionRepository";

/**
 * Lit le jeton de session.
 *
 * Source principale : le cookie `ww_session` (httpOnly, donc hors de portée
 * d'un script injecté). L'en-tête `Authorization: Bearer` reste accepté le
 * temps que le client bascule sur le cookie (tâche 3).
 */
const readToken = (req: Parameters<RequestHandler>[0]): string | null => {
  const fromCookie = req.cookies?.[COOKIE_NAME];

  if (typeof fromCookie === "string" && fromCookie !== "") {
    return fromCookie;
  }

  const authHeader = req.headers.authorization;

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    return token === "" ? null : token;
  }

  return null;
};

const requireAuth: RequestHandler = async (req, res, next) => {
  const token = readToken(req);

  if (token == null) {
    res.status(401).json({ message: "Veuillez vous connecter." });
    return;
  }

  let payload: ReturnType<typeof jwtUtil.verifyToken>;

  try {
    payload = jwtUtil.verifyToken(token);
  } catch {
    // Aucun détail renvoyé ni journalisé : ni le jeton, ni la cause.
    res.status(401).json({ message: "Session expirée, reconnectez-vous." });
    return;
  }

  // La signature tient et la date n'est pas passée. Restent deux façons pour
  // une session d'être morte quand même : avoir été fermée (déconnexion), ou
  // avoir été émise avant un changement de mot de passe. Les deux sont lues
  // d'une seule requête.
  //
  // Une panne de base ne doit pas laisser passer un jeton mort : la garde
  // échoue en position fermée.
  try {
    const etat = await sessionRepository.lireEtat(
      payload.jti ?? null,
      payload.id,
    );

    if (etat.revoque) {
      res.status(401).json({ message: "Session fermée, reconnectez-vous." });
      return;
    }

    // `iat` est en secondes. Une session ouverte avant le changement de mot de
    // passe ne survit pas au changement : c'est tout l'intérêt d'en changer
    // quand quelqu'un d'autre est entré.
    if (etat.motDePasseChangeLe != null && payload.iat != null) {
      const emisLe = payload.iat * 1000;

      // Une seconde de marge : `iat` est arrondi à la seconde, et se
      // reconnecter dans la foulée d'un changement ne doit pas échouer.
      if (emisLe + 1000 < etat.motDePasseChangeLe.getTime()) {
        res.status(401).json({
          message: "Mot de passe modifié, reconnectez-vous.",
        });
        return;
      }
    }
  } catch {
    res.status(503).json({ message: "Service indisponible." });
    return;
  }

  req.user = { id: payload.id, email: payload.email, role: payload.role };
  next();
};

/** Vérifie le rôle une fois l'authentification faite. */
const adminOnly: RequestHandler = (req, res, next) => {
  if (req.user?.role === "admin") {
    next();
    return;
  }

  res.status(403).json({ message: "Accès réservé à l'administration." });
};

const requireAdmin: RequestHandler[] = [requireAuth, adminOnly];

export default { requireAuth, requireAdmin, adminOnly };
export { adminOnly, requireAdmin, requireAuth };
