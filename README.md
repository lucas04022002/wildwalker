# WildWalker

Monorepo React (client) + Express/MySQL (server) : réservation d'espaces de
coworking et d'ateliers, panier, paiement Stripe, tableaux de bord client et
admin.

> README provisoire : la présentation complète (captures, architecture,
> déploiement) arrive à la fin de la refonte (voir `docs/superpowers/specs/`).

## Table des Matières

- [WildWalker](#wildwalker)
  - [Table des Matières](#table-des-matières)
  - [Installation \& Utilisation](#installation--utilisation)
  - [Les choses à retenir](#les-choses-à-retenir)
    - [Commandes de Base](#commandes-de-base)
    - [Structure des Dossiers](#structure-des-dossiers)
    - [Mettre en place la base de données](#mettre-en-place-la-base-de-données)

## Installation & Utilisation

1. Installez le plugin **Biome** dans VSCode et configurez-le.
2. Clonez ce dépôt, puis accédez au répertoire cloné.
3. Exécutez la commande `npm install`.
4. Créez des fichiers d'environnement (`.env`) dans les répertoires `server` et `client` : vous pouvez copier les fichiers `.env.sample` comme modèles (**ne les supprimez pas**).

## Les choses à retenir

### Commandes de Base

| Commande               | Description                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| `npm install`          | Installe les dépendances pour le client et le serveur                       |
| `npm run db:migrate`   | Applique les migrations non encore jouées (ne détruit jamais rien)          |
| `npm run db:seed`      | Charge les données de démonstration (refusé en production sans `ALLOW_SEED=1`) |
| `npm run dev`          | Démarre les deux serveurs (client et serveur) dans un seul terminal         |
| `npm run build`        | Compile le client et le serveur (`server/dist`)                             |
| `npm start`            | Démarre le serveur compilé (`node dist/src/main.js`)                        |
| `npm run check`        | Exécute les outils de validation (linting et formatage)                     |
| `npm run test`         | Exécute les tests unitaires et d'intégration                                |

### Structure des Dossiers

```plaintext
wildwalker/
│
├── server/
│   ├── src/
│   │   ├── modules/
│   │   │   └── ...
│   │   ├── app.ts
│   │   ├── main.ts
│   │   └── router.ts
│   ├── bin/
│   │   ├── migrate.ts
│   │   ├── seed.ts
│   │   └── hash-demo-passwords.ts
│   ├── database/
│   │   ├── client.ts
│   │   ├── migrations/
│   │   │   └── 0001_init.sql
│   │   └── seed.sql
│   ├── tests/
│   ├── .env
│   └── .env.sample
│
└── client/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   └── App.tsx
    ├── .env
    └── .env.sample
```

### Mettre en place la base de données

> Section provisoire : le README complet (présentation, captures, architecture,
> déploiement) arrive à la fin de la refonte.

**1. Créer et remplir `server/.env`** à partir de `server/.env.sample` :

```plaintext
APP_PORT=3310
DB_HOST=localhost
DB_PORT=3306
DB_USER=not_root
DB_PASSWORD=password
DB_NAME=wildwalker
ALLOW_SEED=
JWT_SECRET=une_longue_chaine_aleatoire
CLIENT_URL=http://localhost:3000
```

La base (`CREATE DATABASE wildwalker;`) doit exister : les migrations ne la
créent pas, et surtout ne la suppriment jamais.

**2. Appliquer les migrations** :

```sh
npm run db:migrate
```

Le runner (`server/bin/migrate.ts`) joue les fichiers de
`server/database/migrations/` dans l'ordre lexical, une seule fois chacun, et
note chaque fichier appliqué dans la table `schema_migrations`. Il est sûr à
relancer : rien n'est supprimé, rien n'est rejoué. Un fichier qui contiendrait
`DROP DATABASE`, `DROP TABLE` ou `TRUNCATE` est refusé.

Pour faire évoluer le schéma, on **ajoute** un fichier
(`0002_ma_modification.sql`), on ne modifie jamais un fichier déjà appliqué.

**3. Charger les données de démonstration** (optionnel, sur une base
fraîchement migrée) :

```sh
npm run db:seed
```

`server/database/seed.sql` remplit les espaces, créneaux, comptes, activités,
réservations et réclamations. En `NODE_ENV=production`, le seed refuse de
tourner tant que `ALLOW_SEED=1` n'est pas positionné.

#### Comptes de démonstration

Mots de passe volontairement publics (dépôt de démonstration) :

| Rôle     | Exemple d'identifiant       | Mot de passe       |
|----------|-----------------------------|--------------------|
| Admin    | `nina.richard@lelocal.fr`   | `demo-admin-2026`  |
| Client   | `lucie.marie655@voila.fr`   | `demo-client-2026` |

Les 2 comptes `admin` et les 25 comptes `client` du seed partagent ces deux
mots de passe. Pour les changer : modifier `server/bin/hash-demo-passwords.ts`,
lancer `npx tsx bin/hash-demo-passwords.ts` depuis `server/`, puis commiter le
`seed.sql` obtenu.

#### Construire et lancer le serveur compilé

```sh
npm run build --workspace=server   # tsc -> server/dist (+ copie des .sql)
npm start                          # node dist/src/main.js
```

Sans configuration ou sans MySQL joignable, le serveur s'arrête avec un message
explicite et un code de sortie 1.

