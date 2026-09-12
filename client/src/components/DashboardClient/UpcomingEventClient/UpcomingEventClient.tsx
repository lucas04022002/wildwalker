import { CalendarClock } from "lucide-react";
import { useState } from "react";
import useEventsClient from "../../../hooks/useEventsClient";
import AllActivitiesModal from "../AllActivitiesModal/AllActivitiesModal";
import "./UpcomingEventClient.css";
import { useSession } from "../../../hooks/useSession";

function UpcomingEventClient() {
  const { user } = useSession();
  const events = useEventsClient(user?.id ?? 0, "upcoming");
  const [showModal, setShowModal] = useState(false);
  const displayed = events.slice(0, 3);

  return (
    <section className="upcoming-event-client__container">
      <div className="upcoming-event-client__header">
        <h2 className="upcoming-event-client__title">Événements à venir</h2>
        {events.length > 0 && (
          <button
            type="button"
            className="upcoming-event-client__toggle"
            onClick={() => setShowModal(true)}
            aria-label="Voir tous mes événements à venir"
          >
            Voir tout
          </button>
        )}
      </div>

      {displayed.length === 0 ? (
        <p className="upcoming-event-client__empty">Aucun événement à venir.</p>
      ) : (
        <ul className="upcoming-event-client__list">
          {displayed.map((event) => (
            <li key={event.id} className="upcoming-event-client__item">
              <CalendarClock
                className="upcoming-event-client__icon"
                size={18}
                aria-hidden="true"
              />
              <div className="upcoming-event-client__info">
                <span className="upcoming-event-client__name">
                  {event.name}
                </span>
                <span className="upcoming-event-client__date">
                  {event.start_date.slice(0, 10)}
                </span>
              </div>
              <span className="upcoming-event-client__price">
                {event.total_price} €
              </span>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <AllActivitiesModal
          title="Tous mes événements à venir"
          items={events}
          onClose={() => setShowModal(false)}
          type="event"
        />
      )}
    </section>
  );
}

export default UpcomingEventClient;
