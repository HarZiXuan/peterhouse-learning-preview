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
    await audit(req, null, "login.failed", {
      detail: "unknown or inactive account",
    });
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
    await audit(req, user.id, "login.failed", {
      detail: `wrong password (${fails})`,
    });
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
  input: {
    email: string;
    name: string;
    role: "admin" | "teacher";
    password: string;
  },
): Promise<number> {
  const problem = passwordProblem(input.password);
  if (problem) throw new HttpError(400, problem);
  const hash = await hashPassword(input.password);
  try {
    return await tx(async (c) => {
      const row = await one<{ id: number }>(
        "INSERT INTO users (email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, true) RETURNING id",
        [input.email.trim(), input.name.trim(), input.role, hash],
        c,
      );
      await audit(req, actorId, "user.created", { detail: `${input.role} #${row!.id}` }, c);
      return row!.id;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "There is already an account with that email.");
    throw e;
  }
}

type SubjectTag = { name: string; color: string };

export async function listUsers(): Promise<UserSummary[]> {
  const rows = await many<UserRow & { last_login_at: string | null }>("SELECT * FROM users ORDER BY active DESC, name");
  const { termId } = await workspace();
  // This semester's classes, and how many of their children have a written report.
  const classes = await many<{ user_id: number; id: number; name: string; role: "lead" | "co"; written: number; total: number }>(
    `SELECT s.user_id, k.id, k.name, s.role,
            count(r.id) FILTER (WHERE r.draft IS NOT NULL)::int AS written, count(r.id)::int AS total
       FROM class_staff s
       JOIN classes k ON k.id = s.class_id AND k.term_id = $1
       LEFT JOIN reviews r ON r.class_id = k.id AND EXISTS (SELECT 1 FROM children c WHERE c.id = r.child_id AND c.status = 'active')
      GROUP BY s.user_id, k.id, k.name, s.role
      ORDER BY k.name`,
    [termId],
  );
  // Classes a teacher only teaches a subject in (change 12).
  const taught = await many<{ user_id: number; id: number; name: string; subjects: SubjectTag[] }>(
    `SELECT x.user_id, k.id, k.name, json_agg(json_build_object('name', s.name, 'color', s.color) ORDER BY s.position, s.name) AS subjects
       FROM class_subject_teachers x JOIN classes k ON k.id = x.class_id AND k.term_id = $1 JOIN subjects s ON s.id = x.subject_id
      WHERE NOT EXISTS (SELECT 1 FROM class_staff cs WHERE cs.class_id = x.class_id AND cs.user_id = x.user_id)
      GROUP BY x.user_id, k.id, k.name ORDER BY k.name`,
    [termId],
  );
  // The subjects a class's lead or co-teacher is tagged with; none tagged means they teach every subject.
  const tagged = await many<{ user_id: number; class_id: number; subjects: SubjectTag[] }>(
    `SELECT x.user_id, x.class_id, json_agg(json_build_object('name', s.name, 'color', s.color) ORDER BY s.position, s.name) AS subjects
       FROM class_subject_teachers x JOIN classes k ON k.id = x.class_id AND k.term_id = $1 JOIN subjects s ON s.id = x.subject_id
      GROUP BY x.user_id, x.class_id`,
    [termId],
  );
  const subjectsOf = (userId: number, classId: number) => tagged.find((t) => Number(t.user_id) === Number(userId) && Number(t.class_id) === Number(classId))?.subjects ?? [];
  const now = new Date();
  return rows.map((u) => {
    const mine = classes.filter((k) => k.user_id === u.id);
    const subjectClasses = taught.filter((k) => Number(k.user_id) === Number(u.id)).map((k) => ({ id: Number(k.id), name: k.name, role: "subject" as const, subjects: k.subjects }));
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
      mustChangePassword: u.must_change_password,
      lastLoginAt: u.last_login_at,
      lockedUntil: u.locked_until && new Date(u.locked_until) > now ? u.locked_until : null,
      classes: [...mine.map((k) => ({ id: Number(k.id), name: k.name, role: k.role, subjects: subjectsOf(u.id, k.id) })), ...subjectClasses].sort((a, b) => a.name.localeCompare(b.name)),
      progress: { written: mine.reduce((n, k) => n + k.written, 0), total: mine.reduce((n, k) => n + k.total, 0) },
    };
  });
}

export async function updateUser(
  req: Request,
  actor: SessionUser,
  id: number,
  patch: {
    active?: boolean;
    name?: string;
    email?: string;
    role?: "admin" | "teacher";
  },
) {
  if (id === actor.id && (patch.active === false || (patch.role && patch.role !== actor.role))) {
    throw new HttpError(400, "You cannot deactivate or demote your own account.");
  }
  const target = await one<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  if (!target) throw new HttpError(404, "That person could not be found.");
  try {
    await tx(async (c) => {
      await run(
        "UPDATE users SET active = COALESCE($1, active), name = COALESCE($2, name), role = COALESCE($3, role), email = COALESCE($4, email) WHERE id = $5",
        [patch.active ?? null, patch.name?.trim() || null, patch.role ?? null, patch.email?.trim() || null, id],
        c,
      );
      // A new email is a new sign-in name: sign them out everywhere so the old one stops working at once.
      if (patch.email && patch.email.trim().toLowerCase() !== target.email.toLowerCase()) await run("DELETE FROM sessions WHERE user_id = $1", [id], c);
      // Deactivating signs them out and stops their calendar link; a reactivated person gets a new link.
      if (patch.active === false) {
        await run("DELETE FROM sessions WHERE user_id = $1", [id], c);
        await run("UPDATE users SET calendar_token = NULL, calendar_token_hash = NULL WHERE id = $1", [id], c);
      }
      // An administrator sees every class, so they are not listed as one class's teacher. A new teacher is placed on the Classes page.
      if (patch.role === "admin" && target.role === "teacher") await run("DELETE FROM class_staff WHERE user_id = $1", [id], c);
      // The log says what changed, not the new values: an email is personal data.
      await audit(
        req,
        actor.id,
        "user.updated",
        {
          detail: `#${id} ${Object.keys(patch).join(", ")}${patch.active !== undefined ? ` (${patch.active ? "active" : "deactivated"})` : ""}${patch.role ? ` (${patch.role})` : ""}`,
        },
        c,
      );
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "There is already an account with that email.");
    throw e;
  }
}

/** Lets someone locked out by five wrong passwords try again straight away, without changing their password. */
export async function unlockUser(req: Request, actor: SessionUser, id: number) {
  const n = await run("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1", [id]);
  if (!n) throw new HttpError(404, "That person could not be found.");
  await audit(req, actor.id, "user.unlocked", { detail: `#${id}` });
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
