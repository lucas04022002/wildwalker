import { Link } from "react-router";
import { CONDITIONS, LEGAL, statutEditeur } from "../../lib/legal.ts";
import "./Legal.css";

/**
 * Mentions légales et conditions, sur une seule page.
 *
 * Le site n'en avait aucune : le pied de page écrivait « Mentions légales » en
 * texte brut, sans rien derrière, et `/mentions-legales` répondait par l'écran
 * d'erreur du routeur — « Unexpected Application Error », destiné aux
 * développeurs, affiché à un visiteur.
 *
 * Tout tient sur une page plutôt que deux : les conditions d'un site qui ne
 * vend rien se résument à ce qu'il n'est pas, et deux pages auraient répété la
 * même chose.
 */
export default function Legal() {
  return (
    <main className="legal-page">
      <div className="legal-inner">
        <p className="legal-eyebrow">Informations légales</p>
        <h1 className="legal-title">Mentions légales</h1>

        {/* En tête, et non en note de bas de page : c'est l'information la plus
            importante de la page pour quelqu'un qui vient de saisir un numéro
            de carte dans le parcours de réservation. */}
        <p className="legal-avertissement">
          <strong>Le Local est un projet de démonstration.</strong> Le
          tiers-lieu, ses espaces et ses événements sont fictifs, aucune
          réservation ne donne accès à un lieu réel, et aucun paiement
          n&apos;est encaissé.
        </p>

        <section aria-label="Éditeur du site">
          <h2>Éditeur</h2>
          <dl className="legal-liste">
            <dt>Éditeur du site</dt>
            <dd>{LEGAL.editeur}</dd>
            <dt>Statut</dt>
            <dd>{statutEditeur()}</dd>
            <dt>Localisation</dt>
            <dd>{LEGAL.departement}</dd>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>
            </dd>
            <dt>Directeur de la publication</dt>
            <dd>{LEGAL.directeurPublication}</dd>
          </dl>
        </section>

        <section aria-label="Hébergement">
          <h2>Hébergement</h2>
          <p>
            {LEGAL.hebergeur.nom} — {LEGAL.hebergeur.forme}
            <br />
            {LEGAL.hebergeur.rcs}
            <br />
            {LEGAL.hebergeur.adresse}
            <br />
            Téléphone : {LEGAL.hebergeur.telephone}
          </p>
          <p className="legal-note">{LEGAL.hebergeur.precision}</p>
        </section>

        <section aria-label="Conditions d'utilisation">
          <h2>Conditions d&apos;utilisation</h2>
          {CONDITIONS.map((point) => (
            <article key={point.titre} className="legal-point">
              <h3>{point.titre}</h3>
              {point.corps.map((paragraphe) => (
                <p key={paragraphe}>{paragraphe}</p>
              ))}
            </article>
          ))}
        </section>

        <p className="legal-note">
          Dernière mise à jour : {LEGAL.derniereMiseAJour}.
        </p>

        <p className="legal-retour">
          <Link to="/">Revenir à l&apos;accueil</Link>
        </p>
      </div>
    </main>
  );
}
