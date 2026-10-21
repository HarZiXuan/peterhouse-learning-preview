// Applies db/migrations/*.sql in order, once each. Applied files are checksummed: editing one afterwards is an error,
// so history stays honest and every server ends up with the same schema.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type pg from "pg";
import { config } from "./config";

const LOCK_ID = 7_201_026;

export async function migrate(pool: pg.Pool, log: (m: string) => void = console.log): Promise<string[]> {
  const files = fs.readdirSync(config.migrationsDir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    // One migrator at a time, even if two containers start together.
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const done = new Map((await client.query<{ version: string; checksum: string }>("SELECT version, checksum FROM schema_migrations")).rows.map((r) => [r.version, r.checksum]));
    for (const file of files) {
      const sql = fs.readFileSync(path.join(config.migrationsDir, file), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const seen = done.get(file);
      if (seen) {
        if (seen !== checksum) throw new Error(`Migration ${file} was changed after it was applied. Add a new migration instead.`);
        continue;
      }
      log(`applying ${file}`);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [file, checksum]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw new Error(`Migration ${file} failed: ${e instanceof Error ? e.message : e}`);
      }
      applied.push(file);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
  return applied;
}
