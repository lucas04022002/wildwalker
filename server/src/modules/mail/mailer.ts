/**
 * Envoi d'e-mail.
 *
 * Le projet n'avait aucune capacité d'envoi, et la réinitialisation de mot de
 * passe en exige une. Plutôt qu'une dépendance de plus, l'API HTTP de Resend
 * est appelée avec `fetch` : une fonction, aucun paquet, aucune surface
 * supplémentaire.
 *
 * Rien n'est journalisé du contenu : un lien de réinitialisation dans les
 * journaux est un compte à prendre.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Au-delà, on abandonne : l'appelant ne doit pas attendre indéfiniment. */
const TIMEOUT_MS = 10_000;

type Message = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * La messagerie est-elle configurée ?
 *
 * Tant qu'elle ne l'est pas, la route de réinitialisation refuse franchement
 * plutôt que d'accepter une demande qui ne partira jamais. Un formulaire qui
 * répond « c'est envoyé » sans rien envoyer est pire que pas de formulaire.
 */
const estConfiguree = (env: NodeJS.ProcessEnv = process.env): boolean =>
  Boolean(env.RESEND_API_KEY?.trim() && env.MAIL_FROM?.trim());

class MailError extends Error {}

const envoyer = async (message: Message): Promise<void> => {
  const cle = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (!cle || !from) {
    throw new MailError("Messagerie non configurée.");
  }

  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), TIMEOUT_MS);

  try {
    const reponse = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: controle.signal,
    });

    if (!reponse.ok) {
      // Le corps de la réponse peut contenir l'adresse : on n'en garde que le
      // code, qui suffit à diagnostiquer sans rien exposer.
      throw new MailError(`Envoi refusé (HTTP ${reponse.status}).`);
    }
  } catch (err) {
    if (err instanceof MailError) throw err;
    throw new MailError("Envoi impossible.");
  } finally {
    clearTimeout(minuteur);
  }
};

export default { envoyer, estConfiguree };
export { MailError, envoyer, estConfiguree };
export type { Message };
