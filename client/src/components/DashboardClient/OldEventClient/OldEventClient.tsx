import useEventsClient from "../../../hooks/useEventsClient";
import { useSession } from "../../../hooks/useSession";
import "./OldEventClient.css";

function OldEventClient() {
  const { user } = useSession();

  const events = useEventsClient(user?.id ?? 0, "past");

  return (
    <section className="old-event-client__container">
      {events.length === 0 ? (
        <p className="old-event-client__empty">Aucun événement passé.</p>
      ) : (
        <ul className="old-event-client__list">
          {events.map((event) => (
            <li key={event.id} className="old-event-client__item">
              <span className="old-event-client__name">{event.name}</span>
              <span className="old-event-client__date">
                {event.start_date.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default OldEventClient;
