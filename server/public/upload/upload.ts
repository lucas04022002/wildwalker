import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";
import multer, { type FileFilterCallback, type StorageEngine } from "multer";

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
      cb(new Error("Format non supporté. Utilisez JPG, PNG ou WEBP."), "");
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
    cb(new Error("Format non supporté. Utilisez JPG, PNG ou WEBP."));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
