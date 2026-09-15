import { MessageSquareWarning } from "lucide-react";
import { useState } from "react";
import useBillingClient from "../../../hooks/useBillingClient";
import useCreateClaim from "../../../hooks/useCreateClaim";
import "./ClaimClient.css";
import { useSession } from "../../../hooks/useSession";

const CATEGORIES = [
  "Espace",
  "Équipement",
  "Événement",
  "Facturation",
  "Autre",
];

function ClaimClient() {
  const { user } = useSession();
  const [category, setCategory] = useState("Espace");
  const [title, setTitle] = useState("");
  const [activityId, setActivityId] = useState("");
  const [message, setMessage] = useState("");
  const billing = useBillingClient(user?.id ?? 0);
  const { createClaim } = useCreateClaim();
  const [success, setSuccess] = useState(false);
  const [echec, setEchec] = useState(false);

  function handleSubmit() {
    setEchec(false);
    createClaim(user?.id ?? 0, {
      title,
      category,
      message,
      activity_id: activityId,
    }).then((envoyee) => {
      // On ne vide le formulaire que si la réclamation est réellement partie :
      // sinon l'utilisateur perdrait son texte en même temps que sa réclamation.
      if (!envoyee) {
        setEchec(true);
        return;
      }
      setTitle("");
      setMessage("");
      setActivityId("");
      setCategory("Espace");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  return (
    <section className="claim-client__container">
      <h2 className="claim-client__title">
        <MessageSquareWarning
          size={20}
          color="var(--color-primary)"
          aria-hidden="true"
        />{" "}
        une réclamation
      </h2>
      <p className="claim-client__subtitle">
        Notre équipe vous répondra dans les 48h.
      </p>

      <div className="claim-client__field">
        <label className="claim-client__label" htmlFor="claim-title">
          Titre
        </label>
        <input
          id="claim-title"
          type="text"
          className="claim-client__input"
          placeholder="Objet de votre réclamation..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="claim-client__categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`claim-client__category ${category === cat ? "claim-client__category--active" : ""}`}
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="claim-client__field">
        <label className="claim-client__label" htmlFor="claim-activity">
          Réservation concernée
        </label>
        <select
          id="claim-activity"
          className="claim-client__select"
          value={activityId}
          onChange={(e) => setActivityId(e.target.value)}
        >
          <option value="">Choisissez une réservation...</option>
          {billing.map((item) => (
            <option key={item.id} value={item.id}>
              FAC-{item.bills_number} — {item.name || item.space_name} —{" "}
              {item.start_date.slice(0, 10)}
            </option>
          ))}
        </select>
      </div>

      <div className="claim-client__field">
        <label className="claim-client__label" htmlFor="claim-message">
          Votre message
        </label>
        <textarea
          id="claim-message"
          className="claim-client__textarea"
          placeholder="Décrivez votre problème en détail..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
        />
      </div>
      {success && (
        <p className="claim-client__success" role="alert">
          ✓ Votre réclamation a bien été envoyée !
        </p>
      )}
      {echec && (
        <p className="claim-client__error" role="alert">
          Votre réclamation n’a pas pu être envoyée. Votre texte est conservé —
          vérifiez que vous êtes toujours connecté, puis réessayez.
        </p>
      )}
      <button
        type="button"
        className="claim-client__submit"
        onClick={handleSubmit}
        disabled={!title || !message || !activityId}
        aria-disabled={!title || !message || !activityId}
      >
        Envoyer la réclamation →
      </button>
    </section>
  );
}

export default ClaimClient;
