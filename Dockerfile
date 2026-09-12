# syntax=docker/dockerfile:1

# Image de production de WildWalker.
#
# Un seul conteneur sert l'API et le client construit : même origine, donc
# pas de CORS ni de cookie tiers en production. Le client est compilé avec
# VITE_API_URL vide, ce qui donne des URL relatives (voir client/src/hooks/apiFetch.ts).
#
# Construction :
#   docker build -t wildwalker --build-arg VITE_STRIPE_PUBLIC_KEY=pk_live_xxx .

# ---------------------------------------------------------------------------
# 1. deps — dépendances complètes du monorepo (racine + les deux workspaces)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Seuls les manifestes : cette couche n'est reconstruite que si une
# dépendance change, pas à chaque modification de code.
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm ci

# ---------------------------------------------------------------------------
# 2. build — client (Vite) puis serveur (tsc)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Récupère l'arborescence de `deps` telle quelle : node_modules de la racine
# et ceux que npm a laissés dans les workspaces (l'un ou l'autre peut être
# vide selon la remontée des paquets, copier le tout évite de le deviner).
COPY --from=deps /app ./
COPY . .

# VITE_API_URL vide = API servie par la même origine que le client.
# La clé publique Stripe n'est pas un secret (elle est visible dans le
# navigateur), mais elle doit être connue à la construction : Vite l'inline.
ARG VITE_API_URL=""
ARG VITE_STRIPE_PUBLIC_KEY=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_STRIPE_PUBLIC_KEY=$VITE_STRIPE_PUBLIC_KEY

RUN npm run build --workspace=client
RUN npm run build --workspace=server

# ---------------------------------------------------------------------------
# 3. runner — l'image réellement déployée
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Dépendances de production du seul workspace `server` (le client est déjà
# compilé en fichiers statiques : aucun de ses paquets n'est utile ici).
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm ci --omit=dev --workspace=server --include-workspace-root \
  && npm cache clean --force

# Code compilé, SQL, images du serveur, et le client construit.
#
# `server/database` n'est PAS copié : `npm run build` a déjà rangé les
# fichiers SQL dans `dist/database` (scripts/copy-sql.mjs), et c'est là que
# `dist/bin/migrate.js` et `dist/bin/seed.js` les cherchent — ils résolvent
# depuis `__dirname/..`. La copie faisait double emploi, avec le risque
# qu'on finisse par corriger le mauvais des deux exemplaires.
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/public ./server/public
COPY --from=build /app/client/dist ./client/dist

# L'utilisateur `node` existe déjà dans l'image officielle (uid 1000) :
# rien ne tourne en root. Le dossier d'uploads doit lui appartenir avant la
# déclaration du VOLUME, sinon le volume hérite d'un propriétaire root.
RUN mkdir -p /app/server/public/uploads \
  && chown -R node:node /app

USER node

# Le serveur résout le dossier d'uploads depuis `process.cwd()`
# (server/src/upload/upload.ts) : le répertoire de travail fait partie
# du contrat, pas du confort.
WORKDIR /app/server

VOLUME ["/app/server/public/uploads"]

ARG APP_PORT=3310
ENV APP_PORT=$APP_PORT
EXPOSE $APP_PORT

# La sonde interroge la vraie route de santé, qui fait un `SELECT 1` : un
# serveur qui écoute sans base n'est pas « en bonne santé ».
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${APP_PORT:-3310}/api/health" | grep -q '"db":true' || exit 1

# Les migrations sont jouées au démarrage : elles ne détruisent jamais rien
# et ignorent ce qui est déjà appliqué (server/bin/migrate.ts). Le seed, lui,
# n'est jamais automatique — voir deploy/coolify.md.
CMD ["sh", "-c", "node dist/bin/migrate.js && node dist/src/main.js"]
