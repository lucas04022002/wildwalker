// Charge les variables d'environnement depuis .env
import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import mysql from "mysql2/promise";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

/**
 * Runner de migrations.
 *
 * Règle d'or : on ne détruit JAMAIS rien. Pas de `DROP DATABASE`, pas de
 * `DROP TABLE`, pas de `TRUNCATE`. Chaque fichier `.sql` du dossier est joué
 * une seule fois, dans l'ordre lexical, puis noté dans `schema_migrations`.
 */

const MIGRATIONS_DIR = path.join(__dirname, "..", "database", "migrations");

const CREATE_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;

// Garde-fou : un fichier qui contient une de ces formes n'est jamais exécuté.
const FORBIDDEN = [
  { pattern: /\bdrop\s+database\b/i, label: "DROP DATABASE" },
  { pattern: /\bdrop\s+schema\b/i, label: "DROP SCHEMA" },
  { pattern: /\bdrop\s+table\b/i, label: "DROP TABLE" },
  { pattern: /\btruncate\b/i, label: "TRUNCATE" },
];

const assertNotDestructive = (sql: string, label: string): void => {
  for (const { pattern, label: forbidden } of FORBIDDEN) {
    if (pattern.test(sql)) {
      throw new Error(
        `Migration refusée : ${label} contient ${forbidden}. Les migrations ne détruisent jamais de données.`,
      );
    }
  }
};

/**
 * Joue un fichier SQL dans une transaction, puis note son nom.
 *
 * Limite MySQL assumée : le DDL (`CREATE TABLE`, `ALTER TABLE`…) provoque un
 * commit implicite. Le `ROLLBACK` ne défait donc pas un fichier de schéma
 * à moitié appliqué ; il protège seulement le DML (le seed). C'est pourquoi
 * le nom n'est inscrit dans `schema_migrations` qu'après succès complet :
 * une migration interrompue est rejouée au prochain lancement, et les
 * `CREATE TABLE IF NOT EXISTS` la rendent sûre à rejouer.
 */
const applyFileInTransaction = async (
  pool: Pool,
  sql: string,
  name: string,
  record: boolean,
): Promise<void> => {
  const connection: PoolConnection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(sql);

    if (record) {
      await connection.query(
        "INSERT INTO schema_migrations (name, applied_at) VALUES (?, NOW())",
        [name],
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    const { message } = err as Error;
    throw new Error(`Échec de la migration ${name} : ${message}`);
  } finally {
    connection.release();
  }
};

/**
 * Applique les migrations non encore jouées du dossier `dir`.
 * Retourne les noms des fichiers appliqués pendant cet appel.
 */
const runMigrations = async (pool: Pool, dir: string): Promise<string[]> => {
  await pool.query(CREATE_MIGRATIONS_TABLE);

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT name FROM schema_migrations",
  );
  const already = new Set(rows.map((row) => String(row.name)));

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".sql"))
    .sort();

  const applied: string[] = [];

  for (const file of files) {
    if (already.has(file)) continue;

    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    assertNotDestructive(sql, file);

    await applyFileInTransaction(pool, sql, file, true);
    applied.push(file);
  }

  return applied;
};

/** Pool dédié au CLI : `multipleStatements` pour jouer un fichier d'un bloc. */
const createMigrationPool = (): Pool =>
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT ?? "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    connectionLimit: 1,
  });

const main = async (): Promise<void> => {
  const pool = createMigrationPool();

  try {
    const applied = await runMigrations(pool, MIGRATIONS_DIR);

    if (applied.length === 0) {
      console.info("Base à jour, aucune migration à appliquer.");
    } else {
      console.info(`Migrations appliquées : ${applied.join(", ")}`);
    }
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  main().catch((err: Error) => {
    console.error(`Migration impossible : ${err.message}`);
    process.exitCode = 1;
  });
}

export {
  runMigrations,
  createMigrationPool,
  assertNotDestructive,
  MIGRATIONS_DIR,
};
