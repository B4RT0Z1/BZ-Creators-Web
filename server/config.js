import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const readBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const readNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: readNumber(process.env.PORT, 3001),
  publicSiteUrl: (process.env.PUBLIC_SITE_URL || "http://localhost:8080").replace(/\/$/, ""),
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  cookieSecure: readBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === "production"),
  adminEmail: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  uploadDir: path.resolve(projectRoot, process.env.UPLOAD_DIR || "uploads"),
  maxUploadBytes: readNumber(process.env.MAX_UPLOAD_MB, 5) * 1024 * 1024,
  projectRoot,
  database: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: readNumber(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME || "bz_creators",
    user: process.env.DB_USER || "bz_creators",
    password: process.env.DB_PASSWORD || "",
    waitForConnections: true,
    connectionLimit: readNumber(process.env.DB_POOL_SIZE, 10),
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    ssl: readBoolean(process.env.DB_SSL) ? { rejectUnauthorized: true } : undefined,
  },
};

export const validateRuntimeConfig = () => {
  const problems = [];
  if (config.jwtSecret.length < 32) problems.push("JWT_SECRET debe tener al menos 32 caracteres");
  if (config.nodeEnv === "production" && /development_only|replace_with/i.test(config.jwtSecret)) {
    problems.push("JWT_SECRET debe reemplazarse por un secreto aleatorio en producción");
  }
  if (!config.database.database) problems.push("DB_NAME es obligatorio");
  if (!config.database.user) problems.push("DB_USER es obligatorio");
  if (config.nodeEnv === "production" && !config.cookieSecure) {
    problems.push("COOKIE_SECURE debe ser true en producción");
  }
  if (config.nodeEnv === "production" && /local_admin|replace_with/i.test(config.adminPassword)) {
    problems.push("ADMIN_PASSWORD de ejemplo no puede usarse en producción");
  }
  if (problems.length) throw new Error(`Configuración inválida: ${problems.join("; ")}`);
};
