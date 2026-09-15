import type { Claim } from "../types/claim";
import { apiFetch } from "./apiFetch";

/**
 * Dépôt d'une réclamation.
 *
 * Renvoie le succès plutôt que le corps de la réponse : l'appelant a besoin de
 * savoir si la réclamation est partie, pas de ce que le serveur a répondu. Sans
 * cela, un 401 ou un 500 donnait quand même un objet, l'appelant le prenait
 * pour une réussite, vidait le formulaire et affichait « envoyée » — le pire
 * des retours, puisqu'il fait perdre le texte saisi en plus de la réclamation.
 */
function useCreateClaim() {
  async function createClaim(userId: number, data: Claim): Promise<boolean> {
    try {
      const response = await apiFetch(
        `/api/dashboard/client/${userId}/claims`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  return { createClaim };
}

export default useCreateClaim;
