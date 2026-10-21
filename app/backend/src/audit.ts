import type { Request } from "express";
import { clientIp } from "./auth";
import { run, type Db } from "./db";
import { pool } from "./db";

/** One line in the activity log. `detail` must never contain a child's name. */
export async function audit(
  req: Request | null,
  userId: number | null,
  action: string,
  opts: { reviewId?: number | null; childId?: number | null; detail?: string } = {},
  c: Db = pool,
) {
  await run(
    "INSERT INTO activity_log (user_id, action, review_id, child_id, detail, ip) VALUES ($1, $2, $3, $4, $5, $6)",
    [userId, action, opts.reviewId ?? null, opts.childId ?? null, opts.detail ?? "", req ? clientIp(req) : null],
    c,
  );
}
