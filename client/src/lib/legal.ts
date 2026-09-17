/**
 * Informations légales du site.
 *
 * Une seule source, pour ne jamais avoir deux versions des mêmes informations
 * entre les pages et les pieds de page.
 *
 * Ce que le site est, et que les mentions doivent dire sans détour : Le Local
 * est un PROJET DE DÉMONSTRATION. Le tiers-lieu, ses espaces, ses événements et
 * ses réservations sont fictifs, et aucun paiement réel n'est encaissé. Le pied
 * de page annonçait « Association loi 1901 » — une personne morale qui n'existe
 * pas, affirmée sur un site public. C'est le genre de mention qui doit être
 * vraie ou disparaître.
 *
 * `siren` reste nul tant que la micro-entreprise n'est pas immatriculée : la
 * page bascule d'elle-même sur la forme « personne physique », qui est la
 * bonne pour un site non professionnel et sans recette.
 */

export const LEGAL = {
  siteName: "Le Local",
  /** Éditeur : la personne qui publie le site, pas le lieu qu'il met en scène. */
  editeur: "Lucas Guilhot",
  siren: null as string | null,
  departement: "Haute-Garonne (31), France",
  contact: "lucasguilhot7@gmail.com",
  /** Le directeur de la publication est l'éditeur lui-même. */
  directeurPublication: "Lucas Guilhot",
  hebergeur: {
    nom: "OVH SAS",
    forme: "société par actions simplifiée au capital de 10 174 560 €",
    rcs: "RCS Lille Métropole 424 761 419 00045",
    adresse: "2 rue Kellermann, 59100 Roubaix, France",
    telephone: "1007",
    precision:
      "Le site est hébergé sur un serveur privé virtuel loué à OVH, situé en France.",
  },
  derniereMiseAJour: "17 septembre 2026",
} as const;

/** Les points que les conditions doivent énoncer noir sur blanc. */
export const CONDITIONS: { titre: string; corps: string[] }[] = [
  {
    titre: "1. Un projet de démonstration",
    corps: [
      "Le Local est une application de démonstration, publiée pour montrer un travail de développement. Le tiers-lieu qu'elle met en scène n'existe pas : les espaces, les ateliers, les événements, les tarifs et les disponibilités sont fictifs.",
      "Aucune prestation n'est vendue et aucun service n'est rendu. Réserver un espace sur ce site ne vous donne accès à aucun lieu réel.",
    ],
  },
  {
    titre: "2. Aucun paiement réel",
    corps: [
      "Aucune somme n'est encaissée. Le parcours de paiement existe pour démontrer l'intégration technique ; il n'aboutit à aucun débit.",
      "N'entrez jamais de véritables coordonnées bancaires sur ce site. Si une page vous en réclame et paraît les accepter, quittez-la : elle n'est pas conforme à ce qui est décrit ici.",
    ],
  },
  {
    titre: "3. Le compte et les données",
    corps: [
      "Créer un compte demande un nom, un prénom, une adresse e-mail et un numéro de téléphone. Le mot de passe n'est jamais conservé en clair : seule une empreinte calculée avec argon2id est enregistrée.",
      "Le site dépose un seul cookie, celui de la session. Il ne pratique aucun suivi publicitaire et ne transmet aucune donnée à un tiers à des fins commerciales.",
      "N'y déposez pas de données que vous ne voudriez pas voir dans un projet de démonstration.",
    ],
  },
  {
    titre: "4. Vos droits sur vos données",
    corps: [
      "Vous pouvez demander à consulter les données de votre compte, les faire corriger, ou les faire supprimer. La suppression est définitive et sans condition.",
      `Il suffit d'écrire à ${LEGAL.contact}.`,
    ],
  },
  {
    titre: "5. Disponibilité",
    corps: [
      "Le site est mis à disposition tel quel, sans engagement de disponibilité ni de conservation des données. Il peut être interrompu ou réinitialisé à tout moment.",
    ],
  },
];

/** La forme juridique, qui dépend de l'immatriculation. */
export function statutEditeur(): string {
  return LEGAL.siren
    ? `Entrepreneur individuel — SIREN ${LEGAL.siren}`
    : "Personne physique — site non professionnel, sans activité commerciale";
}
