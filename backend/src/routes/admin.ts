import { Router } from "express";
import { z } from "zod";
import type { AuditEntry } from "@peterhouse/shared";
import { currentUser, requireAdmin } from "../auth";
import { many } from "../db";
import { idParam, parse } from "../http";
import { createUser, listUsers, resetPassword, updateUser } from "../domain/users";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/users", async (_req, res) => {
  res.json({ users: await listUsers() });
});

const NewUser = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "teacher"]),
  password: z.string().min(1).max(500),
});

adminRouter.post("/users", async (req, res) => {
  const input = parse(NewUser, req.body);
  const id = await createUser(req, currentUser(req).id, input);
  res.status(201).json({ id });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const patch = parse(z.object({ active: z.boolean().optional(), name: z.string().trim().min(1).max(100).optional(), role: z.enum(["admin", "teacher"]).optional() }), req.body);
  await updateUser(req, currentUser(req), idParam(req.params.id), patch);
  res.json({ ok: true });
});

adminRouter.post("/users/:id/reset-password", async (req, res) => {
  const { password } = parse(z.object({ password: z.string().min(1).max(500) }), req.body);
  await resetPassword(req, currentUser(req), idParam(req.params.id), password);
  res.json({ ok: true });
});

adminRouter.get("/audit", async (_req, res) => {
  const rows = await many<{ id: number; at: string; user_name: string | null; action: string; detail: string }>(
    `SELECT a.id, a.at, u.name AS user_name, a.action, a.detail FROM activity_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200`,
  );
  const entries: AuditEntry[] = rows.map((r) => ({ id: r.id, at: r.at, userName: r.user_name, action: r.action, detail: r.detail }));
  res.json({ entries });
});
