import pg from "pg";
import { config } from "./config";

// timestamptz → ISO string and bigint → number, so rows are plain JSON-friendly values.
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on("error", (err) => console.error("Unexpected database error", err));

export type Db = Pick<pg.PoolClient, "query">;

/** Runs `fn` in one transaction: everything commits together or nothing does. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function one<T extends pg.QueryResultRow>(sql: string, params: unknown[] = [], c: Db = pool): Promise<T | null> {
  const res = await c.query<T>(sql, params);
  return res.rows[0] ?? null;
}

export async function many<T extends pg.QueryResultRow>(sql: string, params: unknown[] = [], c: Db = pool): Promise<T[]> {
  return (await c.query<T>(sql, params)).rows;
}

export async function run(sql: string, params: unknown[] = [], c: Db = pool): Promise<number> {
  return (await c.query(sql, params)).rowCount ?? 0;
}
