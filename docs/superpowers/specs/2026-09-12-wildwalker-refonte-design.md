# WildWalker — refonte « portfolio » (spec, 12/09/2026)

## Décisions

- Objectif : un projet **déployable et défendable en entretien**, pas un nouveau produit. On garde le métier (tiers-lieu « Le Local » : espaces, événements, panier, paiement Stripe, factures, tableaux de bord client et admin), le schéma MySQL, l'architecture Actions/Repository, le design visuel de l'équipe.
- On refait ce qui est cassé ou dangereux : sécurité (rôles, montants, propriété des données, jeton), build destructeur, migrations, Docker/CI, images, code mort, dépendances, tests, README.
- Hors périmètre : refonte visuelle (le CSS de l'équipe reste ; passe séparée si Lucas le veut plus tard), envoi d'e-mails, nouvelles fonctionnalités.
- Contraintes machine : pas de Docker ni de MySQL sur le PC de Lucas, Smart App Control bloque les binaires non signés. Les tests unitaires tournent en local (jest, dépôts mockés) ; les tests d'intégration et le smoke test Docker tournent en CI (service MySQL 8).
- Dépôt : `lucas04022002/wildwalker`, branche `refonte` → PR vers `main`. Commits en français, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## 1. Sécurité

| Défaut | Correction |
|---|---|
| `requireAdmin` ne vérifie pas le rôle | `requireAdmin` = `requireAuth` + `req.user.role === "admin"` sinon 403 ; test unitaire ; toutes les routes `/api/admin/*` et `/api/dashboard-admin/*` derrière |
| Montant Stripe fourni par le client | `POST /api/payment/create-intent` recalcule le montant côté serveur à partir du panier de `req.user.id` (prix lus en base) ; le client n'envoie plus de montant |
| `POST /api/booking` fait confiance à `userId` et `price_unit` | `userId = req.user.id` ; prix relus en base par `space`/`activity` ; le body ne porte que les identifiants et quantités |
| IDOR panier (`GET /api/cart/:userId`, `PATCH`/`DELETE /api/cart/:id`) | routes sans `:userId` (`GET /api/cart`), et chaque mutation vérifie que la ligne appartient à `req.user.id` (404 sinon) |
| Jeton JWT en `localStorage` + logué à chaque requête | jeton dans un cookie `ww_session` **httpOnly, SameSite=Lax, Secure en prod**, posé au login, supprimé au logout ; `apiFetch` en `credentials: "include"` ; garde d'origine sur les mutations (`Origin`/`sec-fetch-site`) ; plus aucun `console.log` de jeton ; CORS avec `credentials: true` sur la seule origine `CLIENT_URL` |
| Aucune garde de route côté client | `RequireRole` autour de `/dashboard-client`, `/cart`, `/payment`, `/confirmation`, `/invoice/:id` (client) et `/dashboard-admin` (admin) ; redirection vers `/log-in` |
| Upload : nom de fichier non assaini | nom = `Date.now()-<uuid>.<ext>` dérivé du MIME validé, jamais de l'original |
| Divers | `helmet` ; limite de débit sur `/api/auth/login/*` (10 essais / e-mail / 15 min, en mémoire) ; `CLIENT_URL` obligatoire au démarrage (l'app refuse de démarrer sans) |

## 2. Base de données et migrations

- `server/database/schema.sql` est scindé : `server/database/migrations/0001_init.sql` (DDL seul, avec les corrections : `forgot_password` supprimé, `claim.claim_date` en `DATE`, `activity.price_unit` en `DECIMAL(10,2)`, FK manquantes `activity.users_id`, `booking.id_activity`) et `server/database/seed.sql` (données de démo).
- Runner `server/bin/migrate.ts` : table `schema_migrations(name, applied_at)`, applique dans l'ordre les fichiers non encore appliqués, **ne supprime jamais rien**. `npm run db:migrate` ; `npm run db:seed` charge `seed.sql` et **refuse en `NODE_ENV=production` sauf `ALLOW_SEED=1`**.
- Comptes de démo : mots de passe **documentés** dans le README (`demo-client-2026` pour les 25 clients, `demo-admin-2026` pour les admins), hashes régénérés à la génération du seed.
- `npm run build` du serveur = `tsc` (compilation vers `dist/`), plus jamais une migration.

## 3. Build, Docker, CI, déploiement

- Serveur compilé (`tsc` → `server/dist`), démarré par `node dist/main.js` ; en production Express sert aussi le client construit (`client/dist`) en statique avec repli `index.html`, donc **un seul conteneur** derrière Coolify ; `/uploads` sur un volume.
- `Dockerfile` multi-stage `node:22-alpine` (deps → build client + serveur → runner non-root, `CMD` = `node bin/migrate.js && node dist/main.js`), `.dockerignore` réel (node_modules, .git, docs, tests, assets sources non nécessaires), `HEALTHCHECK` sur `/api/health` (nouvelle route).
- `docker-compose.yml` local : app + MySQL 8 (pour qui a Docker) ; l'ancien `docker-compose.prod.yml` Traefik et `deploy-traefik.yml` (VPS école) supprimés.
- CI GitHub Actions : `npm ci`, biome, `tsc` client et serveur, tests unitaires, tests d'intégration contre un service `mysql:8` (migrations + seed appliqués), build client, `docker build` + démarrage du conteneur avec MySQL, `curl /api/health` et `/` (client servi), plus un login admin de démo et un `GET /api/dashboard-admin/...` en 200 et le même en 403 avec un client.
- `deploy/coolify.md` en français, même structure que RushPlay/ApplyBot : ressource MySQL 8, service Docker, variables saisies par Lucas dans Coolify (`DB_*`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `CLIENT_URL`), volume `/uploads`, `ALLOW_SEED=1` une seule fois pour la démo, domaine et HTTPS.

## 4. Images

- Toutes les images PNG/JPG du dépôt converties en **WebP** (qualité 82, largeur max 1 600 px) avec `sharp` (script `scripts/optimize-images.mjs`, exécuté une fois, résultat commité) ; références mises à jour dans le code et le seed ; doublons `break-room/` supprimés ; upload accidentel `server/public/uploads/*.jpg` supprimé et `server/public/uploads/` ignoré par git (`.gitkeep`).
- Cible : moins de 15 Mo d'images dans l'arbre de travail. L'historique git (103 Mo) est purgé **seulement si Lucas le demande** (`git filter-repo`, force push, comme pour ApplyBot).

## 5. Nettoyage, dépendances, tests

- Supprimés : module `item` (actions, repository, tests), seeders `AbstractSeeder`/`ItemSeeder`/`UserSeeder`, hooks non importés (`useAvailability`, `useRemainingForOneEvent`, `useSpacesAvailability` × 2), le second `CardSpace`, `multer` côté client, `install.test.ts` du gabarit, commentaires pédagogiques du gabarit, métadonnées `package.json` (« hit Enter… »), `biome.json` aligné sur la version installée.
- Duplication : `billsNumber` et les requêtes communes client/admin déplacées dans un repository partagé.
- Dépendances : `react-router` ≥ 7.19, `multer` ≥ 2.x corrigé, `mysql2` ≥ 3.24, `express` 4.22 avec `qs` corrigé, `npm audit --omit=dev` = 0 vulnérabilité haute ou critique.
- Tests serveur (jest + supertest) : middlewares (`requireAuth`, `requireAdmin`), garde d'origine, calcul de montant, création de réservation (montant et `userId` ignorés du body), panier (IDOR → 404), limite de débit ; en CI, intégration réelle : migration + seed sur MySQL, login des deux rôles, réservation d'un espace avec transaction et verrou (double réservation refusée).
- Tests client (Vitest + Testing Library, nouveau) : `RequireRole` (redirection), `apiFetch` (credentials), formulaire de connexion (erreur affichée).

## 6. README et portfolio

- README en français : ce que c'est, captures (accueil, espaces, dashboard admin), architecture en dix lignes, la réservation transactionnelle expliquée en cinq lignes (le sujet d'entretien), lancement local (Docker Compose ou MySQL externe), comptes de démo, déploiement (lien vers `deploy/coolify.md`), crédits de l'équipe (six prénoms, rôles si connus).
- `LICENSE.md` conservé.

## 7. Ordre de livraison

1. Build destructeur neutralisé + migrations + seed (sans ça, rien n'est déployable).
2. Sécurité serveur (rôle, montants, propriété, cookie, garde d'origine, helmet, débit) avec tests unitaires.
3. Client : `apiFetch` en cookie, gardes de route, suppression du montant côté client, logout.
4. Nettoyage, dépendances, duplication, tests client.
5. Images.
6. Dockerfile, serveur statique, CI complète avec MySQL et smoke test, `deploy/coolify.md`, README.
