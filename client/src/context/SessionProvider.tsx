import type { ReactNode } from "react";
import { SessionContext, useSessionLoader } from "../hooks/useSession";

/**
 * Interroge `GET /api/auth/me` une seule fois au démarrage et partage le
 * résultat avec toute l'application, pour que chaque composant qui a besoin
 * de savoir qui est connecté n'ouvre pas sa propre requête.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionLoader();

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
