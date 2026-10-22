import { Router } from "express";
import { z } from "zod";
import { SUBJECT_COLORS } from "@peterhouse/shared";
import { audit } from "../audit";
import { currentUser, requireAdmin } from "../auth";
import { idParam, parse } from "../http";
import { copyTimetable, createSubject, deleteLesson, deleteSubject, resetWeek, saveLesson, startWeek, subjectsView, timetableView, updateSubject } from "../domain/timetable";

export const timetableRouter = Router();

timetableRouter.get("/timetable", async (req, res) => {
  const { classId, week } = parse(z.object({ classId: z.coerce.number().int().positive().optional(), week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query);
  res.json(await timetableView(currentUser(req), classId, week));
});

const Time = z.string().regex(/^\d{2}:\d{2}$/);
const LessonBody = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  weekday: z.number().int(),
  start: Time,
  end: Time,
  teacherId: z.number().int().positive().nullable(),
  room: z.string().max(100),
  /** The Monday of a changed week; absent for the normal timetable. */
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

// Teachers may call these too: the domain lets a subject teacher change only their own lessons.
timetableRouter.post("/timetable/lessons", async (req, res) => {
  const input = parse(LessonBody, req.body);
  const out = await saveLesson(currentUser(req), input);
  await audit(req, currentUser(req).id, "timetable.lesson_added", { detail: `#${out.id} class #${input.classId}` });
  res.status(201).json(out);
});

timetableRouter.put("/timetable/lessons/:id", async (req, res) => {
  const id = idParam(req.params.id);
  const input = parse(LessonBody, req.body);
  const out = await saveLesson(currentUser(req), input, id);
  await audit(req, currentUser(req).id, "timetable.lesson_changed", { detail: `#${id} class #${input.classId}` });
  res.json(out);
});

timetableRouter.delete("/timetable/lessons/:id", async (req, res) => {
  const id = idParam(req.params.id);
  const { week } = parse(z.object({ week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query);
  await deleteLesson(currentUser(req), id, week);
  await audit(req, currentUser(req).id, "timetable.lesson_removed", { detail: `#${id}` });
  res.json({ ok: true });
});

const WeekBody = z.object({ classId: z.number().int().positive(), weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

timetableRouter.post("/admin/timetable/weeks", requireAdmin, async (req, res) => {
  const { classId, weekOf } = parse(WeekBody, req.body);
  await startWeek(classId, weekOf);
  await audit(req, currentUser(req).id, "timetable.week_changed", { detail: `class #${classId} week of ${weekOf}` });
  res.status(201).json({ ok: true });
});

timetableRouter.delete("/admin/timetable/weeks", requireAdmin, async (req, res) => {
  const { classId, weekOf } = parse(z.object({ classId: z.coerce.number().int().positive(), weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), req.query);
  await resetWeek(classId, weekOf);
  await audit(req, currentUser(req).id, "timetable.week_reset", { detail: `class #${classId} week of ${weekOf}` });
  res.json({ ok: true });
});

timetableRouter.post("/admin/classes/:id/timetable/copy", requireAdmin, async (req, res) => {
  const id = idParam(req.params.id);
  const { toClassIds } = parse(z.object({ toClassIds: z.array(z.number().int().positive()).max(50) }), req.body);
  const n = await copyTimetable(id, toClassIds);
  await audit(req, currentUser(req).id, "timetable.copied", { detail: `class #${id} to ${toClassIds.join(", ")}` });
  res.json({ ok: true, classes: n });
});

const SubjectBody = z.object({ name: z.string().max(100), color: z.enum(SUBJECT_COLORS) });

timetableRouter.get("/admin/subjects", requireAdmin, async (_req, res) => {
  res.json(await subjectsView());
});

timetableRouter.post("/admin/subjects", requireAdmin, async (req, res) => {
  const id = await createSubject(parse(SubjectBody, req.body));
  await audit(req, currentUser(req).id, "subject.added", { detail: `#${id}` });
  res.status(201).json({ id });
});

timetableRouter.put("/admin/subjects/:id", requireAdmin, async (req, res) => {
  const id = idParam(req.params.id);
  await updateSubject(id, parse(SubjectBody.extend({ active: z.boolean() }), req.body));
  await audit(req, currentUser(req).id, "subject.changed", { detail: `#${id}` });
  res.json({ ok: true });
});

timetableRouter.delete("/admin/subjects/:id", requireAdmin, async (req, res) => {
  const id = idParam(req.params.id);
  await deleteSubject(id);
  await audit(req, currentUser(req).id, "subject.removed", { detail: `#${id}` });
  res.json({ ok: true });
});
