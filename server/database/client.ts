// Get variables from .env file for database connection
const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

// Create a connection pool to the database
import mysql from "mysql2/promise";

const client = mysql.createPool({
  host: DB_HOST,
  port: Number.parseInt(DB_PORT as string),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  /**
   * mysql2 n'accepte pas un nom de fuseau : il refusait « Europe/Paris » et
   * retombait silencieusement sur le fuseau du conteneur, donc sur une valeur
   * qui dépend de l'hébergeur. Les DATETIME stockés sont des heures murales du
   * lieu (« l'atelier commence à 14 h ») et ne doivent subir aucun décalage :
   * « Z » les rend tels qu'ils sont écrits. Un décalage fixe comme « +02:00 »
   * serait faux six mois par an, au changement d'heure.
   */
  timezone: "Z",
});

// Ready to export
export default client;

// Types export
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type DatabaseClient = Pool;
type Result = ResultSetHeader;
type Rows = RowDataPacket[];

export type { DatabaseClient, Result, Rows };
