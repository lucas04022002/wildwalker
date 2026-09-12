import { Calendar, MapPin } from "lucide-react";
import { useEventModalContext } from "../../hooks/useEventModalContext";
import RegisterEventForm from "../RegisterEventForm/RegisterEventForm";
import "./CardEvent.css";
import { useEffect, useState } from "react";
import { useSession } from "../../hooks/useSession";

interface CardEventProps {
  event: {
    id: number;
    name: string;
    description: string;
    space_name: string;
    url_image: string;
    price_unit: number;
    start_date: string;
    start_hour: string;
    end_hour: string;
    capacity: number;
    creator_id: number;
  };
  participants?: {
    id_activity: number;
    name: string;
    sum_participants: number;
    remaining_slots: number;
    capacity: number;
  };
}

function CardEvent({ event, participants }: CardEventProps) {
  const { user, loading } = useSession();

  const capacity = event.capacity;
  const sumParticipants = participants?.sum_participants ?? 0;
  const progress = capacity > 0 ? (sumParticipants / capacity) * 100 : 0;
  const remaining = participants?.remaining_slots ?? event.capacity;

  const { isForm, setIsForm } = useEventModalContext();

  const [showLoginMessage, setShowLoginMessage] = useState(false);

  useEffect(() => {
    if (user) setShowLoginMessage(false);
  }, [user]);

  const isFull = remaining === 0;
  const isCreator = user && user.id === event.creator_id;

  const message =
    !loading && !user && showLoginMessage
      ? "Veuillez vous connecter pour vous inscrire"
      : user && isFull
        ? "Désolé, cet évènement est complet"
        : isCreator
          ? "Vous êtes créateur de cet évènement"
          : "";

  const isVisualDisabled = isFull || isCreator;
  const isActive = !isVisualDisabled;

  function handleRegisterClick() {
    // Session pas encore connue : ne rien affirmer, ni « connectez-vous » ni
    // l'ouverture du formulaire.
    if (loading) return;

    if (!user) {
      setShowLoginMessage(true);
      setIsForm(false);
      return;
    }

    if (isFull || isCreator) {
      setIsForm(false);
      return;
    }

    setIsForm(true);
  }
  return (
    <>
      <article className="card-event-container">
        <div className="card-img-container">
          <img
            src={`${import.meta.env.VITE_API_URL}/${event.url_image}`}
            alt=""
            className="card-img"
          />
        </div>
        <span className="card-badge-price">
          {event.price_unit === 0 ? "Gratuit" : `${event.price_unit} €`}
        </span>
        <div className="card-text-flex">
          <h3>{event.name}</h3>
          <p>{event.description}</p>
          <div className="card-event-row-infos">
            <span className="card-event-infos">
              <Calendar size={16} />
            </span>
            <span className="card-event-infos">
              {event.start_date &&
                `${event.start_date.slice(8, 10)}-${event.start_date.slice(5, 7)}-${event.start_date.slice(0, 4)}`}{" "}
              {event.start_hour?.slice(0, 5)} - {event.end_hour?.slice(0, 5)}
            </span>{" "}
            {/*event.start_hour? : si end_hour est null/undefined, il court-circuite et retourne undefined. Sinon, il appelle .slice(0, 5)*/}
          </div>
          <div className="card-event-row-infos">
            <span className="card-event-infos">
              <MapPin size={16} />
            </span>
            <span className="card-event-infos">{event.space_name}</span>
          </div>
          <div className="card-nbplaces-container">
            <p>{sumParticipants} inscrit.es</p>
            <p>{remaining} places restantes</p>
          </div>
          <div className="card-progressbar-wrapper">
            <div
              className="card-progressbar"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
            {/*
            progressbar est une balise vide de contenu : biome préfère utiliser des aria
          */}
          </div>

          <button
            type="button"
            className={`card-btn-register ${isActive ? "" : "card-btn-disabled"}`}
            aria-label={`S'inscrire à ${event.name}`}
            aria-disabled={
              remaining === 0 || !user || user.id === event.creator_id
            }
            onClick={handleRegisterClick}
          >
            S'inscrire
          </button>
        </div>
        {message && <span className="card-event-message-error">{message}</span>}
      </article>
      {isForm && (
        <RegisterEventForm event={event} participants={participants} />
      )}
    </>
  );
}

export default CardEvent;
