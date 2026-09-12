# Js-Team-vert-WildWlaker-P3-G1

Ce projet est un monorepo JS, suivant l'architecture React-Express-MySQL telle qu'enseignée à la Wild Code School (v7.2.4) :

```mermaid
sequenceDiagram
    box Web Client
    participant React as React
    participant Fetcher as Fetcher
    end
    box Web Server
    participant Express as Express
    participant Module as Module
    end
    box DB Server
    participant DB as MySQL Server
    end

    React-)Fetcher: event
    activate Fetcher
    Fetcher-)Express: requête (HTTP)
    activate Express
    Express-)Module: appel
    activate Module
    Module-)DB: requête SQL
    activate DB
    DB--)Module: données
    deactivate DB
    Module--)Express: json
    deactivate Module
    Express--)Fetcher: réponse HTTP
    deactivate Express
    Fetcher--)React: render
    deactivate Fetcher
```

Il est pré-configuré avec un ensemble d'outils pour aider les étudiants à produire du code de qualité industrielle, tout en restant un outil pédagogique :

- **Concurrently** : Permet d'exécuter plusieurs commandes simultanément dans le même terminal.
- **Vite** : Alternative à _Create-React-App_, offrant une expérience plus fluide avec moins d'outils.
- **Biome** : Alternative à _ESlint_ et _Prettier_, assurant la qualité du code selon des règles choisies.
- **Supertest** : Bibliothèque pour tester les serveurs HTTP en node.js.

## Table des Matières

- [Js-Team-vert-WildWlaker-P3-G1](#name)
  - [Table des Matières](#table-des-matières)
  - [Installation \& Utilisation](#installation--utilisation)
  - [Les choses à retenir](#les-choses-à-retenir)
    - [Commandes de Base](#commandes-de-base)
    - [Structure des Dossiers](#structure-des-dossiers)
    - [Mettre en place la base de données](#mettre-en-place-la-base-de-données)
    - [Développer la partie back-end](#développer-la-partie-back-end)
    - [REST](#rest)
    - [Autres Bonnes Pratiques](#autres-bonnes-pratiques)
  - [FAQ](#faq)
    - [Installation avec Docker](#installation-avec-docker)
      - [Mode développement](#mode-développement)
      - [Installation de nouvelles dépendances](#installation-de-nouvelles-dépendances)
      - [Accéder à la base de données](#accéder-à-la-base-de-données)
    - [Déploiement avec Traefik](#déploiement-avec-traefik)
    - [Variables d'environnement spécifiques](#variables-denvironnement-spécifiques)
    - [Logs](#logs)
    - [Contribution](#contribution)

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
my-project/
│
├── server/
│   ├── app/
│   │   ├── modules/
│   │   │   ├── item/
│   │   │   │   ├── itemActions.ts
│   │   │   │   └── itemRepository.ts
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

### Développer la partie back-end

**Créer une route** dans `server/app/router.ts` :

```typescript
// ...

/* ************************************************************************* */
// Define Your API Routes Here
/* ************************************************************************* */

// Define item-related routes
import itemActions from "./modules/item/itemActions";

router.get("/api/items", itemActions.browse);

/* ************************************************************************* */

// ...
```

**Définir une action** dans `server/app/modules/item/itemActions.ts` :

```typescript
import type { RequestHandler } from "express";

import itemRepository from "./itemRepository";

const browse: RequestHandler = async (req, res, next) => {
  try {
    const items = await itemRepository.readAll();

    res.json(items);
  } catch (err) {
    next(err);
  }
};

export default { browse };
```

**Accéder aux données** dans `server/app/modules/item/itemRepository.ts` :

```typescript
import databaseClient from "../../../database/client";

import type { Result, Rows } from "../../../database/client";

interface Item {
  id: number;
  title: string;
  user_id: number;
}

class ItemRepository {
  async readAll() {
    const [rows] = await databaseClient.query<Rows>("select * from item");

    return rows as Item[];
  }
}

export default new ItemRepository();
```

**Ajouter un middleware** 

```typescript
// ...

/* ************************************************************************* */
// Define Your API Routes Here
/* ************************************************************************* */

// Define item-related routes
import itemActions from "./modules/item/itemActions";

const foo: RequestHandler = (req, res, next) => {
  req.message = "hello middleware";

  next();
}

router.get("/api/items", foo, itemActions.browse);

/* ************************************************************************* */

// ...
```

`req.message` sera disponible dans `itemActions.browse`.

⚠️ La propriété `message` doit être ajoutée dans `src/types/express/index.d.ts` :

```diff
// to make the file a module and avoid the TypeScript error
export type {};

declare global {
  namespace Express {
    export interface Request {
      /* ************************************************************************* */
      // Add your custom properties here, for example:
      //
      // user?: { ... };
      /* ************************************************************************* */
+      message: string;
    }
  }
}
```

### REST

| Opération | Méthode | Chemin d'URL | Corps de la requête | SQL    | Réponse (Succès)               | Réponse (Erreur)                                                       |
|-----------|---------|--------------|---------------------|--------|--------------------------------|------------------------------------------------------------------------|
| Browse    | GET     | /items       |                     | SELECT | 200 (OK), liste des items.     |                                                                        |
| Read      | GET     | /items/:id   |                     | SELECT | 200 (OK), un item.             | 404 (Not Found), si id invalide.                                       |
| Add       | POST    | /items       | Données de l'item   | INSERT | 201 (Created), id d'insertion. | 400 (Bad Request), si corps invalide.                                  |
| Edit      | PUT     | /items/:id   | Données de l'item   | UPDATE | 204 (No Content).              | 400 (Bad Request), si corps invalide. 404 (Not Found), si id invalide. |
| Destroy   | DELETE  | /items/:id   |                     | DELETE | 204 (No Content).              | 404 (Not Found), si id invalide.                                       |

### Autres Bonnes Pratiques

- **Sécurité** :
  - Validez et échappez toujours les entrées des utilisateurs.
  - Utilisez HTTPS pour toutes les communications réseau.
  - Stockez les mots de passe de manière sécurisée en utilisant des hash forts (ex : argon2).
  - Revoyez et mettez à jour régulièrement les dépendances.

- **Code** :
  - Suivez les principes SOLID pour une architecture de code propre et maintenable.
  - Utilisez TypeScript pour bénéficier de la vérification statique des types.
  - Adoptez un style de codage cohérent avec Biome.
  - Écrivez des tests pour toutes les fonctionnalités critiques.

## FAQ

### Installation avec Docker
> ⚠️ Prérequis : Vous devez avoir installé Docker et Docker Compose sur votre machine.  
> Suivez les instructions ici : [Docker Installation](https://docs.docker.com/get-docker/).

Lorsque Docker est installé et démarré, exécutez la commande suivante pour construire l'image Docker et démarrer les conteneurs :
```bash
docker compose up -d --build
```
La partie _client_ de l'application sera accessible à l'adresse http://localhost:3000 et la partie _serveur_ à l'adresse http://localhost:3310.  
Pour arrêter et supprimer les conteneurs, exécutez :
```bash
docker compose down
```

#### Mode développement
Les dépendances (du dossier `node_modules`) sont installées dans le conteneur Docker et ne seront pas visibles directement. Si vous utilisez un IDE comme VSCode et que vous souhaitez modifier des fichiers de votre application, vous devez installer les dépendances localement pour prévenir toute erreur de fichiers manquants.  
```bash
npm install
```

#### Installation de nouvelles dépendances
Pour installer de nouvelles dépendances, procédez en local comme d'habitude avec `npm install <package-name>`, puis, synchronisez les dépendances dans le conteneur Docker avec la commande suivante :
```bash
docker compose exec web sh -c "npm install"
```

#### Accéder à la base de données
Pour vous connecter à la base de données avec votre terminal, exécutez la commande suivante :
```bash
docker compose exec database sh -c "mysql -uuser -ppassword js_template_fullstack"
```

### Déploiement avec Traefik

> ⚠️ Prérequis : Vous devez avoir installé et configuré Traefik sur votre VPS au préalable. Suivez les instructions ici : [VPS Traefik Starter Kit](https://github.com/WildCodeSchool/vps-traefik-starter-kit/).

Pour le déploiement, ajoutez les secrets suivants dans la section `secrets` → `actions` du dépôt GitHub :

- `SSH_HOST` : Adresse IP de votre VPS
- `SSH_USER` : Identifiant SSH pour votre VPS
- `SSH_PASSWORD` : Mot de passe de connexion SSH pour votre VPS

Et une variable publique dans `/settings/variables/actions` :

- `PROJECT_NAME` : Le nom du projet utilisé pour créer le sous-domaine.

> ⚠️ Avertissement : Les underscores ne sont pas autorisés car ils peuvent causer des problèmes avec le certificat Let's Encrypt.

L'URL de votre projet sera `https://${PROJECT-NAME}.${subdomain}.wilders.dev/`.

### Variables d'environnement spécifiques

Les étudiants doivent utiliser le modèle fourni dans le fichier `*.env.sample*` en suivant la convention `<PROJECT_NAME><SPECIFIC_NAME>=<THE_VARIABLE>`.

> ⚠️ **Avertissement:** Le `PROJECT_NAME` doit correspondre à celui utilisé dans la variable publique Git.

Pour l'ajouter lors du déploiement, suivez ces deux étapes :

1. Ajoutez la variable correspondante dans le fichier `docker-compose.prod.yml` (comme montré dans l'exemple : `PROJECT_NAME_SPECIFIC_NAME: ${PROJECT_NAME_SPECIFIC_NAME}`).
2. Connectez-vous à votre serveur via SSH. Ouvrez le fichier `.env` global dans Traefik (`nano ./traefik/data/.env`). Ajoutez la variable avec la valeur correcte et sauvegardez le fichier.

Après cela, vous pouvez lancer le déploiement automatique. Docker ne sera pas rafraîchi pendant ce processus.

### Logs

Pour accéder aux logs de votre projet en ligne (pour suivre le déploiement ou surveiller les erreurs), connectez-vous à votre VPS (`ssh user@host`). Ensuite, allez dans votre projet spécifique et exécutez `docker compose logs -t -f`.

### Contribution

Nous accueillons avec plaisir les contributions ! Veuillez suivre ces étapes pour contribuer :

1. **Fork** le dépôt.
2. **Clone** votre fork sur votre machine locale.
3. Créez une nouvelle branche pour votre fonctionnalité ou bug fix (`git switch -c feature/your-feature-name`).
4. **Commit** vos modifications (`git commit -m 'Add some feature'`).
5. **Push** vers votre branche (`git push origin feature/your-feature-name`).
6. Créez une **Pull Request** sur le dépôt principal.

**Guide de Contribution** :

- Assurez-vous que votre code respecte les standards de codage en exécutant `npm run check` avant de pousser vos modifications.
- Ajoutez des tests pour toute nouvelle fonctionnalité ou correction de bug.
- Documentez clairement vos modifications dans la description de la pull request.
