// Supprime les node_modules des trois emplacements du monorepo.
//
// Le package-lock.json n'est PAS supprimé : il est la seule garantie que la
// CI, l'image Docker et le poste de développement installent le même arbre
// de dépendances.
const fs = require("node:fs/promises");
const path = require("node:path");

for (const nodeModules of [
  path.join(__dirname, "..", "node_modules"),
  path.join(__dirname, "..", "client", "node_modules"),
  path.join(__dirname, "..", "server", "node_modules"),
]) {
  fs.rm(nodeModules, { recursive: true, force: true });
}
