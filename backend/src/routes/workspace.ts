import { Router } from "express";
import { z } from "zod";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { audit } from "../audit";
import { currentUser, requireAdmin } from "../auth";
import { idParam, parse } from "../http";
import { getSchool, hasAi, setSchool } from "../domain/school";
import { addChild, getReportPeriod, listChildren, removeChild, setReportPeriod, startNextSemester } from "../domain/workspace";

export const workspaceRouter = Router();

workspaceRouter.get("/workspace", async (req, res) => {
  const info: WorkspaceInfo = { user: currentUser(req), school: await getSchool(), period: await getReportPeriod(), hasAi: hasAi() };
  res.json(info);
});

const Settings = z.object({
  name: z.string().trim().min(1).max(120),
  teachers: z.string().trim().max(300),
  className: z.string().trim().max(80),
  season: z.enum(["June", "December"]),
  year: z.number().int().min(2001).max(2099),
});

workspaceRouter.put("/settings", requireAdmin, async (req, res) => {
  const s = parse(Settings, req.body);
  await setSchool({ ...(await getSchool()), name: s.name, teachers: s.teachers, className: s.className });
  await setReportPeriod(s.season, s.year);
  await audit(req, currentUser(req).id, "settings.updated");
  res.json({ ok: true });
});

workspaceRouter.get("/children", async (req, res) => {
  res.json({ children: await listChildren(currentUser(req)) });
});

workspaceRouter.post("/children", async (req, res) => {
  const { name, pronoun, dateOfBirth } = parse(
    z.object({ name: z.string().max(80), pronoun: z.enum(["she", "he", "they"]), dateOfBirth: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/) }),
    req.body,
  );
  const user = currentUser(req);
  const reviewId = await addChild(user, name, pronoun, dateOfBirth);
  await audit(req, user.id, "child.added", { reviewId });
  res.status(201).json({ reviewId });
});

workspaceRouter.delete("/reviews/:id", async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  await removeChild(user, id);
  await audit(req, user.id, "child.removed", { reviewId: id });
  res.json({ ok: true });
});

workspaceRouter.post("/terms/next", requireAdmin, async (req, res) => {
  const user = currentUser(req);
  const next = await startNextSemester(user);
  await audit(req, user.id, "term.started", { detail: `semester ${next.semester} ${next.year}, ${next.children} children` });
  res.status(201).json(next);
});
