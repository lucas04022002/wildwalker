import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";
import multer, { type FileFilterCallback, type StorageEngine } from "multer";

/**
 * Dossier d'arrivée des fichiers, résolu depuis `process.cwd()` : le
 * répertoire de travail fait partie du contrat de déploiement (voir le
 * Dockerfile). Ce module vit dans `src/` — `public/` ne contient que des
 * fichiers servis tels quels, jamais du code.
 */
const uploadDir = path.join(process.cwd(), "public", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Types acceptés, et extension imposée pour chacun.
 *
 * Le nom d'origine du fichier n'est jamais réutilisé : il vient du client,
 * donc il peut contenir des séparateurs de chemin, une double extension, ou
 * de quoi écraser un fichier voisin. Le nom stocké est fabriqué ici.
 */
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Refus d'un type de fichier. Une classe plutôt qu'un `Error` nu : le
 * gestionnaire d'erreurs la reconnaît et répond 400 avec le message, au
 * lieu du 500 neutre réservé aux vraies pannes.
 */
class UnsupportedFileTypeError extends Error {
  constructor() {
    super("Format non supporté. Utilisez JPG, PNG ou WEBP.");
    this.name = "UnsupportedFileTypeError";
  }
}

const storage: StorageEngine = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    cb(null, uploadDir);
  },

  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const extension = ALLOWED_TYPES[file.mimetype];

    if (extension == null) {
      cb(new UnsupportedFileTypeError(), "");
      return;
    }

    cb(null, `${Date.now()}-${randomUUID()}.${extension}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (ALLOWED_TYPES[file.mimetype] != null) {
    cb(null, true);
  } else {
    cb(new UnsupportedFileTypeError());
  }
};

/** Taille maximale d'un envoi, en octets. Le message d'erreur la cite. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
});

export { UnsupportedFileTypeError };
