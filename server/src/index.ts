import { app } from "./app.js";
import { config } from "./config.js";
import { closePool } from "./db.js";

const server = app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`ERP-PULSE escuchando en http://0.0.0.0:${config.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal}: cerrando ERP-PULSE`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

