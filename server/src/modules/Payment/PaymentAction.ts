import type { RequestHandler } from "express";
import paymentRepository from "./PaymentRepository";

/**
 * POST /api/payment/create-intent
 *
 * Le montant vient du panier de l'utilisateur authentifié, lu en base. Tout
 * montant envoyé dans le corps de la requête est ignoré.
 */
const createIntent: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (userId == null) {
      res.status(401).json({ message: "Veuillez vous connecter." });
      return;
    }

    const amountInCents = await paymentRepository.amountForUser(userId);

    if (amountInCents <= 0) {
      res.status(400).json({ message: "Votre panier est vide." });
      return;
    }

    // `userId` part en metadata : la réservation vérifiera plus tard que
    // l'intention présentée est bien celle de cet utilisateur.
    const clientSecret = await paymentRepository.createPaymentIntent(
      amountInCents,
      userId,
    );

    res.json({ clientSecret, amount: amountInCents });
  } catch (err) {
    next(err);
  }
};

export default { createIntent };
