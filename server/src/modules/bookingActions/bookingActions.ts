import type { RequestHandler } from "express";
import type { PoolConnection } from "mysql2/promise";
import databaseLeLocal from "../../../database/client";
import { monthsBetween } from "../Payment/amount";
import activityRepository from "../activity/activityRepository";
import spaceRepository from "../space/spaceRepository";
import timeSlotRepository from "../timeSlot/timeSlotRepository";
import bookingRepository from "./bookingRepository";

/**
 * Le corps de la requête ne porte que des identifiants et des quantités.
 * Ni l'utilisateur (il vient du jeton) ni les prix (relus en base) ne sont
 * acceptés du client.
 */
type BookingPayload = {
  space_id: number;
  time_slot_id: number | null;
  start_date: string;
  end_date: string;
  seats: number | null;
  months: number | null;
};

// Créneau horaire utilisé par défaut quand aucun n'est fourni (ex: pour les "Local vide", qui n'ont pas vraiment de créneau mais en ont besoin pour être stockés dans la table `activity`)
const DEFAULT_TIME_SLOT_ID = 4;

/** Majoration du créneau « Journée », qui couvre matin et après-midi. */
const FULL_DAY_MULTIPLIER = 1.75;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Prix unitaire effectif, calculé depuis l'espace et le créneau lus en base. */
const effectivePriceFor = async (
  connection: PoolConnection,
  spacePriceUnit: number | string,
  timeSlotId: number,
  isLocal: boolean,
): Promise<number> => {
  const basePrice = Number(spacePriceUnit);

  if (isLocal) {
    return round2(basePrice);
  }

  const slot = await timeSlotRepository.readForBooking(connection, timeSlotId);
  const isFullDay = slot?.slot === "Journée";

  return round2(basePrice * (isFullDay ? FULL_DAY_MULTIPLIER : 1));
};

/**
 * POST /api/booking
 * Transforme le panier de l'utilisateur connecté en réservations.
 * Le corps de la requête est ignoré : l'utilisateur vient du jeton et les
 * prix sont relus en base.
 */
const create: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (userId == null) {
      res.status(401).json({ message: "Veuillez vous connecter." });
      return;
    }

    const created = await bookingRepository.createFromCart(userId);

    if (created === 0) {
      res.status(400).json({ message: "Votre panier est vide." });
      return;
    }

    res.status(201).json({ created });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/bookings
 * Ajoute une réservation au panier de l'utilisateur.
 *
 * Le traitement se divise en 3 branches selon la catégorie de l'espace :
 * 1. "Local vide" -> réservation sur une plage de dates : vérifie l'absence de chevauchement, crée toujours une nouvelle "activity".
 * 2. Espace exclusif (salle, studio...) -> réservation par créneau, un seul occupant possible : vérifie que le créneau n'est pas déjà pris.
 * 3. Espace "open" -> plusieurs places par créneau : vérifie qu'il reste assez de places disponibles avant d'ajouter au panier.
 *
 * Toute l'opération est faite dans une transaction SQL avec verrouillage de la ligne `space` (FOR UPDATE) afin d'éviter les race conditions si deux utilisateurs réservent en même temps (double-booking).
 */
const add: RequestHandler = async (req, res, next) => {
  const userId = req.user?.id;

  if (userId == null) {
    res.status(401).json({ message: "Veuillez vous connecter." });
    return;
  }

  const body = req.body as BookingPayload;

  // Validation basique des champs obligatoires
  if (!body.space_id || !body.start_date || !body.end_date) {
    res.status(400).json({ message: "Champs requis manquants" });
    return;
  }

  const effectiveTimeSlotId = body.time_slot_id ?? DEFAULT_TIME_SLOT_ID;
  const quantity = body.seats ?? 1;

  if (quantity < 1) {
    res.status(400).json({ message: "Quantité invalide" });
    return;
  }

  // Récupère une connexion dédiée du pool pour pouvoir ouvrir une transaction (begin/commit/rollback) propre à cette requête
  const connection = await databaseLeLocal.getConnection();

  try {
    await connection.beginTransaction();

    // Verrouille la ligne de l'espace pendant la transaction pour empêcher une autre requête concurrente de lire/modifier sa disponibilité au même moment (évite le double-booking)
    const space = await spaceRepository.readForUpdate(
      connection,
      body.space_id,
    );
    if (space == null) {
      await connection.rollback();
      res.status(404).json({ message: "Espace introuvable" });
      return;
    }

    const isOpenSpace = space.space_category.toLowerCase().includes("open");
    const isLocal = space.space_category === "Local vide";

    // Prix relus en base : le client n'a pas voix au chapitre.
    const effectivePrice = await effectivePriceFor(
      connection,
      space.price_unit,
      effectiveTimeSlotId,
      isLocal,
    );

    // --- Branche 1 : "Local vide" (réservation sur une période) ---
    if (isLocal) {
      const months = monthsBetween(body.start_date, body.end_date);

      if (months < 1) {
        await connection.rollback();
        res.status(400).json({
          message: "Un local se réserve pour un mois complet au minimum",
        });
        return;
      }

      // Vérifie qu'aucune réservation existante ne chevauche la période demandée
      const overlapping = await spaceRepository.hasOverlappingDateRange(
        connection,
        body.space_id,
        body.start_date,
        body.end_date,
      );
      if (overlapping) {
        await connection.rollback();
        res.status(409).json({
          message:
            "Ce local est déjà réservé sur une période qui chevauche les dates demandées",
        });
        return;
      }

      // Pour un local, chaque réservation correspond à une période distincte : on crée donc toujours une nouvelle activity (pas de réutilisation, contrairement aux deux autres branches)
      const activity = await activityRepository.create({
        timeSlotId: effectiveTimeSlotId,
        spaceId: body.space_id,
        startDate: body.start_date,
        endDate: body.end_date,
        priceUnit: effectivePrice,
        urlImage: space.url_image,
      });

      const [result] = await connection.query(
        `INSERT INTO cart (quantity, total_price, price_unit, users_id, id_activity)
 VALUES (?, ?, ?, ?, ?)`,
        [
          quantity,
          round2(effectivePrice * months),
          effectivePrice,
          userId,
          activity.id,
        ],
      );

      await connection.commit();
      res.status(201).json({
        cartItemId: (result as { insertId: number }).insertId,
        activityId: activity.id,
      });
      return;
    }

    // --- Branche 2 : espace exclusif (un seul occupant par créneau) ---
    if (!isOpenSpace) {
      const taken = await spaceRepository.isSlotTaken(
        connection,
        body.space_id,
        body.start_date,
        effectiveTimeSlotId,
      );
      if (taken) {
        await connection.rollback();
        res.status(409).json({
          message: "Ce créneau est déjà réservé pour cet espace",
        });
        return;
      }

      // findOrCreate : pour un même espace/date/créneau, on réutilise la même "activity" si elle existe déjà au lieu d'en créer une nouvelle
      const activity = await activityRepository.findOrCreate(connection, {
        timeSlotId: effectiveTimeSlotId,
        spaceId: body.space_id,
        startDate: body.start_date,
        endDate: body.end_date,
        priceUnit: effectivePrice,
        urlImage: space.url_image,
      });

      const [result] = await connection.query(
        `INSERT INTO cart (quantity, total_price, price_unit, users_id, id_activity)
 VALUES (?, ?, ?, ?, ?)`,
        [quantity, effectivePrice, effectivePrice, userId, activity.id],
      );

      await connection.commit();
      res.status(201).json({
        cartItemId: (result as { insertId: number }).insertId,
        activityId: activity.id,
      });
      return;
    }

    // --- Branche 3 : espace "open" (plusieurs places par créneau) ---
    const activity = await activityRepository.findOrCreate(connection, {
      timeSlotId: effectiveTimeSlotId,
      spaceId: body.space_id,
      startDate: body.start_date,
      endDate: body.end_date,
      priceUnit: effectivePrice,
      urlImage: space.url_image,
    });

    // Recalcule le nombre de places déjà réservées (valeur fiable car on est dans la transaction, avec le verrou posé plus haut sur `space`)
    const booked = await spaceRepository.countBookedSeats(
      connection,
      body.space_id,
      body.start_date,
      effectiveTimeSlotId,
    );
    const available = Math.max(space.capacity - booked, 0);

    // Refuse la réservation si la quantité demandée dépasse les places restantes
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

    const [result] = await connection.query(
      `INSERT INTO cart (quantity, total_price, price_unit, users_id, id_activity)
 VALUES (?, ?, ?, ?, ?)`,
      [
        quantity,
        round2(effectivePrice * quantity),
        effectivePrice,
        userId,
        activity.id,
      ],
    );

    await connection.commit();

    res.status(201).json({
      cartItemId: (result as { insertId: number }).insertId,
      activityId: activity.id,
    });
  } catch (err) {
    // En cas d'erreur inattendue, on annule toute la transaction pour ne rien laisser dans un état incohérent
    await connection.rollback();
    next(err);
  } finally {
    // La connexion est toujours rendue au pool, succès ou échec
    connection.release();
  }
};

export default { add, create };
