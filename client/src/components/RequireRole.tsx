import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useSession } from "../hooks/useSession";

type RequireRoleProps = {
  role: "client" | "admin";
  children: ReactNode;
};

/**
 * Garde de route.
 *
 * Tant que la session n'est pas connue, rien n'est rendu : sans cette
 * attente, un utilisateur pourtant connecté serait renvoyé au login le temps
 * que `GET /api/auth/me` réponde.
 *
 * Cette garde ne protège que l'affichage. Les données, elles, sont protégées
 * par le serveur : chaque route de l'API vérifie la session et le rôle.
 */
function RequireRole({ role, children }: RequireRoleProps) {
  const { user, loading } = useSession();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    // `from` permet de ramener l'utilisateur où il allait après connexion.
    return <Navigate to="/log-in" state={{ from: location }} replace />;
  }

  if (user.role !== role) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default RequireRole;
