import BillingClient from "../../components/DashboardClient/BillingClient/BillingClient";
import ClaimClient from "../../components/DashboardClient/ClaimClient/ClaimClient";
import EventRequestsClient from "../../components/DashboardClient/EventRequestsClient/EventRequestsClient";
import PastClient from "../../components/DashboardClient/PastClient/PastClient";
import StatsClient from "../../components/DashboardClient/StatsClient/StatsClient";
import UpcomingBookingClient from "../../components/DashboardClient/UpcomingBookingClient/UpcomingBookingClient";
import UpcomingEventClient from "../../components/DashboardClient/UpcomingEventClient/UpcomingEventClient";
import FooterDashboard from "../../components/FooterDashboard/FooterDashboard";
import { useSession } from "../../hooks/useSession";
import "./DashboardClientPage.css";
import { logout } from "../../hooks/apiFetch";

export default function DashboardClientPage() {
  // La route est déjà gardée par RequireRole : arrivé ici, la session existe
  // et son rôle est "client". Le garde-fou reste par sécurité d'affichage.
  const { user } = useSession();

  if (!user) {
    return <p>Vous devez être connecté pour accéder à cette page.</p>;
  }

  return (
    <section className="dashboard-client-page">
      <div className="dashboard-client-page__header">
        <h1 className="dashboard-client-page__heading">
          Bonjour {user.firstname}
          <span aria-hidden="true"> 👋</span>
        </h1>
        <button className="logOutButton" type="button" onClick={logout}>
          Deconnexion
        </button>
      </div>
      <section
        className="dashboard-client-section"
        aria-label="Tableau de bord"
      >
        {" "}
        <div className="dashboard-client-part">
          <StatsClient />
        </div>
        <div className="dashboard-client-part">
          <div className="dashboard-client-grid">
            <UpcomingBookingClient />
            <div className="dashboard-client-past">
              <PastClient />
            </div>
            <UpcomingEventClient />
          </div>
        </div>
        <div className="dashboard-client-part">
          <EventRequestsClient />
        </div>
        <div className="dashboard-client-part">
          <BillingClient />
        </div>
        <div className="dashboard-client-part">
          <ClaimClient />
        </div>
      </section>
      <div className="dashboard-client-footer">
        <FooterDashboard />
      </div>
    </section>
  );
}
