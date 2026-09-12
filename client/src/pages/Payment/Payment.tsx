import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import CheckoutForm from "../../components/CheckoutForm/CheckoutForm";
import "./Payment.css";
import { apiFetch } from "../../hooks/apiFetch";
import useClearCart from "../../hooks/useClearCart";
import { useSession } from "../../hooks/useSession";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function Payment() {
  const { user } = useSession();
  const [clientSecret, setClientSecret] = useState("");
  /** Montant en centimes, tel que le serveur l'a calculé depuis le panier. */
  const [amountInCents, setAmountInCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const clearCart = useClearCart();

  useEffect(() => {
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
  }, []);

  if (error) {
    return (
      <section className="payment-page">
        <h1>Finaliser votre commande</h1>
        <p>{error}</p>
      </section>
    );
  }

  if (!clientSecret) {
    return <p>Chargement du paiement...</p>;
  }

  const totalPrice = amountInCents / 100;

  const handlePaymentSuccess = async () => {
    if (!user?.id) {
      console.error("Pas d'ID utilisateur trouvé.");
      return;
    }
    await clearCart(user.id);
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
