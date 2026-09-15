import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import CheckoutForm from "../../components/CheckoutForm/CheckoutForm";
import "./Payment.css";
import { apiFetch } from "../../hooks/apiFetch";
import { useSession } from "../../hooks/useSession";

const SESSION_PERDUE =
  "Votre session a expiré. Reconnectez-vous pour finaliser votre commande.";

const PAIEMENT_INDISPONIBLE =
  "Le paiement en ligne n'est pas disponible pour le moment. Votre panier est conservé.";

function Payment() {
  /**
   * Stripe est chargé ici, et pas au niveau du module.
   *
   * Au niveau du module, l'appel partait dès qu'un fichier de routes importait
   * cette page — donc sur toutes les pages du site — et levait purement et
   * simplement quand la clé manquait. Dans le composant, le script n'est
   * demandé que par la page de paiement, et l'absence de clé devient un état
   * affichable plutôt qu'une exception.
   */
  const stripePromise = useMemo(() => {
    const cle = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    return cle ? loadStripe(cle) : null;
  }, []);

  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState("");
  /** Montant en centimes, tel que le serveur l'a calculé depuis le panier. */
  const [amountInCents, setAmountInCents] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sans Stripe, une intention de paiement ne sera jamais confirmée :
    // la demander ne ferait qu'en abandonner une de plus côté Stripe.
    if (!stripePromise) return;

    // Corps vide : le montant est relu en base à partir du panier de
    // l'utilisateur connecté. Un prix envoyé par le client serait un prix
    // choisi par le client.
    apiFetch("/api/payment/create-intent", { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setError(data?.message ?? "Le paiement n'a pas pu être préparé.");
          return;
        }

        setClientSecret(data.clientSecret);
        setAmountInCents(data.amount ?? 0);
      })
      .catch(() => setError("Impossible de contacter le serveur."));
  }, [stripePromise]);

  const erreurAffichee = !stripePromise
    ? PAIEMENT_INDISPONIBLE
    : !loading && !user
      ? SESSION_PERDUE
      : error;

  if (erreurAffichee) {
    return (
      <section className="payment-page">
        <h1>Finaliser votre commande</h1>
        <output>{erreurAffichee}</output>
      </section>
    );
  }

  if (loading || !clientSecret) {
    return <p>Chargement du paiement...</p>;
  }

  const totalPrice = amountInCents / 100;

  /**
   * Appelé uniquement quand `POST /api/booking` a réussi. Le panier a déjà été
   * vidé côté serveur, dans la même transaction que les réservations : rien à
   * nettoyer depuis le navigateur. La navigation est explicite, elle ne dépend
   * plus du succès d'un appel de suppression.
   */
  const handlePaymentSuccess = () => {
    navigate("/confirmation", { replace: true });
  };

  return (
    <section className="payment-page">
      <h1>Finaliser votre commande</h1>
      <p>
        Total à payer : <strong>{totalPrice.toFixed(2)} €</strong>
      </p>

      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CheckoutForm
          totalPrice={totalPrice}
          onSuccess={handlePaymentSuccess}
        />
      </Elements>
    </section>
  );
}

export default Payment;
