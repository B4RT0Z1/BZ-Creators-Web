import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { config, validateRuntimeConfig } from "./config.js";

export const migrate = async () => {
  validateRuntimeConfig();

  const connection = await mysql.createConnection({
    ...config.database,
    multipleStatements: true,
  });

  try {
    const schema = await fs.readFile(path.join(config.projectRoot, "server", "schema.sql"), "utf8");
    await connection.query(schema);

    const [adminRows] = await connection.query("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
    const adminCount = Number(adminRows[0].total);

    if (Boolean(config.adminEmail) !== Boolean(config.adminPassword)) {
      throw new Error("ADMIN_EMAIL y ADMIN_PASSWORD deben configurarse juntos");
    }

    if (config.adminEmail && config.adminPassword) {
      if (config.adminPassword.length < 12) {
        throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres");
      }

      const [existing] = await connection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [config.adminEmail]);
      if (existing.length === 0) {
        const passwordHash = await bcrypt.hash(config.adminPassword, 12);
        await connection.execute(
          "INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
          [randomUUID(), config.adminEmail, passwordHash],
        );
        console.log(`Administrador inicial creado: ${config.adminEmail}`);
      }
    } else if (adminCount === 0) {
      throw new Error("No existe ningún administrador. Configura ADMIN_EMAIL y ADMIN_PASSWORD para crear el primero");
    }
  } finally {
    await connection.end();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => console.log("Esquema MySQL actualizado correctamente."))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
