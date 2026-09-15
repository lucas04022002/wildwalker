/**
 * Préfixe des appels d'API.
 *
 * En développement le client (port 3000) et le serveur (port 3310) sont deux
 * origines : `VITE_API_URL` porte celle du serveur. En production l'image
 * Docker sert le client et l'API depuis le même processus : la variable est
 * construite à vide, et le préfixe vide donne des URL relatives, donc la
 * même origine — aucun CORS, et le cookie de session part de lui-même.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

/**
 * Appel à l'API.
 *
 * La session est portée par le cookie httpOnly `ww_session`, posé par le
 * serveur à la connexion. `credentials: "include"` le fait voyager avec la
 * requête ; le client ne le lit jamais et n'a donc aucun jeton à stocker.
 */
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> => {
  const isFormData = options.body instanceof FormData;

  return fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      // Si FormData, pas de Content-Type → le browser le gère avec la boundary
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
};

/**
 * Lecture d'une liste.
 *
 * Le serveur répond à une erreur par un objet — `{ "message": "Veuillez vous
 * connecter." }` sur un 401, par exemple. Appeler `.json()` sans regarder le
 * statut range donc cet objet dans un état déclaré comme tableau, et le
 * premier `.slice()` ou `.map()` fait tomber la page entière : « r.slice is
 * not a function ». Une session expirée ne doit pas produire un écran blanc.
 *
 * Deux vérifications, parce qu'aucune des deux ne couvre l'autre : le statut
 * attrape l'erreur annoncée, la forme attrape une réponse 200 inattendue.
 */
export const apiList = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T[]> => {
  try {
    const response = await apiFetch(endpoint, options);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    // Serveur injoignable, réponse illisible : une liste vide reste affichable.
    return [];
  }
};

/**
 * Lecture d'un objet unique. Même raisonnement qu'`apiList`, mais on ne peut
 * pas vérifier la forme : on se fie au statut, et l'échec vaut `null` — que
 * l'appelant doit distinguer d'un chargement en cours.
 */
export const apiOne = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T | null> => {
  try {
    const response = await apiFetch(endpoint, options);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

/**
 * Ferme la session.
 *
 * Le cookie étant httpOnly, seul le serveur peut l'effacer : la déconnexion
 * passe donc obligatoirement par un appel réseau. Si celui-ci échoue,
 * l'utilisateur est quand même ramené à l'écran de connexion — sa session
 * reste ouverte côté serveur, mais l'écran ne prétend pas le contraire.
 */
export const logout = async (): Promise<void> => {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Serveur injoignable : on redirige tout de même.
  } finally {
    window.location.href = "/log-in";
  }
};
