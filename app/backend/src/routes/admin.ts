import { Router } from "express";
import { z } from "zod";
import type { AuditEntry } from "@peterhouse/shared";
import { CLASS_LEVEL_KEYS, type ClassLevel } from "@peterhouse/shared";
import { audit } from "../audit";
import { currentUser, requireAdmin } from "../auth";
import { many } from "../db";
import { HttpError, idParam, parse } from "../http";
import { createUser, listUsers, resetPassword, unlockUser, updateUser } from "../domain/users";
import { approvalExtras, approvalsView, approve, periodsView, requestChanges, takeOver } from "../domain/approval";
import { childProfile, updateChildInfo } from "../domain/children";
import { addChild, classDetail, classesView, createClass, deleteClass, moveChild, setAreaTeacher, setChildLeft, setClassStaff, setSubjectTeacher, updateChild, updateClass } from "../domain/classes";
import {
  addQuestion,
  setQuestionLevels,
  discardDraft,
  moveQuestion,
  publishQuestions,
  questionBank,
  restoreQuestion,
  retireQuestion,
  rewordQuestion,
  updateDomainExtras,
} from "../domain/questions";

export const adminRouter = Router();

const LevelKey = z.enum(CLASS_LEVEL_KEYS as [ClassLevel, ...ClassLevel[]]);
adminRouter.use(requireAdmin);

adminRouter.get("/users", async (_req, res) => {
  res.json({ users: await listUsers() });
});

/** One teacher: their classes and subjects, and every report in those classes this semester, wherever it has got to. */
adminRouter.get("/users/:id/detail", async (req, res) => {
  const id = idParam(req.params.id);
  const user = (await listUsers()).find((u) => u.id === id);
  if (!user) throw new HttpError(404, "There is no such person.");
  const views = await Promise.all((["waiting", "changes", "approved", "not_submitted"] as const).map((status) => approvalsView({ status, teacherId: id })));
  res.json({ user, reports: views.flatMap((v) => v.items) });
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
  const patch = parse(
    z.object({ active: z.boolean().optional(), name: z.string().trim().min(1).max(100).optional(), email: z.string().trim().email().max(200).optional(), role: z.enum(["admin", "teacher"]).optional() }),
    req.body,
  );
  await updateUser(req, currentUser(req), idParam(req.params.id), patch);
  res.json({ ok: true });
});

adminRouter.post("/users/:id/unlock", async (req, res) => {
  await unlockUser(req, currentUser(req), idParam(req.params.id));
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

// ─── Questions (Teacher Questions v0.3, section 4) ─────────────────────────

adminRouter.get("/questions", async (_req, res) => {
  res.json(await questionBank());
});

adminRouter.post("/questions", async (req, res) => {
  const { areaKey, text, levels } = parse(z.object({ areaKey: z.string().max(40), text: z.string().max(400), levels: z.array(LevelKey).max(5).optional() }), req.body);
  res.status(201).json({ key: await addQuestion(req, currentUser(req), areaKey, text, levels) });
});

adminRouter.put("/questions/:key/levels", async (req, res) => {
  const { levels } = parse(z.object({ levels: z.array(LevelKey).max(5) }), req.body);
  await setQuestionLevels(req, currentUser(req), req.params.key, levels);
  res.json({ ok: true });
});

adminRouter.put("/questions/:key", async (req, res) => {
  const { text, sameSkill } = parse(z.object({ text: z.string().max(400), sameSkill: z.boolean() }), req.body);
  res.json({ key: await rewordQuestion(req, currentUser(req), req.params.key, text, sameSkill) });
});

adminRouter.post("/questions/:key/retire", async (req, res) => {
  await retireQuestion(req, currentUser(req), req.params.key);
  res.json({ ok: true });
});

adminRouter.post("/questions/:key/restore", async (req, res) => {
  await restoreQuestion(req, currentUser(req), req.params.key);
  res.json({ ok: true });
});

adminRouter.post("/questions/:key/move", async (req, res) => {
  const { direction, level } = parse(z.object({ direction: z.enum(["up", "down"]), level: z.enum(CLASS_LEVEL_KEYS as [ClassLevel, ...ClassLevel[]]).optional() }), req.body);
  await moveQuestion(req, currentUser(req), req.params.key, direction, level);
  res.json({ ok: true });
});

adminRouter.put("/domains/:key", async (req, res) => {
  const patch = parse(z.object({ loveText: z.string().max(400).optional(), homeIdeas: z.array(z.string().max(300)).max(30).optional() }), req.body);
  await updateDomainExtras(req, currentUser(req), req.params.key, patch);
  res.json({ ok: true });
});

adminRouter.post("/questions/discard", async (req, res) => {
  await discardDraft(req, currentUser(req));
  res.json({ ok: true });
});

adminRouter.post("/questions/publish", async (req, res) => {
  res.json(await publishQuestions(req, currentUser(req)));
});

// ─── Classes and children (CHANGES-TO-MAKE change 4) ──────────────────────

const Birthday = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/);

adminRouter.get("/classes", async (_req, res) => {
  res.json(await classesView());
});

adminRouter.post("/classes", async (req, res) => {
  const { name, level } = parse(z.object({ name: z.string().max(80), level: LevelKey }), req.body);
  const id = await createClass(name, level);
  await audit(req, currentUser(req).id, "class.created", { detail: `#${id} ${level}` });
  res.status(201).json({ id });
});

adminRouter.get("/classes/:id", async (req, res) => {
  res.json(await classDetail(idParam(req.params.id)));
});

adminRouter.patch("/classes/:id", async (req, res) => {
  const id = idParam(req.params.id);
  const patch = parse(z.object({ name: z.string().max(80).optional(), level: LevelKey.optional() }), req.body);
  await updateClass(id, patch);
  await audit(req, currentUser(req).id, "class.updated", { detail: `#${id} ${JSON.stringify(patch)}` });
  res.json({ ok: true });
});

adminRouter.delete("/classes/:id", async (req, res) => {
  const id = idParam(req.params.id);
  await deleteClass(id);
  await audit(req, currentUser(req).id, "class.removed", { detail: `#${id}` });
  res.json({ ok: true });
});

adminRouter.put("/classes/:id/staff", async (req, res) => {
  const id = idParam(req.params.id);
  const { leadId, coIds } = parse(z.object({ leadId: z.number().int().positive().nullable(), coIds: z.array(z.number().int().positive()).max(20) }), req.body);
  await setClassStaff(id, leadId, coIds);
  await audit(req, currentUser(req).id, "class.teachers_set", { detail: `#${id} lead ${leadId ?? "none"}, co ${coIds.join(",") || "none"}` });
  res.json({ ok: true });
});

// A subject teacher of a class and the subjects they teach there (change 12). No subjects takes them off the class.
adminRouter.put("/classes/:id/area-teachers/:area", async (req, res) => {
  const id = idParam(req.params.id);
  const { userId } = parse(z.object({ userId: z.number().int().positive().nullable() }), req.body);
  await setAreaTeacher(id, req.params.area, userId);
  await audit(req, currentUser(req).id, "class.area_teacher", { detail: `#${id} ${req.params.area}` });
  res.json({ ok: true });
});

adminRouter.put("/classes/:id/subject-teachers/:userId", async (req, res) => {
  const id = idParam(req.params.id);
  const userId = idParam(req.params.userId);
  const { subjectIds } = parse(z.object({ subjectIds: z.array(z.number().int().positive()).max(20) }), req.body);
  await setSubjectTeacher(id, userId, subjectIds);
  await audit(req, currentUser(req).id, "class.subject_teacher_set", { detail: `#${id} teacher #${userId} subjects ${subjectIds.join(",") || "none"}` });
  res.json({ ok: true });
});

const ChildDetails = z.object({
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  chineseName: z.string().max(40),
  pronoun: z.enum(["she", "he"]),
  dateOfBirth: Birthday,
});

adminRouter.post("/children", async (req, res) => {
  const input = parse(
    ChildDetails.extend({
      classId: z.number().int().positive(),
      joinedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      guardians: z.array(z.object({ name: z.string().max(100), relationship: z.string().max(40), phone: z.string().max(40), email: z.string().max(200) })).max(6).optional(),
      notes: z.string().max(4000).optional(),
    }),
    req.body,
  );
  const out = await addChild(input);
  await audit(req, currentUser(req).id, "child.added", { reviewId: out.reviewId, childId: out.childId, detail: `class #${input.classId}` });
  res.status(201).json({ reviewId: out.reviewId });
});

adminRouter.get("/children/:id", async (req, res) => {
  const id = idParam(req.params.id);
  const profile = await childProfile(id);
  await audit(req, currentUser(req).id, "child.profile_viewed", { childId: id });
  res.json(profile);
});

adminRouter.put("/children/:id/info", async (req, res) => {
  const id = idParam(req.params.id);
  const info = parse(
    z.object({
      joinedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      guardians: z.array(z.object({ name: z.string().max(100), relationship: z.string().max(40), phone: z.string().max(40), email: z.string().max(200) })).max(6),
      notes: z.string().max(4000),
    }),
    req.body,
  );
  await updateChildInfo(id, info);
  // The details themselves name parents and phone numbers, so they stay out of the log.
  await audit(req, currentUser(req).id, "child.info_updated", { childId: id });
  res.json({ ok: true });
});

adminRouter.put("/reviews/:id/child", async (req, res) => {
  const id = idParam(req.params.id);
  const { classId, ...details } = parse(ChildDetails.extend({ classId: z.number().int().positive().optional() }), req.body);
  const out = await updateChild(id, details, classId);
  await audit(req, currentUser(req).id, "child.updated", { reviewId: id, childId: out.childId, detail: out.moved ? `moved to class #${out.moved} for the new birthday` : "" });
  res.json({ ok: true });
});

adminRouter.post("/reviews/:id/move", async (req, res) => {
  const id = idParam(req.params.id);
  const { classId } = parse(z.object({ classId: z.number().int().positive() }), req.body);
  const out = await moveChild(id, classId);
  await audit(req, currentUser(req).id, "child.moved", { reviewId: id, childId: out.childId, detail: `to class #${classId}` });
  res.json({ ok: true });
});

adminRouter.post("/reviews/:id/left", async (req, res) => {
  const id = idParam(req.params.id);
  const { left } = parse(z.object({ left: z.boolean() }), req.body);
  const out = await setChildLeft(id, left);
  await audit(req, currentUser(req).id, left ? "child.left" : "child.returned", { reviewId: id, childId: out.childId });
  res.json({ ok: true });
});

// ─── Approvals: the administrator reviews what teachers submit (changes 1 and 3) ──

adminRouter.get("/approvals", async (req, res) => {
  const q = parse(
    z.object({ status: z.enum(["waiting", "changes", "approved", "not_submitted"]).optional(), classId: z.coerce.number().int().positive().optional(), teacherId: z.coerce.number().int().positive().optional(), termId: z.coerce.number().int().positive().optional() }),
    req.query,
  );
  res.json(await approvalsView(q));
});

adminRouter.get("/periods", async (_req, res) => {
  res.json(await periodsView());
});

adminRouter.get("/approvals/:id", async (req, res) => {
  res.json(await approvalExtras(idParam(req.params.id)));
});

adminRouter.post("/reviews/:id/approve", async (req, res) => {
  const id = idParam(req.params.id);
  const out = await approve(currentUser(req), id);
  await audit(req, currentUser(req).id, "report.approved", { reviewId: id, childId: out.childId });
  res.json({ ok: true });
});

adminRouter.post("/reviews/:id/request-changes", async (req, res) => {
  const id = idParam(req.params.id);
  const { note } = parse(z.object({ note: z.string().max(1000) }), req.body);
  const out = await requestChanges(currentUser(req), id, note);
  // The note itself may name the child, so it stays out of the log.
  await audit(req, currentUser(req).id, "report.changes_requested", { reviewId: id, childId: out.childId });
  res.json({ ok: true });
});

adminRouter.post("/reviews/:id/take-over", async (req, res) => {
  const id = idParam(req.params.id);
  const out = await takeOver(currentUser(req), id);
  await audit(req, currentUser(req).id, "report.taken_over", { reviewId: id, childId: out.childId });
  res.json({ ok: true });
});
