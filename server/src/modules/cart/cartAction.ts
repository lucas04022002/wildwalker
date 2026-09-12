import type { RequestHandler } from "express";
import databaseLeLocal from "../../../database/client";
import { type CartPriceRow, lineAmountInEuros } from "../Payment/amount";
import eventRepository from "../event/eventRepository";
import spaceRepository from "../space/spaceRepository";
import cartRepository from "./cartRepository";

/**
 * Le panier appartient à l'utilisateur du jeton, et à lui seul.
 *
 * Aucune route du panier ne lit d'identifiant d'utilisateur dans l'URL ni
 * dans le corps de la requête : tout part de `req.user.id`, posé par
 * `requireAuth`.
 */
const currentUserId = (req: Parameters<RequestHandler>[0]): number | null =>
  req.user?.id ?? null;

/** Arrondi au centime : les montants affichés sont des euros. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Browse — GET /api/cart
 *
 * Retourne `{ items, total }` pour le panier de l'utilisateur connecté.
 * Chaque ligne porte son `line_amount` en euros, calculé ici par la MÊME
 * fonction que le paiement (`amount.ts`). Le client ne multiplie plus rien :
 * un « Local vide » se loue au mois, et `price_unit × quantity` sous-facturait
 * la location d'un facteur égal au nombre de mois.
 */
const browse: RequestHandler = async (req, res, next) => {
  try {
    const userId = currentUserId(req);

    if (userId == null) {
      res.status(401).json({ message: "Veuillez vous connecter." });
      return;
    }

    const rows = await cartRepository.readAll(userId);

    const items = rows.map((row) => ({
      ...row,
      line_amount: lineAmountInEuros(row as CartPriceRow),
    }));

    const total = round2(
      items.reduce((sum, item) => sum + item.line_amount, 0),
    );

    res.json({ items, total });
  } catch (err) {
    next(err);
  }
};

// Add — POST /api/cart
// Body attendu : { event_id, quantity, total_price, ... }
const addEvent: RequestHandler = async (req, res, next) => {
  const userId = currentUserId(req);

  if (userId == null) {
    res.status(401).json({ message: "Veuillez vous connecter." });
    return;
  }

  const connection = await databaseLeLocal.getConnection();
  try {
    // middleware a déjà tout converti en nombres. `total_price` du corps de
    // la requête est ignoré : le prix est relu en base ci-dessous.
    const { event_id, quantity } = req.body;

    await connection.beginTransaction();

    const remainingSlots = await eventRepository.readRemainingSlotsByEvent(
      connection,
      event_id,
    );

    if (remainingSlots === null) {
      await connection.rollback();
      res.sendStatus(404);
      return;
    }

    if (quantity > remainingSlots) {
      await connection.rollback();
      res.status(409).json({ remaining_slots: remainingSlots });
      return;
    }

    const pricing = await eventRepository.readPricingForUpdate(
      connection,
      event_id,
    );

    if (pricing == null) {
      await connection.rollback();
      res.sendStatus(404);
      return;
    }

    // Prix d'une unité, durée comprise (un « Local vide » se loue au mois).
    const unitTotal = lineAmountInEuros({
      quantity: 1,
      price_unit: pricing.price_unit,
      space_category: pricing.space_category,
      start_date: pricing.start_date,
      end_date: pricing.end_date,
    });

    const newItem = {
      users_id: userId,
      id_activity: event_id,
      quantity,
      unitTotal,
    };

    const insertId = await cartRepository.create(connection, newItem);
    // ON COMMIT pour valider définitivement en BDD
    await connection.commit();
    // ON RÉPOND au front après le succès du commit
    res.status(201).json({ insertId });
  } catch (err) {
    // Si ça plante n'importe où, on annule tout
    await connection.rollback();
    next(err);
  } finally {
    // TRÈS IMPORTANT : On libère la connexion pour les autres utilisateurs
    connection.release();
  }
};

/**
 * Edit — PATCH /api/cart/:id
 * Body attendu : { quantity } — un entier strictement positif, et rien d'autre.
 *
 * Deux contrôles, dans cet ordre :
 *
 * 1. la quantité est revalidée ici, en plus du schéma Joi. Le contrôle du
 *    middleware peut être contourné par une route ajoutée sans lui ; celui-ci
 *    ne peut pas l'être, il est dans l'action elle-même.
 * 2. la capacité est revérifiée sous verrou. Un panier constitué quand il
 *    restait de la place pouvait être gonflé plus tard, une fois l'espace
 *    plein : le contrôle à l'ajout (`addEvent`) ne suffit pas.
 */
const edit: RequestHandler = async (req, res, next) => {
  const userId = currentUserId(req);

  if (userId == null) {
    res.status(401).json({ message: "Veuillez vous connecter." });
    return;
  }

  const quantity = Number(req.body?.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    res
      .status(400)
      .json({ message: "La quantité doit être un entier supérieur à 0." });
    return;
  }

  const cartItemId = Number(req.params.id);
  const connection = await databaseLeLocal.getConnection();

  try {
    await connection.beginTransaction();

    const line = await cartRepository.readLineForUpdate(
      connection,
      cartItemId,
      userId,
    );

    // Ligne inexistante, ou à quelqu'un d'autre : même réponse, rien ne fuit.
    if (line == null) {
      await connection.rollback();
      res.sendStatus(404);
      return;
    }

    // Verrou sur l'espace : c'est lui qui sérialise deux modifications
    // concurrentes visant le même créneau.
    const space = await spaceRepository.readForUpdate(
      connection,
      Number(line.space_id),
    );

    if (space == null) {
      await connection.rollback();
      res.sendStatus(404);
      return;
    }

    const bookingDate = new Date(line.start_date).toISOString().slice(0, 10);

    // `countBookedSeats` compte AUSSI la ligne en cours de modification :
    // on la retire, sinon augmenter de 1 en coûterait deux.
    const booked = await spaceRepository.countBookedSeats(
      connection,
      Number(line.space_id),
      bookingDate,
      Number(line.time_slot_id),
    );
    const available = Math.max(
      Number(space.capacity) - (booked - Number(line.quantity)),
      0,
    );

    if (quantity > available) {
      await connection.rollback();
      res.status(409).json({
        message:
          available > 0
            ? `Plus que ${available} place${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""} pour ce créneau`
            : "Plus aucune place disponible pour ce créneau",
        available,
      });
      return;
    }

    // Le total suit la quantité, calculé depuis le prix lu en base.
    const totalPrice = lineAmountInEuros({
      quantity,
      price_unit: line.price_unit,
      space_category: line.space_category,
      start_date: line.start_date,
      end_date: line.end_date,
    });

    const affectedRows = await cartRepository.updateQuantity(
      connection,
      cartItemId,
      userId,
      quantity,
      totalPrice,
    );

    if (affectedRows === 0) {
      await connection.rollback();
      res.sendStatus(404);
      return;
    }

    await connection.commit();
    res.sendStatus(204);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// Destroy — DELETE /api/cart/:id
// Supprime un article précis du panier de l'utilisateur connecté
const destroy: RequestHandler = async (req, res, next) => {
  try {
    const userId = currentUserId(req);

    if (userId == null) {
      res.status(401).json({ message: "Veuillez vous connecter." });
      return;
    }

    const cartItemId = Number(req.params.id);
    const affectedRows = await cartRepository.destroy(cartItemId, userId);

    if (affectedRows === 0) {
      res.sendStatus(404);
    } else {
      res.sendStatus(204);
    }
  } catch (err) {
    next(err);
  }
};

export default { browse, addEvent, edit, destroy };
