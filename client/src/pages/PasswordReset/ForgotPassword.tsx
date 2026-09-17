import { useState } from "react";
import { Link } from "react-router";
import { apiFetch } from "../../hooks/apiFetch";
import "../Login/Login.css";

/**
 * « J'ai oublié mon mot de passe », étape 1 : l'adresse.
 *
 * La page affiche la même confirmation que l'adresse soit connue ou non — le
 * serveur répond la même chose, et l'écran ne doit pas en dire plus que lui.
 * Le formulaire disparaît ensuite : le laisser inviterait à recommencer, alors
 * que trois demandes par quart d'heure suffisent à déclencher un refus.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        const details = Array.isArray(data.errors) ? data.errors : null;
        setError(
          details?.join(" ") ?? data.message ?? "Une erreur est survenue.",
        );
        return;
      }

      setEnvoye(data.message);
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
          <h1 className="auth-title">Mot de passe oublié</h1>

          {error && <output className="auth-error">{error}</output>}

          {envoye ? (
            <>
              <output className="auth-notice">{envoye}</output>
              <p className="auth-switch">
                Le lien est valable trente minutes.{" "}
                <Link to="/log-in">Revenir à la connexion</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="auth-switch">
                Indiquez l&apos;adresse de votre compte : vous recevrez un lien
                pour choisir un nouveau mot de passe.
              </p>

              <div className="auth-fields">
                <div className="auth-field">
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-footer">
                <button
                  type="submit"
                  className="auth-submit"
                  disabled={loading}
                >
                  {loading ? "Envoi..." : "Recevoir le lien"}
                </button>

                <p className="auth-switch">
                  <Link to="/log-in">Revenir à la connexion</Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="auth-visual" />
    </div>
  );
}
