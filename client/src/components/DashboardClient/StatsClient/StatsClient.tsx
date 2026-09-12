import { useSession } from "../../../hooks/useSession";
import useStatsClient from "../../../hooks/useStatsClient";
import "./StatsClient.css";

function StatsClient() {
  const { user } = useSession();
  const stats = useStatsClient(user?.id ?? 0);

  if (!stats) return null;

  return (
    <section className="stats-client__container" aria-label="Mes statistiques">
      {" "}
      <div className="stats-client__card">
        <span className="stats-client__value" aria-hidden="true">
          {stats.bookings_count}
        </span>
        <span className="stats-client__label" aria-hidden="true">
          Réservations au total
        </span>
      </div>
      <div className="stats-client__card">
        <span className="stats-client__value">
          {Number(stats.events_count)}
        </span>
        <span className="stats-client__label">Événements inscrits</span>
      </div>
      <div className="stats-client__card">
        <span className="stats-client__value">
          {Number(stats.total_spent)} €
        </span>
        <span className="stats-client__label">Total dépensé</span>
      </div>
    </section>
  );
}

export default StatsClient;
