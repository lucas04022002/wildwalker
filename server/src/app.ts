import fs from "node:fs";
import path from "node:path";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import multer from "multer";

import { assertSameOrigin } from "./Middlewares/originMiddleware";
import { trustedProxyHops } from "./Middlewares/rateLimit";
import router from "./router";
import { MAX_UPLOAD_BYTES, UnsupportedFileTypeError } from "./upload/upload";

const app = express();

/* ************************************************************************* */
// Proxys de confiance
/* ************************************************************************* */

/**
 * Sans ce réglage, `req.ip` est l'adresse du dernier saut réseau : derrière le
 * reverse proxy de Coolify, celle du proxy, identique pour tous les visiteurs.
 * Tout ce qui raisonne par adresse — le compteur d'essais de connexion — ne
 * distinguait donc personne.
 *
 * Le nombre est déclaré, jamais deviné : `trust proxy: true` ferait confiance à
 * n'importe quel `X-Forwarded-For`, qu'un client peut écrire lui-même. Avec un
 * nombre de sauts, Express ne remonte que d'autant, et l'adresse retenue est
 * celle que le proxy a réellement vue.
 *
 * 0 par défaut (exécution directe), 1 derrière Coolify.
 */
const proxyHops = trustedProxyHops();

if (proxyHops > 0) {
  app.set("trust proxy", proxyHops);
}

/* ************************************************************************* */
// En-têtes de sécurité
/* ************************************************************************* */

/**
 * Politique de sécurité du contenu.
 *
 * Elle était désactivée en attendant le déploiement ; il a eu lieu. Les
 * origines ci-dessous ne sont pas devinées : elles ont été relevées sur le site
 * en production, en listant ce que la page charge réellement.
 *
 * `'unsafe-inline'` sur les styles est nécessaire et assumé : le client pose
 * des styles en ligne (images de fond des ateliers, via l'attribut `style`) et
 * Google Fonts sert une feuille externe. Il n'est PAS accordé aux scripts,
 * qui sont le vrai vecteur : un script injecté ne s'exécutera pas.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        // Stripe charge son SDK depuis js.stripe.com et l'exige.
        scriptSrc: ["'self'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        // `blob:` pour les aperçus d'image avant envoi ; Unsplash pour les
        // visuels de démonstration des espaces.
        imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        // Stripe monte ses champs de carte dans des iframes : sans cette
        // ligne, le paiement ne s'affiche pas du tout.
        frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
  }),
);

/* ************************************************************************* */
// CORS
/* ************************************************************************* */

// Une seule origine autorisée, celle du client, et `credentials: true` parce
// que la session voyage désormais dans un cookie. `CLIENT_URL` est exigée au
// démarrage (voir main.ts) : sans elle, aucune origine n'est acceptée.
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? false,
    credentials: true,
  }),
);

/* ************************************************************************* */
// Lecture de la requête
/* ************************************************************************* */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Garde d'origine sur toutes les écritures, avant le routeur : aucune route
// non-GET ne peut être ajoutée sans en bénéficier.
app.use(assertSameOrigin);

/* ************************************************************************* */
// API
/* ************************************************************************* */

app.use(router);

// Une route d'API inconnue répond 404 en JSON, et n'est jamais servie par le
// repli statique du client ci-dessous.
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Route inconnue." });
});

/* ************************************************************************* */
// Fichiers statiques (serveur puis client construit)
/* ************************************************************************* */

/**
 * Racine du workspace `server`, quelle que soit la façon dont on tourne.
 *
 * En développement (tsx) `__dirname` vaut `server/src` ; une fois compilé il
 * vaut `server/dist/src`. Un chemin relatif unique ne peut donc pas convenir
 * aux deux : on remonte d'un cran de plus quand le dossier parent est `dist`.
 * Sans ça, l'image Docker servait `server/server/public` — c'est-à-dire rien.
 */
const serverRoot =
  path.basename(path.join(__dirname, "..")) === "dist"
    ? path.join(__dirname, "..", "..")
    : path.join(__dirname, "..");

const publicFolderPath = path.join(serverRoot, "public");

if (fs.existsSync(publicFolderPath)) {
  app.use(express.static(publicFolderPath));
}

// En production le client construit est servi par le même processus : une
// seule image, une seule origine, donc pas de CORS ni de cookie tiers.
// Ce bloc est placé APRÈS le 404 JSON de `/api` : une route d'API inconnue
// répond en JSON et ne reçoit jamais l'`index.html` du client.
const clientBuildPath = path.join(serverRoot, "..", "client", "dist");

if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));

  app.get("*", (_, res) => {
    res.sendFile("index.html", { root: clientBuildPath });
  });
}

/* ************************************************************************* */
// Envois de fichiers refusés (avant la journalisation)
/* ************************************************************************* */

/**
 * Un fichier trop gros ou d'un type refusé est une erreur de l'appelant,
 * pas une panne du serveur. Sans ce gestionnaire, multer laissait filer son
 * erreur jusqu'au filet final : 500 « Erreur serveur. », et l'utilisateur
 * qui envoie un PDF de 40 Mo n'apprenait ni quoi ni pourquoi.
 *
 * Placé AVANT `logErrors` : un refus attendu n'a pas à encombrer les
 * journaux d'erreurs.
 */
const MULTER_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: `Fichier trop volumineux : ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} Mo maximum.`,
  LIMIT_FILE_COUNT: "Trop de fichiers envoyés.",
  LIMIT_UNEXPECTED_FILE: "Champ de fichier inattendu.",
  LIMIT_PART_COUNT: "Formulaire trop volumineux.",
  LIMIT_FIELD_KEY: "Nom de champ trop long.",
  LIMIT_FIELD_VALUE: "Valeur de champ trop longue.",
  LIMIT_FIELD_COUNT: "Trop de champs dans le formulaire.",
};

const handleUploadErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({
      message: MULTER_MESSAGES[err.code] ?? "Le fichier envoyé a été refusé.",
    });
    return;
  }

  if (err instanceof UnsupportedFileTypeError) {
    res.status(400).json({ message: err.message });
    return;
  }

  next(err);
};

app.use(handleUploadErrors);

/* ************************************************************************* */
// Journalisation des erreurs (toujours en dernier)
/* ************************************************************************* */

const logErrors: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  console.error("on req:", req.method, req.path);

  next(err);
};

app.use(logErrors);

/**
 * Dernier filet. Sans lui, Express répond avec la pile d'appel en clair hors
 * production : chemins de fichiers, requêtes SQL et noms de colonnes offerts
 * à qui provoque une erreur. Le détail reste dans les journaux du serveur.
 */
const handleErrors: ErrorRequestHandler = (err, _req, res, next) => {
  // Réponse déjà partie (flux interrompu, en-têtes émis) : on ne peut plus
  // rien écrire. On rend la main à Express, qui fermera la connexion — se
  // contenter d'un `return` laissait la requête pendante jusqu'au timeout.
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({ message: "Erreur serveur." });
};

app.use(handleErrors);

export default app;
export { clientBuildPath, handleErrors, publicFolderPath, serverRoot };
