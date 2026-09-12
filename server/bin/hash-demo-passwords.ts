import fs from "node:fs";
import path from "node:path";

import argon2 from "argon2";

/**
 * Régénère les hashes de mots de passe des comptes de démonstration
 * directement dans `database/seed.sql`.
 *
 * Les mots de passe sont volontairement publics : ce dépôt est une démo de
 * portfolio, et le README les documente. Chaque compte reçoit son propre sel,
 * donc deux comptes ayant le même mot de passe n'ont pas le même hash.
 *
 * Usage : `npx tsx bin/hash-demo-passwords.ts` (à relancer si l'on change les
 * mots de passe ci-dessous), puis commiter le `seed.sql` obtenu.
 */

const CLIENT_PASSWORD = "demo-client-2026";
const ADMIN_PASSWORD = "demo-admin-2026";

const SEED_FILE = path.join(__dirname, "..", "database", "seed.sql");

// Un hash argon2 encodé, entre apostrophes, tel qu'il apparaît dans le seed.
const HASH_IN_SQL = /'\$argon2id\$[^']*'/;

const main = async (): Promise<void> => {
  const lines = fs.readFileSync(SEED_FILE, "utf8").split("\n");
  const rewritten: string[] = [];

  let clients = 0;
  let admins = 0;

  for (const line of lines) {
    if (!HASH_IN_SQL.test(line)) {
      rewritten.push(line);
      continue;
    }

    const isAdmin = line.includes("'admin'");
    const hash = await argon2.hash(isAdmin ? ADMIN_PASSWORD : CLIENT_PASSWORD, {
      type: argon2.argon2id,
    });

    if (isAdmin) {
      admins += 1;
    } else {
      clients += 1;
    }

    // Remplacement par fonction : le hash contient des `$`, qui seraient
    // sinon interprétés comme des références de capture par String.replace.
    rewritten.push(line.replace(HASH_IN_SQL, () => `'${hash}'`));
  }

  fs.writeFileSync(SEED_FILE, rewritten.join("\n"), "utf8");

  console.info(
    `Hashes régénérés dans ${SEED_FILE} : ${admins} admin(s) (${ADMIN_PASSWORD}), ${clients} client(s) (${CLIENT_PASSWORD}).`,
  );
};

main().catch((err: Error) => {
  console.error(`Régénération impossible : ${err.message}`);
  process.exitCode = 1;
});
