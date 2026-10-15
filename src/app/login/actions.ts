"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, loginConfigured, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

// Slows down password guessing: 8 wrong attempts from one address locks it for 5 minutes.
const fails = new Map<string, { n: number; until: number }>();

const digest = (s: string) => crypto.createHash("sha256").update(s).digest();
const same = (a: string, b: string) => crypto.timingSafeEqual(digest(a), digest(b));

export async function loginAction(_prev: { error: string; user?: string } | undefined, formData: FormData): Promise<{ error: string; user?: string }> {
  if (!loginConfigured()) return { error: "Login is not set up on this server. Ask whoever installed it to set APP_LOGIN_USER and APP_LOGIN_PASSWORD." };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
  const rec = fails.get(ip);
  if (rec && rec.until > Date.now()) return { error: "Too many wrong attempts. Please wait a few minutes and try again." };

  const user = String(formData.get("user") ?? "");
  const pass = String(formData.get("password") ?? "");
  // Both comparisons always run so timing does not reveal which one was wrong.
  const okUser = same(user, process.env.APP_LOGIN_USER!);
  const okPass = same(pass, process.env.APP_LOGIN_PASSWORD!);
  if (!(okUser && okPass)) {
    const n = (rec?.n ?? 0) + 1;
    fails.set(ip, { n, until: n >= 8 ? Date.now() + 5 * 60_000 : 0 });
    return { error: "That username or password is not right.", user };
  }
  fails.delete(ip);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
