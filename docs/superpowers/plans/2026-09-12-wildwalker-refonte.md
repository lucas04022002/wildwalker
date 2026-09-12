# WildWalker — refonte portfolio : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre WildWalker déployable et défendable : migrations sans destruction, failles fermées, jeton en cookie, client gardé, dépôt allégé, Docker + CI + README.

**Architecture:** Monorepo npm workspaces inchangé (`client` React 19 + Vite, `server` Express 4 + mysql2, SQL paramétré, pattern Actions/Repository). Le serveur est compilé (`tsc`) et sert le client construit en production ; un seul conteneur derrière Coolify.

**Tech Stack:** Node 22, TypeScript 5, Express 4.22, mysql2, argon2, jsonwebtoken, helmet, Joi, jest + supertest (serveur), Vitest + Testing Library (client, nouveau), sharp (script d'images), Docker, GitHub Actions avec service `mysql:8`.

## Global Constraints

- Spec : `docs/superpowers/specs/2026-09-12-wildwalker-refonte-design.md`. Dépôt `C:\Users\lucas\OneDrive\Desktop\Js-Team-vert-WildWlaker-P3-G1` (remote `lucas04022002/wildwalker`), branche `refonte`, jamais `main`. Commits en français, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Pas de MySQL ni de Docker en local** : les tests d'intégration (`*.int.test.ts`) sont ignorés en local sans `DB_HOST` et tournent en CI ; les tests unitaires mockent les repositories (`jest.mock`). Ne jamais lancer `docker`. Ne pas modifier le métier ni le design.
- Aucun secret dans le code, les tests ou la CI (les valeurs de test sont factices et nommées comme telles). `.env*` jamais suivis sauf `.env.sample`.
- Cookie de session `ww_session` : JWT HS256, 7 jours, `httpOnly`, `SameSite=Lax`, `Secure` si `NODE_ENV=production`. Les routes de mutation vérifient l'origine (`sec-fetch-site` ≠ `cross-site`, `Origin` = `CLIENT_URL` ou hôte).
- Mots de passe de démo documentés : `demo-client-2026`, `demo-admin-2026`. `ALLOW_SEED=1` obligatoire pour seeder en production.
- Biome (`npm run check`) et `tsc` (`npm run check-types --workspaces`) verts à chaque tâche ; `npm test` vert.
- Le module `item`, les seeders et les hooks morts disparaissent (tâche 4) ; jusque-là, ne pas les toucher.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `server/database/migrations/0001_init.sql`, `server/database/seed.sql` | DDL corrigé ; données de démo (hashes régénérés) |
| `server/bin/migrate.ts`, `server/bin/seed.ts`, `server/bin/hash-demo-passwords.ts` | runner de migrations idempotent ; chargement du seed (garde prod) ; régénération des hashes |
| `server/src/Middlewares/authMiddleware.ts`, `originMiddleware.ts`, `rateLimit.ts` | auth par cookie, rôle admin, garde d'origine, limite de débit |
| `server/src/modules/Authentification/*` | login pose le cookie, logout l'efface, `me` ; plus de jeton dans la réponse ni dans les logs |
| `server/src/modules/Payment/*`, `bookingActions/*`, `cart/*` | montants serveur, `userId` du jeton, propriété des lignes |
| `server/src/modules/shared/billingRepository.ts` | requêtes communes client/admin |
| `server/src/app.ts`, `server/src/main.ts` | helmet, CORS credentials, `/api/health`, statique `client/dist` en prod, `CLIENT_URL` obligatoire |
| `server/tests/**` | unitaires (mocks) + `*.int.test.ts` (CI) |
| `client/src/hooks/apiFetch.ts`, `client/src/components/RequireRole.tsx`, `client/src/main.tsx`, pages login/logout/payment/cart | cookie, gardes, plus de montant côté client |
| `client/vitest.config.ts`, `client/src/**/*.test.tsx` | tests client |
| `scripts/optimize-images.mjs` | conversion WebP |
| `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.github/workflows/ci.yml`, `deploy/coolify.md`, `README.md` | infra et doc |

---

### Task 1 : Migrations sans destruction, seed séparé, build sain

**Files:**
- Create: `server/database/migrations/0001_init.sql`, `server/database/seed.sql`, `server/bin/seed.ts`, `server/bin/hash-demo-passwords.ts`, `server/tests/migrate.test.ts`
- Modify: `server/bin/migrate.ts` (réécrit), `server/package.json` (scripts), `package.json` racine (scripts `db:migrate`, `db:seed`), `README.md` (section base de données, provisoire), `.env.sample` serveur (`ALLOW_SEED`)
- Delete: `server/database/schema.sql` (après scission), `server/database/checkConnection.ts` si redondant, `server/bin/seed/*` (AbstractSeeder, ItemSeeder, UserSeeder)

**Interfaces:**
- `server/bin/migrate.ts` exporte `runMigrations(pool, dir): Promise<string[]>` (noms appliqués) et s'exécute en CLI ; `schema_migrations(name VARCHAR(255) PRIMARY KEY, applied_at DATETIME)` ; chaque fichier appliqué dans une transaction, dans l'ordre lexical, ignoré s'il est déjà noté.
- `server/bin/seed.ts` : `runSeed(pool, file)` ; refuse si `process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1"`.
- Scripts : serveur `build` = `tsc`, `start` = `node dist/main.js`, `db:migrate` = `tsx bin/migrate.ts`, `db:seed` = `tsx bin/seed.ts` ; racine `db:migrate`/`db:seed` délèguent au workspace serveur.

- [ ] **Step 1 : Test (échec d'abord)** — `server/tests/migrate.test.ts` : avec un pool mocké (`{ query: jest.fn(), getConnection: … }`), `runMigrations` crée `schema_migrations` si absente, applique `0001_init.sql` et `0002_x.sql` d'un dossier temporaire dans l'ordre, n'applique pas un fichier déjà listé, et n'émet **jamais** `DROP DATABASE` (assertion sur toutes les requêtes exécutées).
- [ ] **Step 2 : Scinder `schema.sql`** : DDL → `0001_init.sql` avec les corrections de la spec §2 (supprimer `fortgot_password`, `claim.claim_date DATE`, `activity.price_unit DECIMAL(10,2)`, FK `activity.users_id → users.id`, `booking.id_activity → activity.id`) ; `INSERT` → `seed.sql`. Vérifier que le seed respecte les nouveaux types (dates, décimaux).
- [ ] **Step 3 : Hashes de démo** : `hash-demo-passwords.ts` calcule argon2id de `demo-client-2026` et `demo-admin-2026` et réécrit les colonnes `password` de `seed.sql` (clients → hash client, `role='admin'` → hash admin). Exécuter une fois, commiter le seed résultant.
- [ ] **Step 4 : Runner et scripts** ; `npm run build --workspace=server` doit produire `server/dist/main.js` (ajuster `server/tsconfig.json` : `outDir: dist`, `rootDir`, `include` src + bin). Vérifier `node dist/main.js` démarre jusqu'à « CLIENT_URL manquante » ou l'écoute (sans MySQL, le démarrage doit échouer proprement avec un message, pas une trace).
- [ ] **Step 5 : Lancer** `npm test --workspace=server`, `npm run check`, `npm run check-types --workspaces`.
- [ ] **Step 6 : Commit** `git commit -am "feat(db): migrations idempotentes, seed séparé avec mots de passe de démo documentés, build serveur = tsc (plus jamais DROP DATABASE)"`

---

### Task 2 : Sécurité serveur

**Files:**
- Modify: `server/src/Middlewares/authMiddleware.ts`, `server/src/modules/Authentification/{AuthentificationAction,Jwt}.ts`, `server/src/modules/Payment/{PaymentAction,PaymentRepository}.ts`, `server/src/modules/bookingActions/bookingActions.ts`, `server/src/modules/bookingActions/bookingRepository.ts` (ou équivalent), `server/src/modules/cart/{cartAction,cartRepository}.ts`, `server/src/router.ts`, `server/src/app.ts`, `server/src/main.ts`, `server/package.json` (helmet, cookie-parser)
- Create: `server/src/Middlewares/originMiddleware.ts`, `server/src/Middlewares/rateLimit.ts`, `server/src/modules/Payment/amount.ts`, `server/tests/{auth-middleware,origin,rate-limit,payment-amount,booking-body,cart-ownership}.test.ts`, `server/tests/booking.int.test.ts` (CI)

**Interfaces:**
- `requireAuth` lit le cookie `ww_session` (via `cookie-parser`) **ou** l'en-tête `Authorization: Bearer` (transition) ; `requireAdmin = [requireAuth, (req,res,next) => req.user.role === "admin" ? next() : res.status(403).json({ message: "Accès réservé à l'administration." })]`.
- Login (`/api/auth/login/client|admin`) : vérifie le mot de passe, **puis le rôle attendu**, pose `res.cookie("ww_session", token, { httpOnly, sameSite: "lax", secure: NODE_ENV==="production", maxAge: 7j, path: "/" })`, répond `{ user: { id, email, role, firstname } }` sans jeton. `POST /api/auth/logout` efface le cookie. `Jwt.ts` ne logue plus rien.
- `originMiddleware.assertSameOrigin` sur toutes les routes non-GET : `sec-fetch-site` ∈ {same-origin, same-site, none} ou absent, et `Origin`, s'il est présent, égal à `CLIENT_URL` ou à l'hôte ; sinon 403.
- `rateLimit.loginLimiter` : 10 essais par e-mail par 15 min, en mémoire (Map), 429 avec `Retry-After`.
- `computeCartAmount(cartRows)` (pur) et `PaymentRepository.amountForUser(userId)` : total en centimes depuis les lignes du panier jointes aux prix en base ; `create-intent` ignore tout montant du body.
- Réservation : `bookingActions.create` prend `{ items: [{ type: "space"|"activity", id, quantity, timeSlotId? }] }`, `userId = req.user.id`, prix relus en base ; la transaction + `SELECT … FOR UPDATE` existante est conservée.
- Panier : `GET /api/cart` (plus de `:userId`), `POST /api/cart` (userId du jeton), `PATCH|DELETE /api/cart/:id` → `WHERE id = ? AND users_id = ?`, 404 si 0 ligne.

- [ ] **Step 1 : Tests unitaires (échec d'abord)** avec `supertest` sur `app` et `jest.mock` des repositories :
  - `requireAdmin` : cookie d'un client → 403 ; cookie admin → 200 ; sans cookie → 401.
  - Login admin avec un compte client → 401 (message générique), et inversement.
  - `POST /api/payment/create-intent` avec `amount: 1` dans le body → le montant transmis à Stripe (mocké) est celui calculé depuis le panier mocké (ex. 2 × 40 € = 8000 centimes).
  - `POST /api/booking` avec `userId: 999` et `price_unit: 0.01` dans le body → la réservation créée porte `req.user.id` et le prix de la base.
  - `PATCH /api/cart/:id` d'une ligne d'un autre utilisateur → 404 ; `GET /api/cart/:userId` → 404 (route supprimée).
  - Garde d'origine : `POST /api/cart` avec `sec-fetch-site: cross-site` → 403.
  - Limite de débit : 11e login sur le même e-mail → 429.
- [ ] **Step 2 : Test d'intégration CI** `booking.int.test.ts` (skippé si `!process.env.DB_HOST`) : migrations + seed, login client de démo, réservation d'un créneau, seconde réservation du même créneau → refusée (transaction/verrou).
- [ ] **Step 3 : Implémenter** (helmet avec `contentSecurityPolicy: false` pour l'instant, CORS `{ origin: CLIENT_URL, credentials: true }`, `CLIENT_URL` obligatoire).
- [ ] **Step 4 : Lancer** tests, biome, tsc. **Commit** `git commit -am "fix(sécurité): rôle admin vérifié, montants et userId côté serveur, propriété du panier, jeton en cookie httpOnly, garde d'origine, helmet, limite de débit au login"`

---

### Task 3 : Client — cookie, gardes de route, montants

**Files:**
- Modify: `client/src/hooks/apiFetch.ts` (`credentials: "include"`, plus de lecture de token, `logout` appelle `POST /api/auth/logout` puis redirige), pages de connexion (`/log-in`, `/sign-in`) et tout code lisant `localStorage.token`, `client/src/main.tsx` (gardes), page `/payment` (plus d'`amount` envoyé), page `/cart` (`GET /api/cart`), `client/.env.sample`
- Create: `client/src/components/RequireRole.tsx`, `client/src/hooks/useSession.ts` (appelle `GET /api/auth/me`, expose `{ user, loading }`), `client/vitest.config.ts`, `client/src/components/RequireRole.test.tsx`, `client/src/hooks/apiFetch.test.ts`, `client/src/pages/LogIn.test.tsx` (nom selon l'existant)
- Modify: `client/package.json` (vitest, jsdom, @testing-library/react, script `test`), `package.json` racine (`test` couvre les deux workspaces)

**Interfaces:**
- `RequireRole({ role: "client" | "admin", children })` : pendant le chargement rien ; sans session → `<Navigate to="/log-in" state={{ from }} />` ; mauvais rôle → `<Navigate to="/" />`.
- Routes protégées : `/dashboard-client`, `/cart`, `/payment`, `/confirmation`, `/invoice/:bookingId` (client) ; `/dashboard-admin` (admin).

- [ ] **Step 1 : Tests (échec d'abord)** : `RequireRole` redirige sans session et rend l'enfant avec le bon rôle (mock de `useSession`) ; `apiFetch` envoie `credentials: "include"` et n'ajoute plus `Authorization` (spy sur `fetch`) ; le formulaire de connexion affiche le `message` renvoyé par l'API en 401.
- [ ] **Step 2 : Implémenter** ; `grep -rn "localStorage\|sessionStorage" client/src` → 0 (hors éventuel « se souvenir de moi » retiré).
- [ ] **Step 3 : Lancer** `npm test`, `npm run check`, `npm run check-types --workspaces`, `npm run build --workspace=client`. **Commit** `git commit -am "feat(client): session par cookie, gardes de route par rôle, montant calculé côté serveur, tests Vitest"`

---

### Task 4 : Nettoyage, dépendances, duplication

**Files:**
- Delete: `server/src/modules/item/**`, `server/tests/item/**`, `server/tests/install.test.ts`, `server/bin/seed/**` (si restant), `client/src/hooks/{useAvailability,useRemainingForOneEvent,useSpacesAvailability,useSpacesAvailabilty}.ts`, le `CardSpace` non utilisé (vérifier les imports), `docker-compose.prod.yml`, `.github/workflows/deploy-traefik.yml`
- Modify: `client/package.json` (retirer `multer`, `@types/multer`), `package.json` × 3 (métadonnées réelles, versions), `biome.json` (schéma aligné), `server/src/modules/dashboardClient/dashboardClientRepository.ts` + `dashboardAdmin/dashboardAdminRepository.ts` → `server/src/modules/shared/billingRepository.ts`, commentaires pédagogiques du gabarit retirés (`Dockerfile`, `README`, `bin/`)
- Upgrade: `react-router` ≥ 7.19, `multer` ≥ 2 corrigé, `mysql2` ≥ 3.24, `express` 4.22+ ; `npm audit --omit=dev` → 0 haute/critique (rapporter le reste)

- [ ] **Step 1 :** `grep -rn` avant chaque suppression pour prouver l'absence d'import ; supprimer ; `tsc` et biome verts.
- [ ] **Step 2 :** extraire `billsNumber` et les requêtes identiques dans `billingRepository.ts` avec un test unitaire (mock du pool) ; les deux dashboards l'importent.
- [ ] **Step 3 :** mises à jour de dépendances, `npm audit --omit=dev`, tests verts. **Commit** `git commit -am "chore: code mort du gabarit supprimé, dépendances corrigées (react-router, multer, mysql2, express), requêtes de facturation partagées"`

---

### Task 5 : Images

**Files:**
- Create: `scripts/optimize-images.mjs` (sharp : PNG/JPG → WebP q82, largeur max 1600, écrit à côté puis supprime l'original), `server/public/uploads/.gitkeep`
- Modify: toutes les références d'images (`grep -rn "\.png\|\.jpg\|\.jpeg" client/src server/database server/public` → extensions `.webp`), `.gitignore` (`server/public/uploads/*`, `!server/public/uploads/.gitkeep`)
- Delete: doublon `server/public/assets/break-room/` (garder `spaces/break-room/`), `server/public/uploads/*.jpg` accidentel

- [ ] **Step 1 :** `npm install -D sharp` à la racine (binaire prébuilt : si Smart App Control bloque le chargement, le dire et convertir avec Python `Pillow` à la place, même paramètres).
- [ ] **Step 2 :** exécuter, vérifier `du -sh client/src/assets server/public/assets` < 15 Mo, aucune référence cassée (`npm run build --workspace=client` + grep), pages chargeant les images vérifiées en dev (`npm run dev:client` + capture d'une page espaces).
- [ ] **Step 3 : Commit** `git commit -am "perf(images): conversion WebP, doublons et upload accidentel retirés, uploads hors git"` (ne pas purger l'historique : décision de Lucas plus tard).

---

### Task 6 : Docker, serveur statique, CI, déploiement, README

**Files:**
- Modify: `Dockerfile` (multi-stage : deps → build client + serveur → runner `node:22-alpine` non-root, `EXPOSE 3310` ou le port de `APP_PORT`, `HEALTHCHECK` sur `/api/health`, `CMD ["sh","-c","node bin/migrate.js && node dist/main.js"]`), `.dockerignore`, `docker-compose.yml` (app + mysql:8, volume uploads), `server/src/app.ts` (route `GET /api/health` → `{ ok: true, db: true|false }` ; en production `express.static(client/dist)` + repli `index.html` hors `/api`), `.github/workflows/ci.yml` (remplace `check.yml`), `README.md`, `.env.sample` × 2
- Create: `deploy/coolify.md`, `deploy/crontab.txt` (vide ou purge d'uploads orphelins si utile), captures dans `docs/screenshots/*.webp` (3 captures prises en dev : accueil, espaces, dashboard admin)

- [ ] **Step 1 : CI** : job `checks` (biome, tsc × 2, tests unitaires, build client) ; job `integration` avec service `mysql:8` (variables `DB_*`, `JWT_SECRET` de test, `CLIENT_URL=http://localhost:5173`) : `db:migrate`, `db:seed` (`ALLOW_SEED=1`), tests `*.int.test.ts` ; job `image` : `docker build`, `docker run` avec MySQL sur un réseau, migration + seed, `curl /api/health` (200, `db:true`), `curl /` (HTML du client), login admin de démo → cookie → `GET` d'une route admin 200, login client → même route 403, logs sur échec, nettoyage. Gardes : aucun `.env` suivi, `grep -rn "console.log(.*token" server/src` vide.
- [ ] **Step 2 : Pousser la branche, CI verte** (jusqu'à 3 itérations).
- [ ] **Step 3 : `deploy/coolify.md` et README** selon spec §3 et §6 (comptes de démo, la réservation transactionnelle expliquée, crédits de l'équipe : Aude Charrier, Nico Semenadisse, Brice Kutuk, Lucas Guilhot, Coline Rabemihoatra, Leo Fleury).
- [ ] **Step 4 : Commit** `git commit -am "chore: Dockerfile multi-stage, client servi par Express, CI avec MySQL et smoke test, guide Coolify, README portfolio"`

---

## Auto-revue

- Spec §1 → T2 + T3 ; §2 → T1 ; §3 → T6 ; §4 → T5 ; §5 → T4 (+ tests T2/T3) ; §6 → T6 ; §7 ordre respecté.
- Noms constants : cookie `ww_session`, `requireAuth`/`requireAdmin`, `assertSameOrigin`, `loginLimiter`, `computeCartAmount`, `runMigrations`, `runSeed`, `RequireRole`, `useSession`, route `/api/health`, scripts `db:migrate`/`db:seed`.
- Risque connu : la transition du jeton (en-tête → cookie) casse le client tant que T3 n'est pas faite ; T2 accepte les deux pour que l'app reste utilisable entre les deux tâches.
