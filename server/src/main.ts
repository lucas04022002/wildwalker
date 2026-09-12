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

const REQUIRED_ENV = ["APP_PORT", "DB_HOST", "DB_PORT", "DB_USER", "DB_NAME"];

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
