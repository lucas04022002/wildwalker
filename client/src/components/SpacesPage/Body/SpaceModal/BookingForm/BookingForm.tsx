import { useEffect, useState } from "react";
import type { Space } from "../../../../../types/space";
import "./BookingForm.css";
import { useNavigate } from "react-router";
import { apiFetch } from "../../../../../hooks/apiFetch";
import useSpaceAvailability from "../../../../../hooks/useSpaceAvailability.ts";
import useTimeSlot from "../../../../../hooks/useTimeSlot";
import type { TimeSlot } from "../../../../../types/time-slot";

type BookingFormProps = {
  space: Space;
  onBack: () => void;
};

/**
 * Formulaire de réservation pour un espace donné.
 * Le comportement (champs affichés, calcul du prix, vérification de dispo) varie selon la catégorie de l'espace :
 * - espace "open" (catégorie contenant "open") : on choisit un nombre de places
 * - "Local vide" : réservation sur une plage de dates (date de début + date de fin choisies par l'utilisateur)
 * - tout le reste (salle de réunion, studio...) : réservation par créneau, un seul occupant possible
 */
function BookingForm({ space, onBack }: BookingFormProps) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(1);
  // Date de fin choisie par l'utilisateur, uniquement utilisée pour un "Local vide"
  const [endDateLocal, setEndDateLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Liste des créneaux horaires, en excluant "Soir" (non proposé à la réservation)
  const timeSlots = useTimeSlot();
  const timeSlot = timeSlots.filter((time) => time.slot !== "Soir");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");

  const isOpenSpace = space.space_category.toLowerCase().includes("open");
  const isLocal = space.space_category === "Local vide";
  const navigate = useNavigate();

  // Calcule le nombre de mois entiers entre deux dates (arrondi à l'entier inférieur, jamais négatif)
  function monthsBetween(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    let diff =
      (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if (e.getDate() < s.getDate()) diff -= 1;
    return Math.max(diff, 0);
  }

  // Nombre de mois facturés pour un "Local vide", déduit de la plage de dates choisie
  const monthsCount =
    isLocal && date && endDateLocal ? monthsBetween(date, endDateLocal) : 0;

  // Une plage de dates valide pour un local vide doit couvrir au moins un mois complet, avec une fin postérieure au début
  const isDateRangeValid =
    !isLocal || (date !== "" && endDateLocal !== "" && monthsCount >= 1);

  // Pour un "Local vide", la date de fin est directement celle choisie par l'utilisateur (pour vérifier la disponibilité de la période avant validation)
  const previewEndDate = isLocal ? endDateLocal || undefined : undefined;

  // Interroge l'API de disponibilité :
  // - mode "créneau" (timeSlotId) pour les espaces non-locaux
  // - mode "plage de dates" (endDate) pour les locaux vides
  const { availability, loading: availabilityLoading } = useSpaceAvailability(
    space.id,
    date,
    isLocal ? undefined : selectedTimeSlot,
    isLocal ? previewEndDate : undefined,
  );

  // Un espace "exclusif" est tout espace qui n'est pas "open" (salle de réunion, studio, local vide...) : un seul occupant possible par créneau/période
  const isExclusiveSpace = !isOpenSpace;
  const isUnavailable =
    isExclusiveSpace && availability != null && availability.available === 0;

  // Nombre maximum de places sélectionnables : ne peut pas dépasser la capacité totale, ni le nombre de places réellement encore disponibles
  const maxSeats = isOpenSpace
    ? Math.min(space.capacity, availability?.available ?? space.capacity)
    : space.capacity;

  // Si la dispo change (ex: après changement de créneau) et que le nombre de places sélectionné dépasse maintenant ce qui reste disponible, on ramène automatiquement la sélection à une valeur valide
  useEffect(() => {
    if (isOpenSpace && availability && seats > (availability?.available ?? 0)) {
      setSeats(
        (availability?.available ?? 0) > 0 ? (availability?.available ?? 0) : 1,
      );
    }
  }, [availability, isOpenSpace, seats]);

  // Le créneau "Journée" coûte plus cher (majoration) qu'un demi-créneau
  const isFullDay =
    timeSlots.find((s) => String(s.id) === selectedTimeSlot)?.slot ===
    "Journée";

  const formattedDate = new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Applique la majoration "Journée" au prix unitaire directement,
  // sauf pour les locaux vides (réservés au mois, sans notion de créneau)
  const effectivePrice = isLocal
    ? space.price_unit
    : space.price_unit * (isFullDay ? 1.75 : 1);

  // Calcul du prix total selon le type d'espace :
  // - open      : prix effectif x nombre de places
  // - local     : prix unitaire x nombre de mois (déduit de la plage de dates)
  // - exclusif  : prix effectif (créneau unique)
  const totalPrice = isOpenSpace
    ? effectivePrice * seats
    : isLocal
      ? effectivePrice * monthsCount
      : effectivePrice;

  /**
   * Soumet la réservation à l'API (ajout au panier).
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const endDate = isLocal ? endDateLocal : date;

      // Le corps ne porte aucun prix ni identifiant d'utilisateur : le
      // serveur relit le tarif de l'espace en base et rattache la ligne au
      // titulaire du cookie de session. Le total affiché ci-dessus n'est
      // qu'une estimation montrée à l'utilisateur.
      const payload = {
        space_id: space.id,
        time_slot_id: isLocal ? null : Number(selectedTimeSlot),
        start_date: date,
        end_date: endDate,
        seats: isOpenSpace ? seats : null,
        months: isLocal ? monthsCount : null,
        name,
      };

      const res = await apiFetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // En cas d'erreur métier (créneau pris, plus de place...), l'API renvoie un message explicite qu'on affiche à l'utilisateur
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Erreur lors de la réservation");
      }

      setSuccess(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue, veuillez réessayer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Écran de confirmation affiché après une réservation réussie
  if (success) {
    return (
      <div className="booking-form">
        <button type="button" className="booking-form-back" onClick={onBack}>
          ‹ Retour
        </button>
        <h2 className="booking-form-title">Ajouté au panier</h2>
        <p>
          Votre réservation pour {space.space_name} le {formattedDate} a été
          ajoutée à votre panier.
        </p>
        <div className="booking-form-button-div">
          <div className="booking-form-button-div">
            <button
              type="button"
              className="booking-form-go-cart"
              onClick={() => navigate("/cart")}
            >
              ‹ Voir votre panier
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <button type="button" className="booking-form-back" onClick={onBack}>
        ‹ Retour
      </button>

      <h2 className="booking-form-title">Réserver — {space.space_name}</h2>

      <label className="booking-form-label">
        {isLocal ? "Date de début" : "Date"}
        <input
          type="date"
          className="booking-form-input"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            // Si la nouvelle date de début dépasse la date de fin déjà choisie, on réinitialise la date de fin
            if (isLocal && endDateLocal && e.target.value >= endDateLocal) {
              setEndDateLocal("");
            }
          }}
          required
        />
      </label>

      {/* Date de fin, uniquement pour un local vide (réservation sur une plage de dates) */}
      {isLocal && (
        <label className="booking-form-label">
          Date de fin
          <input
            type="date"
            className="booking-form-input"
            value={endDateLocal}
            min={date || undefined}
            onChange={(e) => setEndDateLocal(e.target.value)}
            required
            disabled={!date}
          />
        </label>
      )}

      {/* Créneau horaire, pour tous les espaces sauf les locaux vides (réservation à la période, pas au créneau) */}
      {!isLocal && (
        <label className="booking-form-label">
          Créneau
          <select
            className="booking-form-input"
            value={selectedTimeSlot}
            onChange={(e) => setSelectedTimeSlot(e.target.value)}
            required
          >
            <option value="">Sélectionnez un créneau</option>
            {timeSlot.map((slot: TimeSlot) => (
              <option key={slot.id} value={slot.id}>
                {slot.slot}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Sélecteur de nombre de places, uniquement pour les espaces "open" encore disponibles */}
      {isOpenSpace && !isUnavailable && (availability?.available ?? 0) > 0 && (
        <label className="booking-form-label">
          Nombre de places
          <input
            type="number"
            min={1}
            max={maxSeats}
            value={seats}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (Number.isNaN(raw)) return;
              // Empêche de sortir des bornes [1, maxSeats] même si l'utilisateur tape une valeur invalide au clavier
              const clamped = Math.min(Math.max(raw, 1), maxSeats);
              setSeats(clamped);
            }}
            className="booking-form-input"
          />
        </label>
      )}

      {/* Message d'erreur si la plage de dates d'un local vide est invalide (moins d'un mois, ou fin avant début) */}
      {isLocal && date && endDateLocal && monthsCount < 1 && (
        <p className="booking-form-error">
          La date de fin doit être au moins un mois après la date de début.
        </p>
      )}

      {/* Message de disponibilité pour les espaces "open" (places restantes) */}
      {date && selectedTimeSlot && (
        <span className="booking-form-availability">
          {availabilityLoading
            ? "Vérification des disponibilités..."
            : availability
              ? isOpenSpace
                ? (availability?.available ?? 0) > 0
                  ? `${availability.available} place${(availability?.available ?? 0) > 1 ? "s" : ""} disponible${(availability?.available ?? 0) > 1 ? "s" : ""} sur ${availability.capacity}`
                  : "Aucune place disponible pour ce créneau"
                : null
              : null}
        </span>
      )}

      {/* Message de disponibilité pour les espaces exclusifs (créneau ou période entièrement libre/occupée) */}
      {isExclusiveSpace &&
        date &&
        (selectedTimeSlot || (isLocal && isDateRangeValid)) && (
          <p className="booking-form-availability">
            {availabilityLoading
              ? "Vérification des disponibilités..."
              : availability
                ? (availability?.available ?? 0) > 0
                  ? isLocal
                    ? "Cette période est disponible"
                    : "Ce créneau est disponible"
                  : !isLocal
                    ? "Ce créneau est déjà réservé pour cet espace"
                    : "Cet espace est déjà réservé sur une période qui chevauche ces dates"
                : null}
          </p>
        )}

      {/* Coordonnées du client, affichées seulement si une place est effectivement disponible */}
      {!isUnavailable && (availability?.available ?? 0) > 0 && (
        <label className="booking-form-label">
          Nom
          <input
            type="text"
            className="booking-form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
      )}

      {/* Récapitulatif du prix, formulé différemment selon le type d'espace */}
      <p className="booking-form-price">
        {isOpenSpace &&
          !isUnavailable &&
          (availability?.available ?? 0) > 0 &&
          `${seats} place${seats > 1 ? "s" : ""} : ${totalPrice}€`}
        {isLocal &&
          !isUnavailable &&
          monthsCount >= 1 &&
          `${monthsCount} mois : ${totalPrice}€`}
        {!isOpenSpace && !isLocal && !isUnavailable && `${totalPrice}€`}
      </p>

      {errorMsg && <p className="booking-form-error">{errorMsg}</p>}

      <button
        type="submit"
        className="booking-form-submit"
        disabled={
          submitting ||
          (isOpenSpace && availability?.available === 0) ||
          isUnavailable ||
          (isLocal && !isDateRangeValid)
        }
      >
        {submitting ? "Envoi..." : "Confirmer la réservation"}
      </button>
    </form>
  );
}

export default BookingForm;
