import app from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";

const start = async () => {
  await migrate();

  const server = app.listen(config.port, () => {
    console.log(`BZ Creators API escuchando en http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch((error) => {
  console.error("No se pudo iniciar la aplicación:", error.message);
  process.exit(1);
});
