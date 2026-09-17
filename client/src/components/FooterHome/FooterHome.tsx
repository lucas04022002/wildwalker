import "./FooterHome.css";
import { Link } from "react-router";

function FooterHome() {
  return (
    <footer className="footer-home-section">
      <div className="footer-home-container">
        <section className="footer-home-cta">
          <h2 className="footer-home-title">
            <span className="footer-home-title-main">Prêt·e à rejoindre</span>
            <span className="footer-home-title-accent">la communauté ?</span>
          </h2>

          <div className="footer-home-actions">
            <span className="footer-home-button footer-home-button-primary">
              <Link to="/sign-in">Créer un compte</Link>
            </span>
            <span className="footer-home-button footer-home-button-secondary">
              <Link to="/evenements">Voir les événements</Link>
            </span>
          </div>
        </section>

        <div className="footer-home-divider" />

        <section className="footer-home-content">
          <div className="footer-home-brand">
            <h3 className="footer-home-brand-name">Le Local</h3>
            <div className="footer-home-brand-details">
              <p>14 rue de la République, Paris 11e</p>
              <p>contact@lelocal.fr</p>
            </div>
          </div>

          <div className="footer-home-links">
            <div className="footer-home-column">
              <p className="footer-home-column-title">Espaces</p>
              <p className="footer-home-link">Coworking</p>
              <p className="footer-home-link">Studios</p>
              <p className="footer-home-link">Salles</p>
            </div>

            <div className="footer-home-column">
              <p className="footer-home-column-title">Ateliers</p>
              <p className="footer-home-link">Impression 3D</p>
              <p className="footer-home-link">Électronique</p>
              <p className="footer-home-link">Menuiserie</p>
            </div>

            <div className="footer-home-column">
              <p className="footer-home-column-title">Liens</p>
              <p className="footer-home-link">À propos</p>
              <p className="footer-home-link">Adhésion</p>
              <p className="footer-home-link">Contact</p>
            </div>
          </div>
        </section>

        <div className="footer-home-divider footer-home-divider-bottom" />

        <section className="footer-home-bottom">
          {/* « Association loi 1901 » affirmait une personne morale qui n'existe
              pas, sur un site public. Le Local est une démonstration : le pied
              de page le dit, et « Mentions légales » mène enfin quelque part. */}
          <p className="footer-home-legal">
            Le Local — projet de démonstration ·{" "}
            <Link to="/mentions-legales">Mentions légales</Link>
          </p>
        </section>
      </div>
    </footer>
  );
}

export default FooterHome;
