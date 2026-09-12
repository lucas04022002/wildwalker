// Copie les fichiers SQL dans dist/ après la compilation TypeScript.
//
// tsc ne copie que le code : sans cette étape, dist/bin/migrate.js chercherait
// dist/database/migrations et ne trouverait rien. La règle de résolution reste
// donc la même en développement (tsx, server/bin -> server/database) et en
// production (server/dist/bin -> server/dist/database).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const copies = [
  ["database/migrations", "dist/database/migrations"],
  ["database/seed.sql", "dist/database/seed.sql"],
];

for (const [from, to] of copies) {
  fs.cpSync(path.join(root, from), path.join(root, to), { recursive: true });
}

console.info("Fichiers SQL copiés dans dist/database.");
