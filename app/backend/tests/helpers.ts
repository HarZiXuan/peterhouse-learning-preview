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
    MIGRATIONS_DIR: path.resolve(__dirname, "../db/migrations"),
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

/**
 * A class this semester with these teachers (the first as lead), and a quick way to put a child in it. A child can only
 * join a class of their own level, so `birthday("05-06")` gives a date in the right birth year for this semester.
 */
export async function makeClass(teacherIds: number[], name = "K1 Sunflower", level: "PG" | "N1" | "N2" | "K1" | "K2" = "K1") {
  const C = await import("../src/domain/classes");
  const W = await import("../src/domain/workspace");
  const { CLASS_LEVELS } = await import("@peterhouse/shared");
  const id = await C.createClass(name, level);
  await C.setClassStaff(id, teacherIds[0] ?? null, teacherIds.slice(1));
  const year = (await W.getReportPeriod()).year;
  const birthday = (monthDay = "06-15") => `${year - CLASS_LEVELS.find((l) => l.key === level)!.turns}-${monthDay}`;
  const add = async (childName: string, pronoun: "she" | "he", dateOfBirth = birthday(), chineseName = "", lastName = "") =>
    (await C.addChild({ firstName: childName, lastName, chineseName, pronoun, dateOfBirth, classId: id })).reviewId;
  return { id, add, birthday };
}
