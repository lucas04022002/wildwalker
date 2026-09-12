import { Building2 } from "lucide-react";
import { useState } from "react";
import useSpacesClient from "../../../hooks/useSpacesClient";
import AllActivitiesModal from "../AllActivitiesModal/AllActivitiesModal";
import "./UpcomingBookingClient.css";
import { useSession } from "../../../hooks/useSession";

function UpcomingBookingClient() {
  const { user } = useSession();
  const bookings = useSpacesClient(user?.id ?? 0, "upcoming");
  const [showModal, setShowModal] = useState(false);
  const displayed = bookings.slice(0, 3);

  return (
    <section className="upcoming-booking-client__container">
      <div className="upcoming-booking-client__header">
        <h2 className="upcoming-booking-client__title">
          Mes réservations d'espaces à venir
        </h2>
        {bookings.length > 0 && (
          <button
            type="button"
            className="upcoming-booking-client__toggle"
            onClick={() => setShowModal(true)}
            aria-label="Voir toutes mes réservations d'espaces à venir"
          >
            Voir tout
          </button>
        )}
      </div>

      {displayed.length === 0 ? (
        <p className="upcoming-booking-client__empty">
          Aucune réservation à venir.
        </p>
      ) : (
        <ul className="upcoming-booking-client__list">
          {displayed.map((booking) => (
            <li key={booking.id} className="upcoming-booking-client__item">
              <Building2
                className="upcoming-booking-client__icon"
                size={18}
                aria-hidden="true"
              />{" "}
              <div className="upcoming-booking-client__info">
                <span className="upcoming-booking-client__name">
                  {booking.space_name}
                </span>
                <span className="upcoming-booking-client__date">
                  {booking.start_date.slice(0, 10)} ·{" "}
                  {booking.start_hour.slice(0, 5)} -{" "}
                  {booking.end_hour.slice(0, 5)}
                </span>
              </div>
              <span className="upcoming-booking-client__price">
                {booking.total_price} €
              </span>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <AllActivitiesModal
          title="Tous mes espaces à venir"
          items={bookings}
          onClose={() => setShowModal(false)}
          type="booking"
        />
      )}
    </section>
  );
}

export default UpcomingBookingClient;
