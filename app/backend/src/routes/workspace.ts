import { Router } from "express";
import { z } from "zod";
import { userPhotoUrl, type WorkspaceInfo } from "@peterhouse/shared";
import { one } from "../db";
import { audit } from "../audit";
import { currentUser, requireAdmin } from "../auth";
import { idParam, parse } from "../http";
import { getSchool, hasAi, setSchool } from "../domain/school";
import { classesFor } from "../domain/classes";
import { approvalsView, periodsView, waitingCount } from "../domain/approval";
import { getReportPeriod, listChildren, openPeriod, removeChild, reopenPreviousSemester, setReportPeriod, startNextSemester } from "../domain/workspace";

export const workspaceRouter = Router();

workspaceRouter.get("/workspace", async (req, res) => {
  const user = currentUser(req);
  const mine = await one<{ changed_at: string }>("SELECT changed_at FROM user_photos WHERE user_id = $1", [user.id]);
  const info: WorkspaceInfo = { user, myPhoto: userPhotoUrl(user.id, mine?.changed_at), school: await getSchool(), period: await getReportPeriod(), hasAi: hasAi(), classes: await classesFor(user), waiting: user.role === "admin" ? await waitingCount() : 0 };
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
  const q = parse(z.object({ termId: z.coerce.number().int().positive().optional() }), req.query);
  res.json({ children: await listChildren(currentUser(req), q.termId) });
});

// A teacher's Reports page: the same views as the administrator's, limited to the classes they teach.
workspaceRouter.get("/my/periods", async (req, res) => {
  res.json(await periodsView(currentUser(req).id));
});

workspaceRouter.get("/my/reports", async (req, res) => {
  const q = parse(
    z.object({ status: z.enum(["waiting", "changes", "approved", "not_submitted"]).optional(), classId: z.coerce.number().int().positive().optional(), termId: z.coerce.number().int().positive().optional() }),
    req.query,
  );
  res.json(await approvalsView({ ...q, forUser: currentUser(req).id }));
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

workspaceRouter.post("/terms/previous", requireAdmin, async (req, res) => {
  const user = currentUser(req);
  const prev = await reopenPreviousSemester(user);
  await audit(req, user.id, "term.reopened", { detail: `semester ${prev.semester} ${prev.year}${prev.restored ? `, ${prev.restored} children returned` : ""}` });
  res.json(prev);
});

workspaceRouter.put("/terms/current", requireAdmin, async (req, res) => {
  const user = currentUser(req);
  const body = parse(z.object({ semester: z.union([z.literal(1), z.literal(2)]), year: z.number().int().min(2000).max(2100) }), req.body);
  const out = await openPeriod(user, body.semester, body.year);
  await audit(req, user.id, "term.opened", { detail: `semester ${out.semester} ${out.year}${out.created ? ", created" : ""}` });
  res.json(out);
});
