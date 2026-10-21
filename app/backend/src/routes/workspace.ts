import { Router } from "express";
import { z } from "zod";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { audit } from "../audit";
import { currentUser, requireAdmin } from "../auth";
import { idParam, parse } from "../http";
import { getSchool, hasAi, setSchool } from "../domain/school";
import { classesFor } from "../domain/classes";
import { waitingCount } from "../domain/approval";
import { getReportPeriod, listChildren, removeChild, setReportPeriod, startNextSemester } from "../domain/workspace";

export const workspaceRouter = Router();

workspaceRouter.get("/workspace", async (req, res) => {
  const user = currentUser(req);
  const info: WorkspaceInfo = { user, school: await getSchool(), period: await getReportPeriod(), hasAi: hasAi(), classes: await classesFor(user), waiting: user.role === "admin" ? await waitingCount() : 0 };
  res.json(info);
});

const Settings = z.object({
  name: z.string().trim().min(1).max(120),
  // Class names and teachers now come from each class; these two only remain for older reports.
  teachers: z.string().trim().max(300).optional(),
  className: z.string().trim().max(80).optional(),
  season: z.enum(["June", "December"]),
  year: z.number().int().min(2001).max(2099),
});

workspaceRouter.put("/settings", requireAdmin, async (req, res) => {
  const s = parse(Settings, req.body);
  const school = await getSchool();
  await setSchool({ ...school, name: s.name, teachers: s.teachers ?? school.teachers, className: s.className ?? school.className });
  await setReportPeriod(s.season, s.year);
  await audit(req, currentUser(req).id, "settings.updated");
  res.json({ ok: true });
});

workspaceRouter.get("/children", async (req, res) => {
  res.json({ children: await listChildren(currentUser(req)) });
});

workspaceRouter.delete("/reviews/:id", requireAdmin, async (req, res) => {
  const user = currentUser(req);
  const id = idParam(req.params.id);
  await removeChild(user, id);
  await audit(req, user.id, "child.removed", { reviewId: id });
  res.json({ ok: true });
});

workspaceRouter.post("/terms/next", requireAdmin, async (req, res) => {
  const user = currentUser(req);
  const next = await startNextSemester(user);
  await audit(req, user.id, "term.started", { detail: `semester ${next.semester} ${next.year}, ${next.children} children${next.graduated ? `, ${next.graduated} left after K2` : ""}` });
  res.status(201).json(next);
});
