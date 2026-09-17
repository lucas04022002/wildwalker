import argon2 from "argon2";
import type { RequestHandler } from "express";
import mailer from "../mail/mailer";
import authRepository from "./AuthentificationRepository";
import resetRepository from "./PasswordResetRepository";

/**
 * Réponse unique de la demande de réinitialisation.
 *
 * Identique que l'adresse soit connue ou non, comme à l'inscription : un
 * formulaire public qui répond « ce compte n'existe pas » est un outil
 * d'énumération.
 */
const DEMANDE_ACCEPTEE =
  "Si un compte existe pour cette adresse, un lien vient de partir.";

/** Où pointe le lien. Le client sert cette route et lit le jeton dans l'URL. */
const lienDeReinitialisation = (jeton: string): string => {
  const base = (process.env.CLIENT_URL ?? "").replace(/\/+$/, "");
  return `${base}/reinitialiser-mot-de-passe?jeton=${jeton}`;
};

const corpsDuMessage = (lien: string) => ({
  subject: "Réinitialiser votre mot de passe — Le Local",
  text: [
    "Vous avez demandé à changer votre mot de passe.",
    "",
    `Ouvrez ce lien pour en choisir un nouveau : ${lien}`,
    "",
    "Le lien est valable trente minutes et ne sert qu'une fois.",
    "Si vous n'avez rien demandé, ignorez ce message : votre mot de passe",
    "reste inchangé.",
    "",
    "Le Local",
  ].join("\n"),
  html: [
    "<p>Vous avez demandé à changer votre mot de passe.</p>",
    `<p><a href="${lien}">Choisir un nouveau mot de passe</a></p>`,
    "<p>Le lien est valable trente minutes et ne sert qu'une fois.</p>",
    "<p>Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.</p>",
    "<p>Le Local</p>",
  ].join(""),
});

/**
 * Étape 1 : la personne donne son adresse.
 *
 * Le travail est le même que l'adresse soit connue ou non — c'est voulu. Seul
 * l'envoi diffère, et il n'est pas observable depuis la réponse.
 */
const demander: RequestHandler = async (req, res, next) => {
  try {
    // Refus franc plutôt qu'une promesse creuse : sans messagerie configurée,
    // aucun lien ne partira, et le dire est plus honnête que de faire semblant.
    if (!mailer.estConfiguree()) {
      res.status(503).json({
        message:
          "La réinitialisation par e-mail n'est pas disponible pour le moment.",
      });
      return;
    }

    const { email } = req.body as { email: string };
    const utilisateur = await authRepository.findByEmail(email);

    if (utilisateur) {
      const jeton = await resetRepository.ouvrir(utilisateur.id);
      const message = corpsDuMessage(lienDeReinitialisation(jeton));

      try {
        await mailer.envoyer({ to: utilisateur.email, ...message });
      } catch {
        // L'envoi a échoué. On ne le dit pas : la réponse doit rester la même
        // pour une adresse connue et une adresse inconnue. Le journal ne porte
        // ni l'adresse, ni le jeton.
        console.error("Réinitialisation : envoi du message impossible.");
      }
    }

    res.status(202).json({ message: DEMANDE_ACCEPTEE });
  } catch (err) {
    next(err);
  }
};

/**
 * Étape 2 : la personne revient avec le jeton et choisit un mot de passe.
 *
 * L'ordre des opérations est la partie qui compte. Le jeton est consommé
 * AVANT le changement : deux clics simultanés ne peuvent pas aboutir tous les
 * deux, c'est la base qui tranche (`used_at IS NULL` dans le WHERE).
 */
const reinitialiser: RequestHandler = async (req, res, next) => {
  try {
    const { jeton, password } = req.body as { jeton: string; password: string };

    const demande = await resetRepository.lire(jeton);

    if (!demande) {
      res.status(400).json({
        message: "Ce lien n'est plus valable. Demandez-en un nouveau.",
      });
      return;
    }

    const consomme = await resetRepository.consommer(jeton);

    if (!consomme) {
      // Quelqu'un — ou un second onglet — est passé entre les deux.
      res.status(400).json({
        message: "Ce lien n'est plus valable. Demandez-en un nouveau.",
      });
      return;
    }

    const passwordHash = await argon2.hash(password);

    // `password_changed_at` ferme toutes les sessions ouvertes avec l'ancien
    // mot de passe. Sans elle, une réinitialisation ne servirait à rien dans le
    // seul cas qui compte : celui où quelqu'un d'autre est déjà connecté.
    await authRepository.updatePassword(demande.users_id, passwordHash);

    res.status(200).json({
      message: "Mot de passe changé. Vous pouvez vous connecter.",
    });
  } catch (err) {
    next(err);
  }
};

export default { demander, reinitialiser };
export { DEMANDE_ACCEPTEE, demander, lienDeReinitialisation, reinitialiser };
