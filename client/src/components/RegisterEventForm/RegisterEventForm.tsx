import "./RegisterEventForm.css";
import { useEffect, useState } from "react";
import { apiFetch } from "../../hooks/apiFetch";
import { useEventModalContext } from "../../hooks/useEventModalContext";
import type { CartItem } from "../../types/cartitem";
import type { QuantityConfig } from "../../types/quantityconfig";

interface CardEventProps {
  event: {
    id: number;
    name: string;
    description: string;
    space_name: string;
    url_image: string;
    price_unit: number;
    start_date: string;
    start_hour: string;
    end_hour: string;
    capacity: number;
  };

  participants?: {
    id_activity: number;
    name: string;
    sum_participants: number;
    remaining_slots: number;
    capacity: number;
  };
}

interface EventFormData {
  nom: string;
  prenom: string;
  email: string;
}

function RegisterEventForm({ event, participants }: CardEventProps) {
  const { setIsForm } = useEventModalContext();

  const [formData, setFormData] = useState<EventFormData>({
    nom: "",
    prenom: "",
    email: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const [quantityConfig, setQuantityConfig] = useState<QuantityConfig>({
    value: 1,
    min: 1,
    max: participants?.remaining_slots ?? event.capacity,
  });

  const { value, min, max } = quantityConfig;
  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState<boolean>(false);
  const [totalPrice, setTotalPrice] = useState<number>(event.price_unit);

  function decreaseQuantity() {
    if (value === min) return;
    setQuantityConfig((prev) => ({ ...prev, value: prev.value - 1 }));
    setMessage("");
  }

  function increaseQuantity() {
    if (value === max) {
      setIsError(true);
      setMessage(`Désolé, il ne reste plus que ${max} place(s) disponible(s).`);
      return;
    }
    setQuantityConfig((prev) => ({ ...prev, value: prev.value + 1 }));
    setMessage("");
  }

  useEffect(() => {
    async function fetchTotalPrice() {
      try {
        const response = await apiFetch(`/api/events/${event.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: event.id, quantity: value }),
        });

        if (response.status === 200) {
          const data = await response.json();
          if (typeof data === "number") {
            setTotalPrice(data);
          } else {
            setMessage("Impossible de calculer le prix pour cet évènement.");
            setIsError(true);
          }
        } else {
          const errorData = await response.json();
          setMessage(errorData.error || "Erreur lors du calcul du prix.");
          setIsError(true);
        }
      } catch (err) {
        setMessage("Une erreur réseau est survenue.");
        setIsError(true);
      }
    }

    fetchTotalPrice();
  }, [value, event.id]);

  async function handleSubmit(e: React.ChangeEvent<HTMLFormElement>) {
    e.preventDefault();

    // on sauvegarde le formulaire avant le await
    const form = e.currentTarget;

    // On construit l'objet proprement au moment du clic, avec la quantité à
    // jour. Ni `users_id` ni `total_price` : le propriétaire de la ligne vient
    // du cookie de session, et le prix est relu en base par le serveur.
    const eventBookingPayload: CartItem = {
      event_id: event.id,
      quantity: quantityConfig.value,
      last_name: formData.nom,
      first_name: formData.prenom,
      email: formData.email,
    };

    try {
      const response = await apiFetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBookingPayload),
      });

      if (response.status === 401) {
        const errorData = await response.json();
        setMessage(errorData.message);
        setIsError(true);
        return;
      }

      if (response.status === 400) {
        const errorData = await response.json();
        const messageCombine = errorData.errors.join("\n");
        setMessage(messageCombine);
        setIsError(true);
        return;
      }

      if (response.status === 404) {
        setMessage("Impossible de trouver cet évènement.");
        setIsError(true);
        return;
      }

      if (response.status === 409) {
        const data = await response.json();
        if (data.remaining_slots === 0) {
          setMessage("Nous sommes désolés, cet évènement est complet.");
          setIsError(true);
          setQuantityConfig((prev) => ({
            ...prev,
            value: data.remaining_slots,
            min: data.remaining_slots,
            max: data.remaining_slots,
          }));
        } else {
          setMessage(
            `Désolé, il ne reste plus que ${data.remaining_slots} place(s) disponible(s).`,
          );
          setIsError(true);
          setQuantityConfig((prev) => ({ ...prev, max: data.remaining_slots }));
        }
        return;
      }

      if (response.status === 201) {
        setMessage("Inscription ajoutée au panier !");
        setIsError(false);
        form.reset();
        setQuantityConfig((prev) => ({ ...prev, value: 1, error: null }));
        return;
      }

      // si le back renvoie un code inattendu (ex: 500)
      setMessage("Une erreur inattendue est survenue.");
      setIsError(true);
    } catch (err) {
      setMessage("Impossible de contacter le serveur.");
      setIsError(true);
    }
  }

  return (
    <article className="register-form-overlay">
      <form
        className="register-form"
        action="#"
        method="post"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="register-form-container-title-button">
          <h2 className="register-form-title">S'inscrire à l'évènement</h2>

          <button
            type="button"
            className="register-event-modal-close"
            aria-label="Fermer la pop-up d'inscription"
            onClick={() => setIsForm(false)}
          >
            ✕
          </button>
        </div>

        <ul className="register-form-events-infos-container">
          <li className="register-form-events-infos-row">{event.name}</li>

          <li className="register-form-events-infos-row">
            {event.start_date &&
              `${event.start_date.slice(8, 10)}-${event.start_date.slice(5, 7)}-${event.start_date.slice(0, 4)}`}{" "}
            | {event.start_hour?.slice(0, 5)} - {event.end_hour?.slice(0, 5)}
          </li>

          <li className="register-form-events-infos-row">
            {event.space_name} -{" "}
            {event.price_unit === 0 ? "Gratuit" : `${event.price_unit} €`}
          </li>
        </ul>

        <div className="register-form-customer-infos-container">
          <label htmlFor="lastname" className="register-form-label">
            Nom
          </label>

          <input
            type="text"
            id="lastname"
            name="nom"
            placeholder="Votre nom"
            value={formData.nom}
            onChange={handleChange}
            required
            className="register-form-input"
          />

          <label htmlFor="firstname" className="register-form-label">
            Prénom
          </label>

          <input
            type="text"
            id="firstname"
            name="prenom"
            placeholder="Votre prénom"
            value={formData.prenom}
            onChange={handleChange}
            required
            className="register-form-input"
          />

          <label htmlFor="email" className="register-form-label">
            Email
          </label>

          <input
            type="email"
            id="email"
            name="email"
            placeholder="Votre email"
            value={formData.email}
            onChange={handleChange}
            required
            className="register-form-input"
          />

          <div className="register-form-quantity">
            <div className="register-form-quantity-selector">
              <label
                htmlFor="quantity"
                className="register-form-quantity-label"
              >
                Nombre de places
              </label>

              {/*bouton -1 */}

              <button
                type="button"
                onClick={decreaseQuantity}
                className="btn-quantity"
                aria-label="Retirer une place" //accessibilité, lit le bouton
                aria-disabled={value === min} // accessibilité : indique le blocage sans couper le JavaScript
              >
                -
              </button>

              <input
                type="number"
                id="quantity"
                name="quantity"
                value={quantityConfig.value}
                onChange={handleChange}
                min={min}
                max={max}
                readOnly
              />

              {/*bouton +1 */}

              <button
                type="button"
                onClick={increaseQuantity}
                className="btn-quantity"
                aria-label="Ajouter une place"
                aria-disabled={value === max}
              >
                +
              </button>
            </div>

            <p className="register-form-total-price">
              Total : {totalPrice === 0 ? "Gratuit" : `${totalPrice}€`}
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="register-form-submit"
          aria-label="Valider mon inscription"
          aria-disabled={max === 0}
        >
          Je m'inscris !
        </button>

        {message && (
          <span
            className={`event-form-confirmation-message ${isError ? "event-message-error" : "event-message-success"}`}
          >
            {message}
          </span>
        )}
      </form>
    </article>
  );
}

export default RegisterEventForm;
