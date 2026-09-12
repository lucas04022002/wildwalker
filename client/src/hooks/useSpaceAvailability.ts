import { useEffect, useState } from "react";
import type { SpaceAvailability } from "../types/availability";

function useSpaceAvailability(
  spaceId: number | undefined, //identifiant de l'espace concerné
  date: string, //date de début de la réservation (format YYYY-MM-DD)
  timeSlotId: string | number | undefined, //identifiant du créneau horaire
  endDate?: string, //date de fin (mode plage de dates, pour les locaux vides)
) {
  // Résultat de la dernière requête de disponibilité réussie
  const [availability, setAvailability] = useState<SpaceAvailability | null>(
    null,
  );
  // Indique qu'une requête est en cours (pour afficher un loader)
  const [loading, setLoading] = useState(false);
  // Message d'erreur éventuel renvoyé par l'API
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Détermine quel mode de disponibilité doit être interrogé
    const hasSlotMode = Boolean(timeSlotId);
    const hasRangeMode = Boolean(endDate);

    // Tant qu'on n'a pas tout ce qu'il faut (espace + date + un des deux
    // modes), on ne lance pas de requête et on réinitialise le résultat
    // précédent (évite d'afficher une dispo obsolète/incohérente)
    if (!spaceId || !date || (!hasSlotMode && !hasRangeMode)) {
      setAvailability(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    // Construit les paramètres de requête : soit endDate, soit timeSlotId
    const params = new URLSearchParams({ date });
    if (hasRangeMode) {
      params.set("endDate", endDate as string);
    } else {
      params.set("timeSlotId", String(timeSlotId));
    }

    // Appel à l'API de disponibilité pour l'espace donné
    fetch(
      `${import.meta.env.VITE_API_URL ?? ""}/api/spaces/${spaceId}/availability?${params.toString()}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok)
          throw new Error("Impossible de récupérer les disponibilités");
        return res.json();
      })
      .then((data: SpaceAvailability) => setAvailability(data))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [spaceId, date, timeSlotId, endDate]);

  return { availability, loading, error };
}

export default useSpaceAvailability;
