// Sessions: a random token in an HttpOnly cookie, stored server-side only as its SHA-256.
// A session ends after SESSION_IDLE_HOURS of silence or SESSION_MAX_DAYS in total, whichever comes first.
import crypto from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import type { SessionUser } from "@peterhouse/shared";
import { config } from "./config";
import { one, run } from "./db";
import { HttpError } from "./http";

export const SESSION_COOKIE = "ph_session";

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "";
}

export async function createSession(userId: number, req: Request | null, ttlMs = config.sessionMaxMs): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await run(
    "INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent) VALUES ($1, $2, now() + ($3 || ' milliseconds')::interval, $4, $5)",
    [sha256(token), userId, String(ttlMs), req ? clientIp(req) : null, req?.headers["user-agent"]?.slice(0, 200) ?? null],
  );
  return token;
}

export async function destroySession(token: string | undefined) {
  if (token) await run("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

/** Signing out everywhere, e.g. after a password change. `keep` is the current session. */
export async function destroyOtherSessions(userId: number, keepToken?: string) {
  await run("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [userId, keepToken ? sha256(keepToken) : ""]);
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/",
    maxAge: config.sessionMaxMs,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: config.cookieSecure, path: "/" });
}

type SessionRow = { id: number; email: string; name: string; role: "admin" | "teacher"; must_change_password: boolean; last_seen: string };

export async function userForToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await one<SessionRow>(
    `SELECT u.id, u.email, u.name, u.role, u.must_change_password, s.last_seen
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND u.active AND s.expires_at > now() AND s.last_seen > now() - ($2 || ' milliseconds')::interval`,
    [sha256(token), String(config.sessionIdleMs)],
  );
  if (!row) return null;
  // Slide the idle window, but not on every request.
  if (Date.now() - new Date(row.last_seen).getTime() > 60_000) {
    await run("UPDATE sessions SET last_seen = now() WHERE token_hash = $1", [sha256(token)]);
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, mustChangePassword: row.must_change_password };
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const user = await userForToken(readCookie(req, SESSION_COOKIE));
  if (!user) throw new HttpError(401, "Please log in.", "unauthenticated");
  if (user.mustChangePassword) throw new HttpError(403, "Please choose a new password first.", "must_change_password");
  req.user = user;
  next();
};

/** For the few endpoints that must work before the password has been changed. */
export const requireSession: RequestHandler = async (req, _res, next) => {
  const user = await userForToken(readCookie(req, SESSION_COOKIE));
  if (!user) throw new HttpError(401, "Please log in.", "unauthenticated");
  req.user = user;
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "admin") throw new HttpError(403, "Only an administrator can do that.");
  next();
};

export const currentUser = (req: Request): SessionUser => {
  if (!req.user) throw new HttpError(401, "Please log in.", "unauthenticated");
  return req.user;
};

/** Cross-site request check for anything that changes data: the browser always names the page's origin. */
export const sameOriginOnly: RequestHandler = (req, _res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // server-to-server calls (the frontend's own server) carry no Origin
  const allowed = new Set<string>();
  if (config.publicOrigin) allowed.add(config.publicOrigin.replace(/\/$/, ""));
  if (!config.isProd) {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }
  if (!allowed.has(origin)) throw new HttpError(403, "That request came from somewhere it should not have.");
  next();
};
