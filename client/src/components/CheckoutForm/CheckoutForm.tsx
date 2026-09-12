import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useState } from "react";
import { apiFetch } from "../../hooks/apiFetch";

interface Props {
  totalPrice: number;
  onSuccess: () => void;
}

/**
 * Message affiché quand la carte a été débitée mais que la réservation n'a pas
 * été enregistrée. C'est le pire cas possible pour l'utilisateur : il doit le
 * savoir tout de suite, et surtout pas voir un écran de confirmation.
 */
const BOOKING_FAILED =
  "Paiement encaissé mais réservation non enregistrée : contactez-nous en indiquant votre e-mail.";

function CheckoutForm({ totalPrice, onSuccess }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isPaid) return;

    setIsLoading(true);
    setErrorMessage("");

    // `isPaid` (l'état) ne change pas dans cette closure : on suit le débit
    // avec une variable locale pour savoir quel message afficher si ça casse.
    let paid = false;

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/confirmation`,
        },
        redirect: "if_required",
      });

      if (error) {
        setErrorMessage(error.message ?? "Une erreur est survenue.");
        return;
      }

      paid = true;
      setIsPaid(true);

      // La référence de l'intention est la SEULE chose transmise : le
      // serveur la relit chez Stripe et la confronte au panier. Ni montant
      // ni panier ne voyagent depuis le navigateur.
      const response = await apiFetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: paymentIntent?.id }),
      });

      if (!response.ok) {
        setErrorMessage(BOOKING_FAILED);
        return;
      }

      onSuccess();
    } catch {
      // Réseau coupé : le message dépend de ce qui a déjà eu lieu. Après le
      // débit, c'est la situation à signaler d'urgence.
      setErrorMessage(
        paid ? BOOKING_FAILED : "Une erreur est survenue, veuillez réessayer.",
      );
    } finally {
      // Quoi qu'il arrive, le bouton doit redevenir utilisable.
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <h2>Paiement sécurisé</h2>

      <PaymentElement />

      {/* <output> : rôle « status », annoncé sans changement de page. */}
      {errorMessage && (
        <output className="checkout-error">{errorMessage}</output>
      )}

      <button type="submit" disabled={isLoading || !stripe}>
        {isLoading ? "Traitement..." : `Payer ${totalPrice.toFixed(2)} €`}
      </button>
    </form>
  );
}

export default CheckoutForm;
