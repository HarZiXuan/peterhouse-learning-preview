import { pool } from "../db";
import { migrate } from "../migrate";

try {
  const applied = await migrate(pool);
  console.log(applied.length ? `Applied ${applied.length} migration(s).` : "Database is up to date.");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
