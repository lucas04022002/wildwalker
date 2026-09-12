import fs from "node:fs";
import path from "node:path";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";

import { assertSameOrigin } from "./Middlewares/originMiddleware";
import router from "./router";

const app = express();

/* ************************************************************************* */
// En-têtes de sécurité
/* ************************************************************************* */

// `contentSecurityPolicy: false` pour l'instant : une CSP réelle demande de
// lister les origines du client (Stripe, polices) et sera posée avec le
// déploiement. Le reste de helmet (nosniff, frameguard, HSTS...) s'applique.
app.use(helmet({ contentSecurityPolicy: false }));

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

const publicFolderPath = path.join(__dirname, "../../server/public");

if (fs.existsSync(publicFolderPath)) {
  app.use(express.static(publicFolderPath));
}

const clientBuildPath = path.join(__dirname, "../../client/dist");

if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));

  // Redirect unhandled requests to the client index file
  app.get("*", (_, res) => {
    res.sendFile("index.html", { root: clientBuildPath });
  });
}

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
const handleErrors: ErrorRequestHandler = (_err, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  res.status(500).json({ message: "Erreur serveur." });
};

app.use(handleErrors);

export default app;
