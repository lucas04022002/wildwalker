# Déploiement WildWalker — VPS + Coolify

Procédure pour mettre WildWalker en production, sans coller la moindre clé
dans le chat : chaque secret est saisi par Lucas directement dans l'interface
Coolify.

L'application est **un seul conteneur** : le même processus Express sert
l'API et le client React construit. Il n'y a donc ni service front séparé,
ni CORS à régler en production — le client appelle son propre hôte.

1. **VPS** : un VPS avec Coolify déjà installé (le même que pour les autres
   projets — Coolify héberge plusieurs applications sur la même machine).

2. **Base de données** : créer une ressource **MySQL 8** dans Coolify. Noter
   l'hôte interne, le port, le nom de la base, l'utilisateur et le mot de
   passe qu'elle fournit. Ne pas exposer le port 3306 sur Internet : le
   conteneur applicatif la joint par le réseau interne de Coolify.

3. **Application Docker** : créer une application Coolify de type Docker
   pointant sur le dépôt GitHub `lucas04022002/wildwalker`, branche `main`
   (fusionner `refonte` dans `main` avant ce déploiement — ne jamais pointer
   Coolify sur une branche de travail). Contexte de build = racine du dépôt,
   `Dockerfile` à la racine (unique Dockerfile du projet). Port exposé :
   `3310`.

4. **Argument de construction** (onglet « Build » de Coolify) :
   - `VITE_STRIPE_PUBLIC_KEY` : la clé **publique** Stripe. Elle n'est pas un
     secret (le navigateur la voit), mais elle doit être connue **à la
     construction** : Vite l'inline dans le bundle. La changer impose de
     reconstruire l'image, pas seulement de redémarrer.
   - `VITE_API_URL` : **laisser vide**. C'est ce qui fait que le client
     appelle son propre hôte en URL relative. Y mettre une valeur casse la
     production en la renvoyant vers une autre origine.

5. **Variables d'environnement** (saisies par Lucas dans Coolify, jamais dans
   le chat) :
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` : ceux de la
     ressource MySQL de l'étape 2.
   - `JWT_SECRET` : 32 caractères aléatoires minimum (`openssl rand -hex 32`),
     généré une fois et fixé — le faire tourner déconnecte tout le monde.
     **Obligatoire** : le serveur refuse de démarrer sans.
   - `CLIENT_URL` : l'URL publique de l'application, exactement (par exemple
     `https://wildwalker.fr`, sans barre oblique finale). Elle sert d'origine
     de référence à CORS **et** à la garde anti-CSRF. **Obligatoire** aussi :
     mal renseignée, toutes les écritures répondent 403.
   - `APP_PORT=3310`.
   - `NODE_ENV=production`.
   - `STRIPE_SECRET_KEY` : la clé **secrète** Stripe.
   - **Ne pas poser `COOKIE_SECURE`.** Cette variable n'existe que pour le
     smoke test de la CI, qui parle en HTTP simple. En production, l'absence
     de valeur donne le bon comportement (cookie `Secure`) ; `COOKIE_SECURE=0`
     ferait voyager la session en clair.
   - `ALLOW_SEED` : laisser vide (voir l'étape 7).

6. **Volume** : monter un volume persistant sur
   `/app/server/public/uploads`. C'est là qu'atterrissent les images
   envoyées par les utilisateurs (demandes d'événement, création d'atelier).
   Sans volume, elles disparaissent à chaque redéploiement.

7. **Premier déploiement** : au démarrage du conteneur, le runner de
   migrations (`node dist/bin/migrate.js`) s'exécute avant le serveur (voir
   le `CMD` du `Dockerfile`). Il crée le schéma, ne joue chaque fichier
   qu'une fois et **ne supprime jamais rien** — aucune étape manuelle.

8. **Données de démonstration, une seule fois** : le seed n'est jamais
   automatique. Depuis le terminal Coolify du service :

   ```sh
   ALLOW_SEED=1 node dist/bin/seed.js
   ```

   Ou, si la variable est plus commode à poser dans l'interface : ajouter
   `ALLOW_SEED=1`, redéployer, lancer `node dist/bin/seed.js`, **puis retirer
   la variable et redéployer**. Le seed échoue volontairement s'il est rejoué
   sur une base déjà remplie (clés uniques) : il n'écrase et ne supprime rien.

9. **Domaine et HTTPS** : à configurer dans Coolify une fois le nom de
   domaine choisi (certificat Let's Encrypt automatique). Mettre à jour
   `CLIENT_URL` avec ce domaine et redéployer, sinon les écritures restent
   refusées par la garde d'origine.

10. **Vérification** : `GET https://<domaine>/api/health` doit répondre
    `200` avec `{"ok":true,"db":true}` — c'est aussi ce que sonde le
    `HEALTHCHECK` de l'image. Un `503` signifie que le serveur tourne mais
    ne joint pas MySQL.

## Avant d'ouvrir au public

- **Clés Stripe réelles** : l'application tourne en clés de test tant que
  `STRIPE_SECRET_KEY` / `VITE_STRIPE_PUBLIC_KEY` sont des clés `sk_test_` /
  `pk_test_`. Passer aux clés `live` impose de reconstruire l'image (la clé
  publique est inlinée à la construction).
- **Historique Git** : le dépôt pèse environ 100 Mo d'historique, dont
  d'anciennes images lourdes. Si Lucas veut l'alléger (ou purger un secret
  qui aurait été commité par l'équipe à l'époque), c'est un
  `git filter-repo` suivi d'un push forcé — une opération à décider
  explicitement, jamais en effet de bord d'un déploiement.
- **Comptes de démonstration** : les mots de passe des comptes du seed sont
  publics (ils sont écrits dans le README). Tant qu'ils existent, quiconque
  lit le dépôt peut se connecter en administrateur. Pour une mise en ligne
  autre qu'une démo de portfolio : ne pas jouer le seed, ou supprimer ces
  comptes ensuite.
- **`COOKIE_SECURE`** : vérifier une dernière fois que la variable est
  absente de la configuration Coolify.

## Ce que fait Claude et ce que fait Lucas

- Lucas : accès au VPS Coolify, achat/gestion du domaine, saisie des secrets
  dans Coolify (`DB_*`, `JWT_SECRET`, `STRIPE_SECRET_KEY`), fusion de
  `refonte` dans `main`, décision du passage en clés Stripe réelles et de la
  purge éventuelle de l'historique Git.
- Claude : rédaction du `Dockerfile`, de la CI et de ce guide ; création des
  ressources Coolify (MySQL, application) et configuration du domaine si
  accès fourni ; vérification post-déploiement (`/api/health`, client servi,
  connexion des deux rôles).
