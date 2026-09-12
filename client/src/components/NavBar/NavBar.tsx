import "./NavBar.css";
import { ShoppingCart, UserCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import ImgTitle from "../../assets/images/ImgTitleLeLocale.webp";
import { useSession } from "../../hooks/useSession";

function NavBar() {
  const { user, loading } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="navbar-global-div">
      <div className="navbar-title">
        <Link to="/">
          <img src={ImgTitle} alt="ImgTitleLeLocal" />
        </Link>
      </div>

      <div className={`navbar-links-div${isMenuOpen ? " open" : ""}`}>
        <button type="button" className="navbar-link-button">
          <Link
            to="/"
            className="navbar-link"
            onClick={() => setIsMenuOpen(false)}
          >
            Accueil
          </Link>
        </button>
        <button type="button" className="navbar-link-button">
          <Link
            to="/evenements"
            className="navbar-link"
            onClick={() => setIsMenuOpen(false)}
          >
            Evenements
          </Link>
        </button>
        <button type="button" className="navbar-link-button">
          <Link
            to="/espaces"
            className="navbar-link"
            onClick={() => setIsMenuOpen(false)}
          >
            Espaces
          </Link>
        </button>
        <button type="button" className="navbar-link-button">
          <Link
            to="/workshop-page"
            className="navbar-link"
            onClick={() => setIsMenuOpen(false)}
          >
            Ateliers
          </Link>
        </button>
      </div>

      <div className="navbar-connection-div">
        {/* Tant que la session est inconnue, on n'affiche ni l'un ni l'autre :
            sinon un utilisateur connecté voit passer « Se connecter » à
            chaque chargement de page. */}
        {loading ? null : user ? (
          <Link
            to={
              user.role === "admin" ? "/dashboard-admin" : "/dashboard-client"
            }
            className="cart-logo"
          >
            <UserCircle />
          </Link>
        ) : (
          <>
            <button type="button" className="navbar-connection-button">
              <Link to="/log-in" className="navbar-link">
                Se connecter
              </Link>
            </button>
            <button type="button" className="navbar-connection-button-2">
              <Link to="/sign-in" className="navbar-link">
                Rejoindre
              </Link>
            </button>
          </>
        )}
        <Link to="/cart" className="cart-logo">
          <ShoppingCart />
        </Link>
        <button
          type="button"
          className="navbar-burger"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </div>
  );
}

export default NavBar;
