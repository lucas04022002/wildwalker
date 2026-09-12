import type { RequestHandler } from "express";
import Joi from "joi";

const eventsOftheDaySchema = {
  // Schéma pour valider req.params
  browseByDate: Joi.object({
    date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/) // Force le format AAAA-MM-JJ via Regex
      .required()
      .messages({
        "string.pattern.base": "La date doit être au format valide YYYY-MM-DD.",
        "any.required": "La date est obligatoire.",
      }),
  }),
};

const validateEventsDate: RequestHandler = (req, res, next) => {
  const { error } = eventsOftheDaySchema.browseByDate.validate(req.params);

  if (error) {
    res.status(400).json({
      error:
        "La date de l'événement est invalide (format attendu : YYYY-MM-DD).",
    });
    return;
  }

  next();
};

/**
 * Demande d'événement d'un client :
 * `POST /api/dashboard/client/event-requests`.
 *
 * Le corps arrive en multipart (il porte une image) : tout y est du texte,
 * et `Number("gratuit")` vaut `NaN` — qui n'est ni `null` ni `undefined`,
 * donc que `?? 0` ne rattrape pas. Joi convertit et refuse ici, avant que
 * quoi que ce soit n'atteigne la base.
 *
 * Ni `users_id` ni `status` ne sont acceptés : le premier vient du jeton, le
 * second est posé par le serveur (`pending`). `stripUnknown` les retire.
 */
const eventRequestSchema = Joi.object({
  name: Joi.string().trim().min(2).max(155).required(),
  description: Joi.string().trim().max(2000).allow("").default(""),
  start_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  end_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  space_id: Joi.number().integer().positive().required(),
  time_slot_id: Joi.number().integer().positive().required(),
  // Un événement gratuit est légitime : 0 est accepté, le négatif non.
  // `Joi.number()` refuse déjà `NaN` et `Infinity`, comme `Number.isFinite`.
  price_unit: Joi.number().min(0).default(0),
});

const validateEventRequest: RequestHandler = (req, res, next) => {
  const { error, value } = eventRequestSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    res.status(400).json({
      errors: error.details.map((detail) => detail.message),
    });
    return;
  }

  // Ceinture et bretelles : Joi a converti, on vérifie tout de même que le
  // nombre qui part en base en est un.
  if (!Number.isFinite(value.price_unit) || value.price_unit < 0) {
    res.status(400).json({
      errors: ["Le champ price_unit doit être un nombre positif ou nul."],
    });
    return;
  }

  req.body = value;
  next();
};

export default { validateEventsDate, validateEventRequest };
