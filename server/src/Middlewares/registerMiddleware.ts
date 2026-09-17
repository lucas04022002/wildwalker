import type { RequestHandler } from "express";
import Joi from "joi";

/**
 * Validation du corps de l'inscription.
 *
 * La route était la seule écriture publique du projet à n'avoir aucun schéma,
 * alors que Joi était déjà en place pour le panier et les événements : elle
 * vérifiait la présence des champs, rien de plus. `"email": "abc"` entrait en
 * base, `"phone_number": "bonjour"` aussi.
 *
 * Deux bornes méritent d'être lues comme des protections, pas comme du confort :
 *
 * - `max` sur le mot de passe. Sans plafond, argon2 hache ce qu'on lui donne,
 *   et `express.json()` accepte jusqu'à 100 ko : un seul champ suffit alors à
 *   occuper un cœur pendant longtemps, sans aucun compte à créer.
 * - `max` sur les autres chaînes, calés sur les colonnes MySQL (varchar(150),
 *   varchar(45)). Au-delà, l'insertion échouait en base, donc en 500.
 */

/** Dix caractères, sans règle de composition — c'est la longueur qui protège. */
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

/** Lettres, espaces, apostrophes et traits d'union : mêmes règles que le panier. */
const NOM_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/;

/** Chiffres et ponctuation de numéro, sans imposer un format national. */
const TELEPHONE_PATTERN = /^[0-9+\s().-]{6,20}$/;

const registerSchema = Joi.object({
  firstname: Joi.string()
    .trim()
    .pattern(NOM_PATTERN)
    .min(2)
    .max(150)
    .required(),
  lastname: Joi.string().trim().pattern(NOM_PATTERN).min(2).max(150).required(),
  // `lowercase` normalise à l'entrée : la collation de la table est déjà
  // insensible à la casse, le stockage l'est désormais aussi.
  email: Joi.string().trim().lowercase().email().max(150).required(),
  password: Joi.string().min(PASSWORD_MIN).max(PASSWORD_MAX).required(),
  phone_number: Joi.string().trim().pattern(TELEPHONE_PATTERN).required(),
  city: Joi.string().trim().max(150).allow("", null),
  adress: Joi.string().trim().max(255).allow("", null),
});

const validateRegister: RequestHandler = (req, res, next) => {
  const { error, value } = registerSchema.validate(req.body, {
    abortEarly: false,
    // `stripUnknown` retire tout champ non listé : `role` envoyé dans le corps
    // n'atteint jamais l'action. Le SQL l'écrit déjà en dur, mais la garde ne
    // doit pas reposer sur une seule ligne.
    stripUnknown: true,
    messages: {
      "any.required": "Le champ {#label} est obligatoire.",
      "string.base": "Le champ {#label} doit être du texte.",
      "string.empty": "Le champ {#label} ne peut pas être vide.",
      "string.min":
        "Le champ {#label} doit contenir au moins {#limit} caractères.",
      "string.max":
        "Le champ {#label} ne peut pas dépasser {#limit} caractères.",
      "string.email": "L'adresse e-mail n'est pas valide.",
      "string.pattern.base":
        "Le champ {#label} contient des caractères refusés.",
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

export default { validateRegister };
export { PASSWORD_MAX, PASSWORD_MIN, registerSchema, validateRegister };
