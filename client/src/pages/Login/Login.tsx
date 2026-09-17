import { useState } from "react";
import "./Login.css";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { apiFetch } from "../../hooks/apiFetch";
import { useSession } from "../../hooks/useSession";

type Tab = "client" | "admin";

type LoginState = {
  /** Page demandée avant la redirection vers le login (posée par RequireRole). */
  from?: { pathname?: string };
  /** Message affiché après une inscription réussie. */
  notice?: string;
};

/** Préfixes réservés aux administrateurs. */
const ADMIN_PATHS = ["/dashboard-admin"];

/**
 * N'accepte qu'un chemin interne. Une valeur venant de l'historique de
 * navigation ne doit jamais pouvoir devenir une redirection vers un autre
 * site (`//exemple.fr` est une URL absolue pour le navigateur).
 */
const safePath = (pathname?: string): string | null =>
  pathname?.startsWith("/") && !pathname.startsWith("//") ? pathname : null;

/**
 * Destination après connexion.
 *
 * Le rôle vient du serveur, jamais de l'onglet choisi : c'est lui qui décide
 * qui l'utilisateur est. On ne renvoie vers `from` que si ce chemin est
 * compatible avec ce rôle, sinon la garde de route le refuserait aussitôt et
 * l'utilisateur se retrouverait sur l'accueil sans comprendre.
 */
const destinationFor = (role: "client" | "admin", from: string | null) => {
  if (role === "admin") return "/dashboard-admin";

  const interdit = ADMIN_PATHS.some((prefix) => from?.startsWith(prefix));
  return from && !interdit ? from : "/dashboard-client";
};

export default function Login() {
  const [tab, setTab] = useState<Tab>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useSession();
  const state = (location.state ?? null) as LoginState | null;
  const notice = state?.notice ?? null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint =
      tab === "admin" ? "/api/auth/login/admin" : "/api/auth/login/client";

    try {
      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Identifiants incorrects.");
        return;
      }

      const role = data.user?.role;

      if (role !== "client" && role !== "admin") {
        setError("Réponse inattendue du serveur.");
        return;
      }

      // Aucun jeton à ranger : la session est un cookie httpOnly posé par le
      // serveur, invisible pour ce code.
      await refresh();

      navigate(destinationFor(role, safePath(state?.from?.pathname)), {
        replace: true,
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
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === "client" ? "active" : ""}`}
            onClick={() => setTab("client")}
          >
            Client
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "admin" ? "active" : ""}`}
            onClick={() => setTab("admin")}
          >
            Admin
          </button>
        </div>

        <form className="auth-form-wrapper" onSubmit={handleSubmit}>
          <h1 className="auth-title">Saisissez vos identifiants</h1>

          {/* <output> a le rôle ARIA « status » d'origine : le message est
              annoncé aux lecteurs d'écran alors que la page ne change pas. */}
          {notice && !error && (
            <output className="auth-notice">{notice}</output>
          )}

          {error && <output className="auth-error">{error}</output>}

          <div className="auth-fields">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">
                Mot de passe
              </label>
              <div className="auth-password-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  title={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="auth-footer">
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>

            <p className="auth-switch">
              <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
            </p>

            <p className="auth-switch">
              Pas encore de compte ? <Link to="/sign-in">Créer un compte</Link>
            </p>
          </div>
        </form>
      </div>

      <div className="auth-visual" />
    </div>
  );
}
