import type { RequestHandler } from "express";
import Joi from "joi";

// Schéma pour la CRÉATION (POST)
// `users_id` n'est volontairement pas accepté : le propriétaire de la ligne
// vient du jeton de session. `stripUnknown` le retire s'il est envoyé.
const addEventSchema = Joi.object({
  event_id: Joi.number().integer().positive().required(),
  quantity: Joi.number().integer().positive().required(),
  total_price: Joi.number().min(0).required(),
  last_name: Joi.string()
    .pattern(/^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/)
    .min(2)
    .max(50)
    .required(),
  first_name: Joi.string()
    .pattern(/^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/)
    .min(2)
    .max(50)
    .required(),
  email: Joi.string().email().required(),
});

// Schéma pour la MISE À JOUR (PUT/PATCH)
const updateCartSchema = Joi.object({
  quantity: Joi.number().integer().positive().optional(),
  total_price: Joi.number().min(0).optional(),
})
  .min(1) // Au moins un des deux champs doit être fourni
  .messages({
    "object.min":
      "Vous devez fournir au moins un champ à modifier (quantity ou total_price).",
  });

// schéma pour la SUPPRESSION d'un item (delete)
const deleteItemSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

// fonction de validation du body (add, edit)
const validateBody = (schema: Joi.ObjectSchema): RequestHandler => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      messages: {
        "any.required": "Le champ {#label} est obligatoire.",
        "number.base": "Le champ {#label} doit être un nombre.",
        "number.integer": "Le champ {#label} doit être un entier.",
        "number.positive": "Le champ {#label} doit être supérieur à 0.",
        "number.min":
          "Le champ {#label} ne peut pas être inférieur à {#limit}.",
        "object.min": "Vous devez fournir au moins un champ à modifier.",
        "string.base": "Le champ {#label} doit être du texte.",
        "string.empty": "Le champ {#label} ne peut pas être vide.",
        "string.min":
          "Le champ {#label} doit contenir au moins {#limit} caractères.",
        "string.max":
          "Le champ {#label} ne peut pas dépasser {#limit} caractères.",
        "string.pattern.base":
          "Le champ {#label} ne doit pas contenir de chiffres.",
        "string.email": "Le champ {#label} doit être une adresse email valide.",
      },
    });

    if (error) {
      res.status(400).json({
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    req.body = value;
    next();
  };
};
// LES MIDDLEWARES PRÊTS À L'EMPLOI

const validateAddEventCart = validateBody(addEventSchema);
const validateUpdateCart = validateBody(updateCartSchema);

// Validation pour les params d'URL (delete)
const validateDeleteItem: RequestHandler = (req, res, next) => {
  const { error } = deleteItemSchema.validate(req.params);

  if (error) {
    res
      .status(400)
      .json({ error: "L'identifiant de l'événement est invalide." });
    return;
  }
  next();
};

export default { validateAddEventCart, validateUpdateCart, validateDeleteItem };
