import type { RequestHandler } from "express";
import databaseLeLocal from "../../../database/client";
import eventRepository from "../event/eventRepository";
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

// Browse — GET /api/cart
// Retourne tous les articles du panier de l'utilisateur connecté
const browse: RequestHandler = async (req, res, next) => {
  try {
    const userId = currentUserId(req);

    if (userId == null) {
      res.status(401).json({ message: "Veuillez vous connecter." });
      return;
    }

    const items = await cartRepository.readAll(userId);
    res.json(items);
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
    // middleware a déjà tout converti en nombres.
    const { event_id, quantity, total_price } = req.body;

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

    const newItem = {
      users_id: userId,
      id_activity: event_id,
      quantity,
      total_price,
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

// Edit — PATCH /api/cart/:id
// Body attendu : { quantity }
const edit: RequestHandler = async (req, res, next) => {
  try {
    const userId = currentUserId(req);

    if (userId == null) {
      res.status(401).json({ message: "Veuillez vous connecter." });
      return;
    }

    const cartItemId = Number(req.params.id);
    const { quantity } = req.body; // number validé avec joi

    const affectedRows = await cartRepository.updateQuantity(
      cartItemId,
      userId,
      quantity,
    );

    // 0 ligne : elle n'existe pas, ou elle est à quelqu'un d'autre.
    if (affectedRows === 0) {
      res.sendStatus(404);
    } else {
      res.sendStatus(204);
    }
  } catch (err) {
    next(err);
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

// DestroyAll — DELETE /api/cart/user/:userId
// Vide le panier de l'utilisateur connecté (ex: après paiement).
// Le `:userId` de l'URL est ignoré, le client sera nettoyé à la tâche 3.
const destroyAll: RequestHandler = async (req, res, next) => {
  try {
    const userId = currentUserId(req);

    if (userId == null) {
      res.status(401).json({ message: "Veuillez vous connecter." });
      return;
    }

    await cartRepository.destroyAll(userId);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
};

export default { browse, addEvent, edit, destroy, destroyAll };
