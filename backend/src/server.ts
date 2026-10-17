import { createApp } from "./app";
import { config } from "./config";
import { pool } from "./db";
import { migrate } from "./migrate";
import { closeBrowser } from "./domain/pdf";
import { workspace } from "./domain/workspace";

// The schema is brought up to date before the first request, so a new release and its migrations ship together.
await migrate(pool);
await workspace();

const server = createApp().listen(config.port, () => console.log(`Peterhouse backend listening on :${config.port} (${config.env})`));

async function shutdown() {
  server.close();
  await closeBrowser();
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
