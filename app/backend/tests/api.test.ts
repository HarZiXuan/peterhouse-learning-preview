// The real Express app over real HTTP: sign-in, sessions, lockout, CSRF, roles and class access.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeClass, setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
let server: Server;
let base: string;
let classId: number;
let k1Birthday: string;

async function call(method: string, path: string, opts: { body?: unknown; cookie?: string; origin?: string } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.origin ? { origin: opts.origin } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, any>, cookie: setCookie?.split(";")[0], raw: setCookie, headers: res.headers };
}

async function login(email: string, password: string) {
  const r = await call("POST", "/api/auth/login", { body: { email, password } });
  return r;
}

beforeAll(async () => {
  t = await setupTestDb({ LOGIN_RATE_LIMIT: "1000" });
  const U = await import("../src/domain/users");
  const W = await import("../src/domain/workspace");
  await W.workspace();
  await U.createUser(null, null, { email: "admin@x.sg", name: "Ms Admin", role: "admin", password: "temporary admin pass" });
  const lim = await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "temporary lim pass" });
  await U.createUser(null, null, { email: "tan@x.sg", name: "Ms Tan", role: "teacher", password: "temporary tan pass" });
  // Ms Lim teaches K1 Sunflower; Ms Tan is in no class.
  const k1 = await makeClass([lim]);
  classId = k1.id;
  k1Birthday = k1.birthday();
  const { createApp } = await import("../src/app");
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await t.teardown();
});

describe("signing in", () => {
  it("rejects everything without a session", async () => {
    for (const p of ["/api/workspace", "/api/children", "/api/reviews/1", "/api/photos/1", "/api/admin/users"]) {
      expect((await call("GET", p)).status).toBe(401);
    }
  });

  it("sets an HttpOnly, SameSite cookie and never returns the hash", async () => {
    const r = await login("admin@x.sg", "temporary admin pass");
    expect(r.status).toBe(200);
    expect(r.raw).toMatch(/HttpOnly/i);
    expect(r.raw).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(r.json)).not.toMatch(/scrypt|password_hash/);
    // The token itself is not what the database holds.
    const token = r.cookie!.split("=")[1];
    const stored = (await t.pool.query("SELECT token_hash FROM sessions")).rows.map((x) => x.token_hash);
    expect(stored).not.toContain(token);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const a = await login("admin@x.sg", "nope nope nope");
    const b = await login("nobody@x.sg", "nope nope nope");
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.error).toBe(b.json.error);
  });

  it("makes a new person choose their own password before anything else", async () => {
    const r = await login("lim@x.sg", "temporary lim pass");
    expect(r.status).toBe(200);
    expect(r.json.user.mustChangePassword).toBe(true);
    const blocked = await call("GET", "/api/children", { cookie: r.cookie });
    expect(blocked.status).toBe(403);
    expect(blocked.json.code).toBe("must_change_password");
    expect((await call("POST", "/api/auth/change-password", { cookie: r.cookie, body: { current: "temporary lim pass", next: "short" } })).status).toBe(400);
    expect((await call("POST", "/api/auth/change-password", { cookie: r.cookie, body: { current: "temporary lim pass", next: "my own long passphrase" } })).status).toBe(200);
    expect((await call("GET", "/api/children", { cookie: r.cookie })).status).toBe(200);
    expect((await login("lim@x.sg", "temporary lim pass")).status).toBe(401);
  });

  it("locks an account after five wrong passwords", async () => {
    for (let i = 0; i < 5; i++) expect((await login("tan@x.sg", "wrong wrong wrong")).status).toBe(401);
    const locked = await login("tan@x.sg", "temporary tan pass");
    expect(locked.status).toBe(429);
  });

  it("signs out for real", async () => {
    const r = await login("admin@x.sg", "temporary admin pass");
    await call("POST", "/api/auth/change-password", { cookie: r.cookie, body: { current: "temporary admin pass", next: "admin long passphrase" } });
    const again = await login("admin@x.sg", "admin long passphrase");
    expect((await call("GET", "/api/auth/me", { cookie: again.cookie })).status).toBe(200);
    await call("POST", "/api/auth/logout", { cookie: again.cookie });
    expect((await call("GET", "/api/auth/me", { cookie: again.cookie })).status).toBe(401);
  });
});

describe("protection against cross-site requests and abuse", () => {

  it("refuses a state-changing request from another website's page", async () => {
    const r = await login("admin@x.sg", "admin long passphrase");
    const body = { firstName: "X", lastName: "", chineseName: "", pronoun: "she", dateOfBirth: k1Birthday, classId };
    const evil = await call("POST", "/api/admin/children", { cookie: r.cookie, origin: "https://evil.example", body });
    expect(evil.status).toBe(403);
    const ok = await call("POST", "/api/admin/children", { cookie: r.cookie, origin: "http://localhost:3000", body });
    expect(ok.status).toBe(201);
  });

  it("validates input and hides internals", async () => {
    const r = await login("admin@x.sg", "admin long passphrase");
    expect((await call("POST", "/api/admin/children", { cookie: r.cookie, body: { firstName: "X", lastName: "", chineseName: "", pronoun: "robot", dateOfBirth: k1Birthday, classId } })).status).toBe(400);
    expect((await call("GET", "/api/reviews/abc", { cookie: r.cookie })).status).toBe(404);
    const res = await call("GET", "/api/reviews/999999", { cookie: r.cookie });
    expect(res.status).toBe(404);
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("roles and classes", () => {
  it("lets only administrators manage people and read the activity log", async () => {
    const admin = await login("admin@x.sg", "admin long passphrase");
    const teacher = await login("lim@x.sg", "my own long passphrase");
    expect((await call("GET", "/api/admin/users", { cookie: teacher.cookie })).status).toBe(403);
    expect((await call("GET", "/api/admin/audit", { cookie: teacher.cookie })).status).toBe(403);
    expect((await call("GET", "/api/admin/questions", { cookie: teacher.cookie })).status).toBe(403);
    expect((await call("POST", "/api/admin/questions/publish", { cookie: teacher.cookie })).status).toBe(403);
    expect((await call("GET", "/api/admin/approvals", { cookie: teacher.cookie })).status).toBe(403);
    expect((await call("POST", "/api/admin/reviews/1/approve", { cookie: teacher.cookie })).status).toBe(403);
    expect((await call("PUT", "/api/settings", { cookie: teacher.cookie, body: { name: "x", teachers: "", className: "", season: "June", year: 2026 } })).status).toBe(403);
    const users = await call("GET", "/api/admin/users", { cookie: admin.cookie });
    expect(users.status).toBe(200);
    expect(users.json.users.length).toBe(3);
    const audit = await call("GET", "/api/admin/audit", { cookie: admin.cookie });
    expect(audit.json.entries.some((e: { action: string }) => e.action === "login")).toBe(true);
    expect(audit.json.entries.some((e: { action: string }) => e.action === "login.failed")).toBe(true);
  });

  it("keeps a child's data away from a teacher outside the class", async () => {
    const teacher = await login("lim@x.sg", "my own long passphrase");
    const admin = await login("admin@x.sg", "admin long passphrase");
    const child = { firstName: "Private", lastName: "Child", chineseName: "", pronoun: "he", dateOfBirth: k1Birthday, classId };
    // Only the administrator adds children.
    expect((await call("POST", "/api/admin/children", { cookie: teacher.cookie, body: child })).status).toBe(403);
    const created = await call("POST", "/api/admin/children", { cookie: admin.cookie, body: child });
    expect(created.status).toBe(201);
    const id = created.json.reviewId;
    expect((await call("GET", `/api/reviews/${id}`, { cookie: teacher.cookie })).json.childName).toBe("Private Child");

    // Ms Tan: reset her password so she can sign in, but she is in no class.
    const tanId = (await call("GET", "/api/admin/users", { cookie: admin.cookie })).json.users.find((u: { email: string }) => u.email === "tan@x.sg").id;
    await call("POST", `/api/admin/users/${tanId}/reset-password`, { cookie: admin.cookie, body: { password: "tan temp passphrase" } });
    const tan0 = await login("tan@x.sg", "tan temp passphrase");
    await call("POST", "/api/auth/change-password", { cookie: tan0.cookie, body: { current: "tan temp passphrase", next: "tan long passphrase" } });
    const tan = await login("tan@x.sg", "tan long passphrase");
    expect((await call("GET", `/api/reviews/${id}`, { cookie: tan.cookie })).status).toBe(404);
    expect((await call("GET", `/api/reviews/${id}/report`, { cookie: tan.cookie })).status).toBe(404);
    expect((await call("GET", `/api/reviews/${id}/pdf`, { cookie: tan.cookie })).status).toBe(404);
    // Removing a child is for the administrator only, even inside your own class.
    expect((await call("DELETE", `/api/reviews/${id}`, { cookie: tan.cookie })).status).toBe(403);
    expect((await call("DELETE", `/api/reviews/${id}`, { cookie: teacher.cookie })).status).toBe(403);
    expect((await call("GET", "/api/admin/classes", { cookie: teacher.cookie })).status).toBe(403);
    expect((await call("GET", "/api/workspace", { cookie: tan.cookie })).json.classes).toEqual([]);
    expect((await call("GET", "/api/workspace", { cookie: teacher.cookie })).json.classes.map((k: { name: string }) => k.name)).toEqual(["K1 Sunflower"]);
    expect((await call("GET", "/api/children", { cookie: tan.cookie })).json.children).toEqual([]);
  });

  it("lets the administrator edit, unlock and follow teachers", async () => {
    const admin = await login("admin@x.sg", "admin long passphrase");
    const lim = await login("lim@x.sg", "my own long passphrase");
    const users = async () => (await call("GET", "/api/admin/users", { cookie: admin.cookie })).json.users as Record<string, any>[];
    const limRow = (await users()).find((u) => u.email === "lim@x.sg")!;
    // Each teacher's classes, and how many of their children have a written report.
    expect(limRow.classes).toEqual([{ id: classId, name: "K1 Sunflower", role: "lead", subjects: [] }]);
    expect(limRow.progress).toEqual({ written: 0, total: 2 });

    // A teacher's own page: their classes and every report in them, for the administrator only.
    const detail = await call("GET", `/api/admin/users/${limRow.id}/detail`, { cookie: admin.cookie });
    expect(detail.json.user.classes).toEqual(limRow.classes);
    expect(detail.json.reports).toHaveLength(2);
    expect((await call("GET", `/api/admin/users/${limRow.id}/detail`, { cookie: lim.cookie })).status).toBe(403);
    expect((await call("GET", "/api/admin/users/999999/detail", { cookie: admin.cookie })).status).toBe(404);

    // Only the administrator edits accounts; a teacher cannot even rename themselves.
    expect((await call("PATCH", `/api/admin/users/${limRow.id}`, { cookie: lim.cookie, body: { name: "Lim" } })).status).toBe(403);
    expect((await call("PATCH", `/api/admin/users/${limRow.id}`, { cookie: admin.cookie, body: { email: "admin@x.sg" } })).status).toBe(409);
    expect((await call("PATCH", `/api/admin/users/${limRow.id}`, { cookie: admin.cookie, body: { name: "Ms Lim Wei", email: "lim.wei@x.sg" } })).status).toBe(200);
    // A new email signs them out; they sign in with the new one.
    expect((await call("GET", "/api/children", { cookie: lim.cookie })).status).toBe(401);
    expect((await login("lim.wei@x.sg", "my own long passphrase")).status).toBe(200);
    expect((await users()).find((u) => u.id === limRow.id)).toMatchObject({ name: "Ms Lim Wei", email: "lim.wei@x.sg" });
    await call("PATCH", `/api/admin/users/${limRow.id}`, { cookie: admin.cookie, body: { email: "lim@x.sg" } });

    // Five wrong passwords lock an account; the administrator can unlock it without changing the password.
    const tanId = (await users()).find((u) => u.email === "tan@x.sg")!.id;
    for (let i = 0; i < 5; i++) await login("tan@x.sg", "wrong wrong wrong");
    expect((await login("tan@x.sg", "tan long passphrase")).status).toBe(429);
    expect((await users()).find((u) => u.id === tanId)!.lockedUntil).not.toBeNull();
    const limAgain = await login("lim@x.sg", "my own long passphrase");
    expect((await call("POST", `/api/admin/users/${tanId}/unlock`, { cookie: limAgain.cookie })).status).toBe(403);
    expect((await call("POST", `/api/admin/users/${tanId}/unlock`, { cookie: admin.cookie })).status).toBe(200);
    expect((await users()).find((u) => u.id === tanId)!.lockedUntil).toBeNull();
    expect((await login("tan@x.sg", "tan long passphrase")).status).toBe(200);

    // The log records what changed, never the new email.
    const log = (await call("GET", "/api/admin/audit", { cookie: admin.cookie })).json.entries as { action: string; detail: string }[];
    expect(log.some((e) => e.action === "user.unlocked")).toBe(true);
    expect(log.some((e) => e.detail.includes("lim.wei@x.sg"))).toBe(false);
  });

  it("stops a deactivated person at once", async () => {
    const admin = await login("admin@x.sg", "admin long passphrase");
    const teacher = await login("lim@x.sg", "my own long passphrase");
    const id = (await call("GET", "/api/admin/users", { cookie: admin.cookie })).json.users.find((u: { email: string }) => u.email === "lim@x.sg").id;
    expect((await call("PATCH", `/api/admin/users/${id}`, { cookie: admin.cookie, body: { active: false } })).status).toBe(200);
    expect((await call("GET", "/api/children", { cookie: teacher.cookie })).status).toBe(401);
    expect((await login("lim@x.sg", "my own long passphrase")).status).toBe(401);
  });
});
