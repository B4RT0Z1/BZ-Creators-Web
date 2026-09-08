import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { config } from "./config.js";

fs.mkdirSync(config.uploadDir, { recursive: true });

const extensionsByMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, config.uploadDir),
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${extensionsByMime[file.mimetype]}`),
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!extensionsByMime[file.mimetype]) return callback(new Error("Formato de imagen no permitido"));
    return callback(null, true);
  },
}).single("image");

export const deleteLocalImage = async (imageUrl) => {
  if (!imageUrl || !imageUrl.startsWith("/uploads/")) return;
  const filename = path.basename(imageUrl);
  const target = path.resolve(config.uploadDir, filename);
  if (path.dirname(target) !== config.uploadDir) return;
  await fs.promises.unlink(target).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
};
