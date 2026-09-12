import { useState } from "react";
import "../Login/Login.css";
import { Link, useNavigate } from "react-router";
import { apiFetch } from "../../hooks/apiFetch";

export default function SignIn() {
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    city: "",
    adress: "",
    phone_number: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Une erreur est survenue.");
        return;
      }

      // L'inscription n'ouvre pas de session : le serveur répond la même chose
      // que l'adresse ait été libre ou déjà prise, sans poser de cookie. On
      // renvoie donc vers la connexion, avec le message tel quel.
      navigate("/log-in", {
        replace: true,
        state: { notice: data.message ?? "Votre compte a bien été créé." },
      });
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-form-wrapper">
          <h1 className="auth-title">Créer votre compte</h1>

          {error && <p className="auth-error">{error}</p>}

          <div className="auth-fields">
            <div className="auth-row">
              <div className="auth-field">
                <input
                  name="firstname"
                  placeholder="Prénom"
                  value={form.firstname}
                  onChange={handleChange}
                  autoComplete="given-name"
                />
              </div>
              <div className="auth-field">
                <input
                  name="lastname"
                  placeholder="Nom"
                  value={form.lastname}
                  onChange={handleChange}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="auth-field">
              <input
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <input
                name="password"
                type="password"
                placeholder="Mot de passe"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
              />
            </div>

            <div className="auth-field">
              <input
                name="city"
                placeholder="Ville"
                value={form.city}
                onChange={handleChange}
                autoComplete="address-level2"
              />
            </div>

            <div className="auth-field">
              <input
                name="adress"
                placeholder="Adresse"
                value={form.adress}
                onChange={handleChange}
                autoComplete="street-address"
              />
            </div>

            <div className="auth-field">
              <input
                name="phone_number"
                type="tel"
                placeholder="Tél"
                value={form.phone_number}
                onChange={handleChange}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="auth-footer">
            <button
              type="button"
              className="auth-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Création en cours..." : "Créer mon compte"}
            </button>

            <p className="auth-switch">
              Déjà un compte ? <Link to="/log-in">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="auth-visual" />
    </div>
  );
}
