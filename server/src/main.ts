// Charge les variables d'environnement depuis .env
import "dotenv/config";

/**
 * Point d'entrée du serveur.
 *
 * Le démarrage échoue tôt et proprement (message unique, code de sortie 1)
 * plutôt qu'avec une trace : configuration incomplète, ou base de données
 * injoignable. Les modules qui ouvrent le pool MySQL sont donc importés
 * dynamiquement, après la validation de l'environnement.
 */

// `CLIENT_URL` et `JWT_SECRET` sont exigées : sans la première, CORS et la
// garde d'origine n'ont aucune origine de référence ; sans la seconde, aucune
// session ne peut être signée. Mieux vaut refuser de démarrer que tourner
// avec une sécurité inopérante.
const REQUIRED_ENV = [
  "APP_PORT",
  "CLIENT_URL",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_NAME",
  "JWT_SECRET",
];

const fail = (message: string): never => {
  console.error(`Démarrage impossible : ${message}`);
  process.exit(1);
};

const start = async (): Promise<void> => {
  const missing = REQUIRED_ENV.filter(
    (name) => (process.env[name] ?? "") === "",
  );

  if (missing.length > 0) {
    fail(
      `variable(s) d'environnement manquante(s) : ${missing.join(", ")}. Copiez server/.env.sample vers server/.env et remplissez-les.`,
    );
  }

  let database: typeof import("../database/client")["default"];

  try {
    database = (await import("../database/client")).default;
  } catch (err) {
    return fail(
      `configuration de la base invalide (${(err as Error).message}). Vérifiez DB_HOST, DB_PORT, DB_USER, DB_PASSWORD et DB_NAME.`,
    );
  }

  try {
    const connection = await database.getConnection();
    connection.release();
  } catch (err) {
    return fail(
      `base de données « ${process.env.DB_NAME} » injoignable sur ${process.env.DB_HOST}:${process.env.DB_PORT} (${(err as Error).message}). Démarrez MySQL puis lancez « npm run db:migrate ».`,
    );
  }

  // Un cookie de session sans `Secure` en production voyage en clair au
  // premier appel HTTP : il suffit d'un réseau partagé pour le récupérer.
  // `COOKIE_SECURE=0` est légitime en smoke test, jamais en production —
  // le démarrage le dit haut et fort plutôt que de le laisser passer.
  const { isCookieSecure } = await import("./modules/Authentification/Jwt");

  if (process.env.NODE_ENV === "production" && !isCookieSecure(process.env)) {
    console.warn(
      "ATTENTION : NODE_ENV=production mais le cookie de session n'est PAS Secure (COOKIE_SECURE désarmé). La session voyage en clair sur HTTP. Retirez COOKIE_SECURE ou mettez-la à 1.",
    );
  }

  const { default: app } = await import("./app");

  app
    .listen(process.env.APP_PORT, () => {
      console.info(`Serveur à l'écoute sur le port ${process.env.APP_PORT}`);
    })
    .on("error", (err: Error) => {
      fail(err.message);
    });
};

start().catch((err: Error) => fail(err.message));
