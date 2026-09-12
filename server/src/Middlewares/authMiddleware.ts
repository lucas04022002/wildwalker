import type { RequestHandler } from "express";
import jwtUtil, { COOKIE_NAME } from "../modules/Authentification/Jwt";

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

const requireAuth: RequestHandler = (req, res, next) => {
  const token = readToken(req);

  if (token == null) {
    res.status(401).json({ message: "Veuillez vous connecter." });
    return;
  }

  try {
    const payload = jwtUtil.verifyToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch {
    // Aucun détail renvoyé ni journalisé : ni le jeton, ni la cause.
    res.status(401).json({ message: "Session expirée, reconnectez-vous." });
  }
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
