import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import argon2 from "argon2";
import type { Pool } from "mysql2/promise";

import { runMigrations } from "../bin/migrate";
import { runSeed } from "../bin/seed";

/* ************************************************************************* */
/* Faux pool mysql2 : on n'a pas de MySQL en local, on observe les requêtes.  */
/* ************************************************************************* */

type FakePool = {
  pool: Pool;
  connection: {
    query: jest.Mock;
    beginTransaction: jest.Mock;
    commit: jest.Mock;
    rollback: jest.Mock;
    release: jest.Mock;
  };
  poolQueries: string[];
  connectionQueries: string[];
  allQueries: () => string[];
};

const makeFakePool = (
  alreadyApplied: string[] = [],
  failOn?: RegExp,
): FakePool => {
  const poolQueries: string[] = [];
  const connectionQueries: string[] = [];

  const connection = {
    query: jest.fn(async (sql: string) => {
      connectionQueries.push(sql);
      if (failOn?.test(sql)) {
        throw new Error("erreur SQL simulée");
      }
      return [[], []];
    }),
    beginTransaction: jest.fn(async () => undefined),
    commit: jest.fn(async () => undefined),
    rollback: jest.fn(async () => undefined),
    release: jest.fn(() => undefined),
  };

  const pool = {
    query: jest.fn(async (sql: string) => {
      poolQueries.push(sql);
      if (/from\s+`?schema_migrations`?/i.test(sql)) {
        return [alreadyApplied.map((name) => ({ name })), []];
      }
      return [[], []];
    }),
    getConnection: jest.fn(async () => connection),
  };

  return {
    pool: pool as unknown as Pool,
    connection,
    poolQueries,
    connectionQueries,
    allQueries: () => [...poolQueries, ...connectionQueries],
  };
};

const makeTempMigrations = (files: Record<string, string>): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ww-migrations-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, "utf8");
  }
  return dir;
};

const TWO_FILES = {
  "0002_x.sql": "CREATE TABLE IF NOT EXISTS x (id INT);",
  "0001_init.sql": "CREATE TABLE IF NOT EXISTS init (id INT);",
  "notes.txt": "ceci n'est pas une migration",
};

describe("runMigrations", () => {
  test("crée la table schema_migrations si elle est absente", async () => {
    const dir = makeTempMigrations(TWO_FILES);
    const fake = makeFakePool();

    await runMigrations(fake.pool, dir);

    expect(fake.poolQueries[0]).toMatch(
      /create\s+table\s+if\s+not\s+exists\s+`?schema_migrations`?/i,
    );
    expect(fake.poolQueries[0]).toMatch(/name/i);
    expect(fake.poolQueries[0]).toMatch(/applied_at/i);
  });

  test("applique les fichiers .sql dans l'ordre lexical et les retourne", async () => {
    const dir = makeTempMigrations(TWO_FILES);
    const fake = makeFakePool();

    const applied = await runMigrations(fake.pool, dir);

    expect(applied).toEqual(["0001_init.sql", "0002_x.sql"]);

    const bodies = fake.connectionQueries.filter((sql) =>
      /create\s+table/i.test(sql),
    );
    expect(bodies[0]).toContain("init");
    expect(bodies[1]).toContain("x (id INT)");
  });

  test("note chaque fichier dans schema_migrations après application", async () => {
    const dir = makeTempMigrations(TWO_FILES);
    const fake = makeFakePool();

    await runMigrations(fake.pool, dir);

    const inserts = fake.connectionQueries.filter((sql) =>
      /insert\s+into\s+`?schema_migrations`?/i.test(sql),
    );
    expect(inserts).toHaveLength(2);
    expect(fake.connection.commit).toHaveBeenCalledTimes(2);
    expect(fake.connection.release).toHaveBeenCalledTimes(2);
  });

  test("n'applique pas un fichier déjà noté", async () => {
    const dir = makeTempMigrations(TWO_FILES);
    const fake = makeFakePool(["0001_init.sql"]);

    const applied = await runMigrations(fake.pool, dir);

    expect(applied).toEqual(["0002_x.sql"]);
    expect(fake.allQueries().join("\n")).not.toContain("init (id INT)");
  });

  test("ne ré-applique rien quand tout est déjà noté", async () => {
    const dir = makeTempMigrations(TWO_FILES);
    const fake = makeFakePool(["0001_init.sql", "0002_x.sql"]);

    const applied = await runMigrations(fake.pool, dir);

    expect(applied).toEqual([]);
    expect(fake.pool.getConnection).not.toHaveBeenCalled();
  });

  test("n'émet JAMAIS de DROP DATABASE ni de DROP TABLE", async () => {
    const dir = makeTempMigrations(TWO_FILES);
    const fake = makeFakePool();

    await runMigrations(fake.pool, dir);

    for (const sql of fake.allQueries()) {
      expect(sql).not.toMatch(/drop\s+database/i);
      expect(sql).not.toMatch(/drop\s+table/i);
      expect(sql).not.toMatch(/truncate/i);
    }
  });

  test("refuse un fichier de migration qui contient DROP DATABASE", async () => {
    const dir = makeTempMigrations({
      "0001_bad.sql": "DROP DATABASE wildwalker;",
    });
    const fake = makeFakePool();

    await expect(runMigrations(fake.pool, dir)).rejects.toThrow(
      /DROP DATABASE/i,
    );
    expect(fake.allQueries().join("\n")).not.toMatch(/drop\s+database/i);
  });

  test("annule et ne note rien quand un fichier échoue", async () => {
    const dir = makeTempMigrations({
      "0001_init.sql": "CREATE TABLE IF NOT EXISTS init (id INT);",
    });
    const fake = makeFakePool([], /create\s+table\s+if\s+not\s+exists\s+init/i);

    await expect(runMigrations(fake.pool, dir)).rejects.toThrow(
      /0001_init\.sql/,
    );
    expect(fake.connection.rollback).toHaveBeenCalledTimes(1);
    expect(fake.connection.commit).not.toHaveBeenCalled();
    expect(fake.connection.release).toHaveBeenCalledTimes(1);
    expect(
      fake.connectionQueries.filter((sql) =>
        /insert\s+into\s+`?schema_migrations`?/i.test(sql),
      ),
    ).toHaveLength(0);
  });

  test("applique les vraies migrations du dépôt sans rien détruire", async () => {
    const dir = path.join(__dirname, "..", "database", "migrations");
    const fake = makeFakePool();

    const applied = await runMigrations(fake.pool, dir);

    expect(applied).toEqual([
      "0001_init.sql",
      "0002_invoice_counter.sql",
      "0003_revoked_session.sql",
    ]);
    for (const sql of fake.allQueries()) {
      expect(sql).not.toMatch(/drop\s+database/i);
      expect(sql).not.toMatch(/drop\s+table/i);
    }
  });
});

describe("runSeed", () => {
  const seedFile = path.join(__dirname, "..", "database", "seed.sql");
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  test("refuse de tourner en production sans ALLOW_SEED", async () => {
    process.env.NODE_ENV = "production";
    const { ALLOW_SEED: _unset, ...withoutAllowSeed } = process.env;
    process.env = withoutAllowSeed;
    const fake = makeFakePool();

    await expect(runSeed(fake.pool, seedFile)).rejects.toThrow(/ALLOW_SEED/);
    expect(fake.allQueries()).toHaveLength(0);
  });

  test("accepte en production avec ALLOW_SEED=1", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_SEED = "1";
    const fake = makeFakePool();

    await runSeed(fake.pool, seedFile);

    expect(fake.connection.commit).toHaveBeenCalledTimes(1);
  });

  test("tourne hors production et n'émet aucune destruction", async () => {
    process.env.NODE_ENV = "development";
    const fake = makeFakePool();

    await runSeed(fake.pool, seedFile);

    expect(fake.connection.commit).toHaveBeenCalledTimes(1);
    for (const sql of fake.allQueries()) {
      expect(sql).not.toMatch(/drop\s+database/i);
      expect(sql).not.toMatch(/drop\s+table/i);
      expect(sql).not.toMatch(/truncate/i);
    }
  });
});

/* ************************************************************************* */
/* Les mots de passe de démo documentés dans le README doivent vraiment       */
/* correspondre aux hashes committés dans seed.sql.                           */
/* ************************************************************************* */

describe("mots de passe de démo de seed.sql", () => {
  const seed = fs.readFileSync(
    path.join(__dirname, "..", "database", "seed.sql"),
    "utf8",
  );

  const hashesFor = (role: string): string[] => {
    const rows = seed
      .split("\n")
      .filter(
        (line) => line.includes(`'${role}'`) && line.includes("$argon2id$"),
      );
    return rows
      .map((line) => /'(\$argon2id\$[^']+)'/.exec(line)?.[1])
      .filter((hash): hash is string => hash != null);
  };

  test("un hash de client vérifie demo-client-2026", async () => {
    const [hash] = hashesFor("client");
    expect(hash).toBeDefined();
    await expect(argon2.verify(hash, "demo-client-2026")).resolves.toBe(true);
    await expect(argon2.verify(hash, "demo-admin-2026")).resolves.toBe(false);
  });

  test("un hash d'admin vérifie demo-admin-2026", async () => {
    const [hash] = hashesFor("admin");
    expect(hash).toBeDefined();
    await expect(argon2.verify(hash, "demo-admin-2026")).resolves.toBe(true);
    await expect(argon2.verify(hash, "demo-client-2026")).resolves.toBe(false);
  });
});
