import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { apiFetch } from "../../hooks/apiFetch";
import "../Login/Login.css";

/** Même longueur qu'à l'inscription : une règle qui varie n'est pas une règle. */
const LONGUEUR_MINIMALE = 10;

/**
 * « J'ai oublié mon mot de passe », étape 2 : le nouveau mot de passe.
 *
 * Le jeton vient de l'URL, jamais d'une saisie. Il n'est ni affiché, ni
 * conservé : il part avec la requête et disparaît avec la page.
 *
 * La confirmation est vérifiée ici et seulement ici — le serveur n'en reçoit
 * qu'un seul, parce qu'une deuxième copie du même secret sur le réseau ne
 * protège de rien.
 */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const jeton = params.get("jeton") ?? "";

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    if (password.length < LONGUEUR_MINIMALE) {
      setError(
        `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`,
      );
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ jeton, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        const details = Array.isArray(data.errors) ? data.errors : null;
        setError(
          details?.join(" ") ?? data.message ?? "Une erreur est survenue.",
        );
        return;
      }

      navigate("/log-in", { replace: true, state: { notice: data.message } });
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  // Arrivée sans jeton : le lien a été tronqué ou recopié à la main. Inutile
  // d'afficher un formulaire qui ne peut pas aboutir.
  if (jeton === "") {
    return (
      <div className="auth-page">
        <div className="auth-panel">
          <div className="auth-form-wrapper">
            <h1 className="auth-title">Lien incomplet</h1>
            <output className="auth-error">
              Ce lien ne contient pas de jeton. Ouvrez-le depuis l&apos;e-mail
              reçu, ou demandez-en un nouveau.
            </output>
            <p className="auth-switch">
              <Link to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
            </p>
          </div>
        </div>
        <div className="auth-visual" />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-form-wrapper">
          <h1 className="auth-title">Nouveau mot de passe</h1>

          {error && <output className="auth-error">{error}</output>}

          <form onSubmit={handleSubmit}>
            <div className="auth-fields">
              <div className="auth-field">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={`Au moins ${LONGUEUR_MINIMALE} caractères`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  aria-label={
                    visible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="auth-field">
                <input
                  name="confirmation"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirmer le mot de passe"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-footer">
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? "Enregistrement..." : "Changer mon mot de passe"}
              </button>

              <p className="auth-switch">
                <Link to="/log-in">Revenir à la connexion</Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      <div className="auth-visual" />
    </div>
  );
}
