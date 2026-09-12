import { useSession } from "../../../hooks/useSession";
import useSpacesClient from "../../../hooks/useSpacesClient";
import "./OldBookingClient.css";

function OldBookingClient() {
  const { user } = useSession();
  const bookings = useSpacesClient(user?.id ?? 0, "past");

  return (
    <section className="old-booking-client__container">
      {bookings.length === 0 ? (
        <p className="old-booking-client__empty">Aucune réservation passée.</p>
      ) : (
        <ul className="old-booking-client__list">
          {bookings.map((booking) => (
            <li key={booking.id} className="old-booking-client__item">
              <span className="old-booking-client__name">
                {booking.space_name}
              </span>
              <span className="old-booking-client__date">
                {booking.start_date.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default OldBookingClient;
