import type { SessionUser, UserSummary } from "@peterhouse/shared";
import type { Request } from "express";
import { audit } from "../audit";
import { destroyOtherSessions } from "../auth";
import { many, one, run, tx } from "../db";
import { HttpError } from "../http";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "../passwords";
import { workspace } from "./workspace";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "teacher";
  password_hash: string;
  must_change_password: boolean;
  active: boolean;
  failed_attempts: number;
  locked_until: string | null;
};

export const toSessionUser = (u: Pick<UserRow, "id" | "email" | "name" | "role" | "must_change_password">): SessionUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  mustChangePassword: u.must_change_password,
});

/**
 * Checks an email and password. Every failure looks the same to the caller, takes the same time, and is counted:
 * five wrong passwords lock the account for 15 minutes.
 */
export async function authenticate(req: Request, email: string, password: string): Promise<SessionUser> {
  const user = await one<UserRow>("SELECT * FROM users WHERE email = $1", [email.trim()]);
  const generic = new HttpError(401, "That email or password is not right.");
  if (!user || !user.active) {
    await verifyPassword(password, await dummyHash());
    await audit(req, null, "login.failed", { detail: "unknown or inactive account" });
    throw generic;
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await audit(req, user.id, "login.blocked", { detail: "account locked" });
    throw new HttpError(429, "Too many wrong attempts. Please wait a few minutes and try again.");
  }
  if (!(await verifyPassword(password, user.password_hash))) {
    const fails = user.failed_attempts + 1;
    await run("UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3", [
      fails >= MAX_FAILS ? 0 : fails,
      fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      user.id,
    ]);
    await audit(req, user.id, "login.failed", { detail: `wrong password (${fails})` });
    throw generic;
  }
  await run("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [user.id]);
  await audit(req, user.id, "login");
  return toSessionUser(user);
}

export async function changeOwnPassword(req: Request, user: SessionUser, current: string, next: string, keepToken?: string) {
  const row = await one<UserRow>("SELECT * FROM users WHERE id = $1", [user.id]);
  if (!row || !(await verifyPassword(current, row.password_hash))) throw new HttpError(400, "Your current password is not right.");
  const problem = passwordProblem(next);
  if (problem) throw new HttpError(400, problem);
  if (current === next) throw new HttpError(400, "Choose a password you have not used just now.");
  await run("UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2", [await hashPassword(next), user.id]);
  await destroyOtherSessions(user.id, keepToken);
  await audit(req, user.id, "password.changed");
}

export async function createUser(
  req: Request | null,
  actorId: number | null,
  input: { email: string; name: string; role: "admin" | "teacher"; password: string },
): Promise<number> {
  const problem = passwordProblem(input.password);
  if (problem) throw new HttpError(400, problem);
  const hash = await hashPassword(input.password);
  const { classId } = await workspace();
  try {
    return await tx(async (c) => {
      const row = await one<{ id: number }>(
        "INSERT INTO users (email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, true) RETURNING id",
        [input.email.trim(), input.name.trim(), input.role, hash],
        c,
      );
      if (input.role === "teacher") await run("INSERT INTO class_staff (class_id, user_id, role) VALUES ($1, $2, 'lead')", [classId, row!.id], c);
      await audit(req, actorId, "user.created", { detail: `${input.role} #${row!.id}` }, c);
      return row!.id;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "There is already an account with that email.");
    throw e;
  }
}

export async function listUsers(): Promise<UserSummary[]> {
  const rows = await many<UserRow & { last_login_at: string | null }>("SELECT * FROM users ORDER BY active DESC, name");
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    mustChangePassword: u.must_change_password,
    lastLoginAt: u.last_login_at,
  }));
}

export async function updateUser(req: Request, actor: SessionUser, id: number, patch: { active?: boolean; name?: string; role?: "admin" | "teacher" }) {
  if (id === actor.id && (patch.active === false || (patch.role && patch.role !== actor.role))) {
    throw new HttpError(400, "You cannot deactivate or demote your own account.");
  }
  const target = await one<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  if (!target) throw new HttpError(404, "That person could not be found.");
  await tx(async (c) => {
    await run("UPDATE users SET active = COALESCE($1, active), name = COALESCE($2, name), role = COALESCE($3, role) WHERE id = $4", [
      patch.active ?? null,
      patch.name?.trim() || null,
      patch.role ?? null,
      id,
    ], c);
    if (patch.active === false) await run("DELETE FROM sessions WHERE user_id = $1", [id], c);
    if (patch.role === "teacher" && target.role === "admin") {
      const { classId } = await workspace();
      await run("INSERT INTO class_staff (class_id, user_id, role) VALUES ($1, $2, 'lead') ON CONFLICT DO NOTHING", [classId, id], c);
    }
    await audit(req, actor.id, "user.updated", { detail: `#${id} ${JSON.stringify(patch)}` }, c);
  });
}

/** An administrator sets a temporary password; the person must replace it at their next sign-in. */
export async function resetPassword(req: Request, actor: SessionUser, id: number, password: string) {
  const problem = passwordProblem(password);
  if (problem) throw new HttpError(400, problem);
  const n = await run("UPDATE users SET password_hash = $1, must_change_password = true, failed_attempts = 0, locked_until = NULL WHERE id = $2", [
    await hashPassword(password),
    id,
  ]);
  if (!n) throw new HttpError(404, "That person could not be found.");
  await run("DELETE FROM sessions WHERE user_id = $1", [id]);
  await audit(req, actor.id, "user.password_reset", { detail: `#${id}` });
}
