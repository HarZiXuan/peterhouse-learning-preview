// Each test file gets its own throwaway Postgres database, migrated from the real db/migrations folder.
// Needs the local database running: `npm run db:up`.
import crypto from "node:crypto";
import path from "node:path";
import pg from "pg";

const ADMIN_URL = process.env.TEST_ADMIN_URL ?? "postgres://peterhouse:peterhouse@127.0.0.1:5432/postgres";

export async function setupTestDb(env: Record<string, string> = {}) {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const name = `ph_test_${crypto.randomBytes(5).toString("hex")}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: url.toString(),
    MIGRATIONS_DIR: path.resolve(__dirname, "../../db/migrations"),
    SKILL_DIR: path.resolve(__dirname, "../skills"),
    ...env,
  });
  const { pool } = await import("../src/db");
  const { migrate } = await import("../src/migrate");
  await migrate(pool, () => {});
  return {
    pool,
    async teardown() {
      await pool.end();
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
