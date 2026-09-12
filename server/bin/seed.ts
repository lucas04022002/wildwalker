// Charge les variables d'environnement depuis .env
import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import type { Pool, PoolConnection } from "mysql2/promise";

import { assertNotDestructive, createMigrationPool } from "./migrate";

/**
 * Chargement des données de démonstration.
 *
 * Le seed est du DML pur (des `INSERT`) : la transaction est ici réelle,
 * un échec n'insère rien. Il s'exécute sur une base fraîchement migrée ;
 * relancé sur une base déjà remplie il échoue sur les clés uniques, ce qui
 * est voulu (on ne veut ni doublon ni suppression silencieuse).
 */

const SEED_FILE = path.join(__dirname, "..", "database", "seed.sql");

const assertSeedAllowed = (): void => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    throw new Error(
      "Seed refusé en production. Relancez avec ALLOW_SEED=1 si vous voulez vraiment injecter les données de démonstration.",
    );
  }
};

/** Charge le fichier de seed dans une transaction. */
const runSeed = async (pool: Pool, file: string): Promise<void> => {
  assertSeedAllowed();

  const sql = fs.readFileSync(file, "utf8");
  assertNotDestructive(sql, path.basename(file));

  const connection: PoolConnection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(sql);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    const { message } = err as Error;
    throw new Error(`Échec du seed ${path.basename(file)} : ${message}`);
  } finally {
    connection.release();
  }
};

const main = async (): Promise<void> => {
  const pool = createMigrationPool();

  try {
    await runSeed(pool, SEED_FILE);
    console.info(`Données de démonstration chargées depuis ${SEED_FILE}`);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  main().catch((err: Error) => {
    console.error(`Seed impossible : ${err.message}`);
    process.exitCode = 1;
  });
}

export { runSeed, assertSeedAllowed, SEED_FILE };
