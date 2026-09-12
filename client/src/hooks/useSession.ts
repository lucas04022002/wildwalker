import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "./apiFetch";

/** Utilisateur tel que le renvoie `GET /api/auth/me`. */
export type SessionUser = {
  id: number;
  email: string;
  role: string;
  firstname: string;
};

export type Session = {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

/**
 * Valeur par défaut hors provider : « on ne sait pas encore ». Elle échoue en
 * position fermée — une garde de route n'affichera rien plutôt que de laisser
 * passer un anonyme.
 */
export const SessionContext = createContext<Session>({
  user: null,
  loading: true,
  refresh: async () => {},
});

/**
 * Charge la session depuis le serveur.
 *
 * Le jeton étant dans un cookie httpOnly, le client ne peut pas le lire : la
 * seule façon de savoir qui est connecté est de le demander. Un 401 n'est pas
 * une erreur, c'est la réponse « anonyme ».
 *
 * À n'utiliser qu'une fois, dans `SessionProvider` : les composants passent
 * par `useSession()`, qui lit le résultat partagé.
 */
export function useSessionLoader(): Session {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/auth/me");

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();
      setUser((data?.user as SessionUser) ?? null);
    } catch {
      // Serveur injoignable : on considère l'utilisateur comme anonyme.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => ({ user, loading, refresh }), [user, loading, refresh]);
}

/** Session courante : `{ user, loading, refresh }`. */
export function useSession(): Session {
  return useContext(SessionContext);
}
