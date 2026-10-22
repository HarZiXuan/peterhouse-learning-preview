// Subject timetable (CHANGES-TO-MAKE change 7): the school's subject list and each class's fixed weekly lessons.
// The administrator manages everything. A lesson can name only one of its class's teachers (change 12): its lead and
// co-teachers, or a subject teacher of that subject. A subject teacher manages their own lessons of their subjects.
import type { Lesson, LessonInput, SessionUser, StaffRef, Subject, SubjectColor, SubjectsView, TimetableView } from "@peterhouse/shared";
import { SUBJECT_COLORS } from "@peterhouse/shared";
import { many, one, run, tx, type Db } from "../db";
import { HttpError, notFound } from "../http";
import { MAY_TEACH, TAUGHT_BY } from "./staff";
import { workspace } from "./workspace";

type SubjectRow = { id: number; name: string; color: SubjectColor; active: boolean };
const toSubject = (r: SubjectRow): Subject => ({ id: Number(r.id), name: r.name, color: r.color, active: r.active });

export async function listSubjects(): Promise<Subject[]> {
  return (await many<SubjectRow>("SELECT id, name, color, active FROM subjects ORDER BY active DESC, position, name")).map(toSubject);
}

type LessonRow = { id: number; class_id: number; subject_id: number; weekday: number; start: string; end: string; teacher_id: number | null; room: string };
const LESSON_SELECT = `SELECT id, class_id, subject_id, weekday, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS end, teacher_id, room FROM lessons`;
const toLesson = (r: LessonRow): Lesson => ({
  id: Number(r.id),
  classId: Number(r.class_id),
  subjectId: Number(r.subject_id),
  weekday: r.weekday,
  start: r.start,
  end: r.end,
  teacherId: r.teacher_id === null ? null : Number(r.teacher_id),
  room: r.room,
});

export async function lessonsOf(classIds: number[], c?: Db): Promise<Lesson[]> {
  return (await many<LessonRow>(`${LESSON_SELECT} WHERE class_id = ANY($1::bigint[]) ORDER BY weekday, start_time`, [classIds], c)).map(toLesson);
}

// A week that differs from the normal one keeps its own lessons (week_lessons), marked by a row in timetable_weeks.
type WeekLessonRow = LessonRow & { week_of: string };
const WEEK_SELECT = `SELECT id, class_id, subject_id, weekday, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS end, teacher_id, room, to_char(week_of, 'YYYY-MM-DD') AS week_of FROM week_lessons`;
const toWeekLesson = (r: WeekLessonRow): Lesson => ({ ...toLesson(r), weekOf: r.week_of });

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** A week is named by its Monday. */
export function checkMonday(weekOf: string) {
  if (!ISO.test(weekOf) || new Date(`${weekOf}T00:00:00Z`).getUTCDay() !== 1) throw new HttpError(400, "Choose a week that starts on a Monday.");
}

/** The weeks that differ from the normal week and their lessons, for weeks starting between `from` and `to` (inclusive). */
export async function changedWeeksOf(classIds: number[], from: string, to: string, c?: Db) {
  const weeks = (await many<{ class_id: number; week_of: string }>(
    "SELECT class_id, to_char(week_of, 'YYYY-MM-DD') AS week_of FROM timetable_weeks WHERE class_id = ANY($1::bigint[]) AND week_of BETWEEN $2 AND $3 ORDER BY week_of",
    [classIds, from, to],
    c,
  )).map((r) => ({ classId: Number(r.class_id), weekOf: r.week_of }));
  const lessons = (await many<WeekLessonRow>(`${WEEK_SELECT} WHERE class_id = ANY($1::bigint[]) AND week_of BETWEEN $2 AND $3 ORDER BY weekday, start_time`, [classIds, from, to], c)).map(toWeekLesson);
  return { weeks, lessons };
}

// ─── Subjects (administrator) ────────────────────────────────────────────

export async function subjectsView(): Promise<SubjectsView> {
  const inUse = await many<{ subject_id: number; n: number }>("SELECT subject_id, count(*)::int AS n FROM lessons GROUP BY subject_id");
  const inWeeks = await many<{ subject_id: number; n: number }>("SELECT subject_id, count(*)::int AS n FROM week_lessons GROUP BY subject_id");
  for (const r of inWeeks) {
    const was = inUse.find((x) => Number(x.subject_id) === Number(r.subject_id));
    if (was) was.n += r.n;
    else inUse.push(r);
  }
  return {
    subjects: await listSubjects(),
    inUse: Object.fromEntries(inUse.map((r) => [Number(r.subject_id), r.n])),
  };
}

function cleanSubject(input: { name: string; color: string }) {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new HttpError(400, "Give the subject a name.");
  const color = (SUBJECT_COLORS as readonly string[]).includes(input.color) ? input.color : "sky";
  return { name, color };
}

const uniqueSubject = (e: unknown): never => {
  if ((e as { code?: string }).code === "23505") throw new HttpError(409, "There is already a subject with that name.");
  throw e;
};

export async function createSubject(input: { name: string; color: string }): Promise<number> {
  const s = cleanSubject(input);
  try {
    return (await one<{ id: number }>(
      "INSERT INTO subjects (name, color, position) VALUES ($1, $2, (SELECT coalesce(max(position), 0) + 1 FROM subjects)) RETURNING id",
      [s.name, s.color],
    ))!.id;
  } catch (e) {
    return uniqueSubject(e);
  }
}

export async function updateSubject(id: number, input: { name: string; color: string; active: boolean }) {
  const s = cleanSubject(input);
  try {
    const n = await run("UPDATE subjects SET name = $1, color = $2, active = $3 WHERE id = $4", [s.name, s.color, input.active, id]);
    if (!n) throw notFound("That subject");
  } catch (e) {
    uniqueSubject(e);
  }
}

/** A subject still on a timetable is hidden instead, so past timetables keep their wording. */
export async function deleteSubject(id: number) {
  if ((await one("SELECT 1 FROM lessons WHERE subject_id = $1", [id])) || (await one("SELECT 1 FROM week_lessons WHERE subject_id = $1", [id]))) throw new HttpError(409, "This subject is on a timetable. Hide it instead, or remove its lessons first.");
  if (!(await run("DELETE FROM subjects WHERE id = $1", [id]))) throw notFound("That subject");
}

// ─── A class's lessons ───────────────────────────────────────────────────

async function openClass(classId: number, c?: Db) {
  const { termId } = await workspace();
  const k = await one<{ id: number; name: string }>("SELECT id, name FROM classes WHERE id = $1 AND term_id = $2", [classId, termId], c);
  if (!k) throw notFound("That class");
  return k;
}

/**
 * The subjects this teacher may manage in this class: a subject teacher's own subjects there, or for a lead or
 * co-teacher the subjects they already teach. Everything for an administrator.
 */
async function editableFor(user: SessionUser, classId: number, c?: Db): Promise<"all" | { subjectIds: number[] } | null> {
  if (user.role === "admin") return "all";
  const rows = await many<{ subject_id: number }>(
    `SELECT subject_id FROM class_subject_teachers WHERE class_id = $1 AND user_id = $2
     UNION SELECT subject_id FROM lessons l WHERE l.class_id = $1 AND l.teacher_id = $2 AND EXISTS (SELECT 1 FROM class_staff s WHERE s.class_id = $1 AND s.user_id = $2)`,
    [classId, user.id],
    c,
  );
  return rows.length ? { subjectIds: rows.map((r) => Number(r.subject_id)) } : null;
}

/** The classes this person can open a timetable for: theirs as class teacher or subject teacher; all for an administrator. */
/** The classes whose timetable this person sees: a teacher's own classes first, then those they teach a subject in. */
async function timetableClasses(user: SessionUser) {
  const { termId } = await workspace();
  return many<{ id: number; name: string }>(
    `SELECT k.id, k.name FROM classes k WHERE k.term_id = $1
       AND ($2 OR k.id IN ${TAUGHT_BY(3)})
     ORDER BY NOT EXISTS (SELECT 1 FROM class_staff s WHERE s.class_id = k.id AND s.user_id = $3), k.name`,
    [termId, user.role === "admin", user.id],
  );
}

export async function timetableView(user: SessionUser, classId?: number, weekOf?: string): Promise<TimetableView | { classes: { id: number; name: string }[]; classId: null }> {
  const classes = await timetableClasses(user);
  const id = classId && classes.some((k) => k.id === classId) ? classId : classes[0]?.id;
  if (!id) return { classes, classId: null };
  const k = await openClass(id);
  if (weekOf) checkMonday(weekOf);
  const changedWeeks = (await many<{ week_of: string }>("SELECT to_char(week_of, 'YYYY-MM-DD') AS week_of FROM timetable_weeks WHERE class_id = $1 ORDER BY week_of", [id])).map((r) => r.week_of);
  const weekChanged = !!weekOf && changedWeeks.includes(weekOf);
  // A week with its own lessons shows them; any other week shows the normal timetable.
  const lessons = weekChanged ? (await many<WeekLessonRow>(`${WEEK_SELECT} WHERE class_id = $1 AND week_of = $2 ORDER BY weekday, start_time`, [id, weekOf])).map(toWeekLesson) : await lessonsOf([id]);
  const editable = await editableFor(user, id);
  return { classId: id, className: k.name, lessons, weekOf: weekOf ?? null, weekChanged, changedWeeks, subjects: await listSubjects(), teachers: await lessonTeachers(id), editable, classes };
}

/** The administrator gives one week its own lessons, starting as a copy of the normal week. */
export async function startWeek(classId: number, weekOf: string) {
  checkMonday(weekOf);
  await tx(async (c) => {
    await openClass(classId, c);
    if (await one("SELECT 1 FROM timetable_weeks WHERE class_id = $1 AND week_of = $2", [classId, weekOf], c)) return;
    await run("INSERT INTO timetable_weeks (class_id, week_of) VALUES ($1, $2)", [classId, weekOf], c);
    await run(
      "INSERT INTO week_lessons (class_id, week_of, subject_id, weekday, start_time, end_time, teacher_id, room) SELECT class_id, $2, subject_id, weekday, start_time, end_time, teacher_id, room FROM lessons WHERE class_id = $1",
      [classId, weekOf],
      c,
    );
  });
}

/** That week goes back to following the normal timetable. */
export async function resetWeek(classId: number, weekOf: string) {
  checkMonday(weekOf);
  await openClass(classId);
  await run("DELETE FROM timetable_weeks WHERE class_id = $1 AND week_of = $2", [classId, weekOf]);
}

/** Who can be named on this class's lessons: a teacher of the class for the subjects set for them, or any subject when none is set. */
async function lessonTeachers(classId: number): Promise<TimetableView["teachers"]> {
  const rows = await many<StaffRef & { subject_ids: number[] | null }>(
    `SELECT u.id, u.name, array_agg(x.subject_id) FILTER (WHERE x.subject_id IS NOT NULL) AS subject_ids
       FROM (SELECT user_id FROM class_staff WHERE class_id = $1 UNION SELECT user_id FROM class_subject_teachers WHERE class_id = $1) t
       JOIN users u ON u.id = t.user_id AND u.active
       LEFT JOIN class_subject_teachers x ON x.class_id = $1 AND x.user_id = u.id
      GROUP BY u.id, u.name ORDER BY u.name`,
    [classId],
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.name, subjectIds: r.subject_ids ? r.subject_ids.map(Number) : null }));
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Checks a lesson and returns warnings that do not stop it (a teacher booked elsewhere at the same time). */
async function checkLesson(l: LessonInput, ignoreId: number | null, c: Db): Promise<string[]> {
  // The normal week is checked against the normal week; a changed week against that week's own lessons.
  const weekOf = l.weekOf ?? null;
  const T = weekOf ? "week_lessons" : "lessons";
  const W = weekOf ? "AND l.week_of = $6::date" : "";
  const W7 = weekOf ? "AND l.week_of = $7::date" : "";
  if (!Number.isInteger(l.weekday) || l.weekday < 1 || l.weekday > 7) throw new HttpError(400, "Choose a day.");
  if (!TIME.test(l.start) || !TIME.test(l.end)) throw new HttpError(400, "Times look like 09:00.");
  if (Number(l.start.slice(3)) % 5 || Number(l.end.slice(3)) % 5) throw new HttpError(400, "Times go in 5-minute steps, like 9:05 or 9:10.");
  if (l.end <= l.start) throw new HttpError(400, "The lesson ends before it starts.");
  const subject = await one<{ active: boolean }>("SELECT active FROM subjects WHERE id = $1", [l.subjectId], c);
  if (!subject) throw new HttpError(400, "Choose a subject.");
  if (l.teacherId && !(await one("SELECT 1 FROM users WHERE id = $1 AND role = 'teacher' AND active", [l.teacherId], c))) throw new HttpError(400, "Choose an active teacher.");
  if (l.teacherId && !(await one(`SELECT 1 WHERE ${MAY_TEACH("$1::bigint", "$2::bigint", "$3::bigint")}`, [l.classId, l.teacherId, l.subjectId], c))) {
    throw new HttpError(400, "Choose one of this class's teachers. Add a subject teacher to the class on its Classes page first.");
  }
  const clash = await one<{ name: string; start: string; end: string }>(
    `SELECT s.name, to_char(l.start_time, 'FMHH24:MI') AS start, to_char(l.end_time, 'FMHH24:MI') AS end FROM ${T} l JOIN subjects s ON s.id = l.subject_id
      WHERE l.class_id = $1 AND l.weekday = $2 AND l.start_time < $4::time AND l.end_time > $3::time AND l.id <> coalesce($5, 0) ${W}`,
    [l.classId, l.weekday, l.start, l.end, ignoreId, ...(weekOf ? [weekOf] : [])],
    c,
  );
  if (clash) throw new HttpError(409, `It overlaps ${clash.name} (${clash.start}–${clash.end}) in this class.`);
  if (!l.teacherId) return [];
  const busy = await many<{ class_name: string; start: string; end: string }>(
    `SELECT k.name AS class_name, to_char(l.start_time, 'FMHH24:MI') AS start, to_char(l.end_time, 'FMHH24:MI') AS end FROM ${T} l JOIN classes k ON k.id = l.class_id
      WHERE l.teacher_id = $1 AND l.weekday = $2 AND l.start_time < $4::time AND l.end_time > $3::time AND l.class_id <> $5 AND l.id <> coalesce($6, 0) ${W7}
        AND k.term_id = (SELECT term_id FROM classes WHERE id = $5)`,
    [l.teacherId, l.weekday, l.start, l.end, l.classId, ignoreId, ...(weekOf ? [weekOf] : [])],
    c,
  );
  return busy.map((b) => `This teacher is also teaching ${b.class_name} then (${b.start}–${b.end}).`);
}

/** A teacher may only change lessons of a subject they already teach in this class, and only name themselves on them. */
async function checkTeacherMay(user: SessionUser, l: LessonInput, c: Db) {
  if (user.role === "admin") return;
  const may = await editableFor(user, l.classId, c);
  if (!may || may === "all" || !may.subjectIds.includes(l.subjectId) || l.teacherId !== user.id) {
    throw new HttpError(403, "You can change only your own lessons of the subjects you teach in this class. Ask the administrator for anything else.");
  }
}

export async function saveLesson(user: SessionUser, input: LessonInput, id?: number): Promise<{ id: number; warnings: string[] }> {
  return tx(async (c) => {
    await openClass(input.classId, c);
    const weekOf = input.weekOf ?? null;
    if (weekOf) {
      checkMonday(weekOf);
      if (!(await one("SELECT 1 FROM timetable_weeks WHERE class_id = $1 AND week_of = $2", [input.classId, weekOf], c))) throw new HttpError(409, "This week follows the normal timetable. Change the week first.");
    }
    const l = { ...input, weekOf, room: input.room.trim().slice(0, 60) };
    if (id) {
      const was = weekOf ? await one<LessonRow>(`${LESSON_SELECT.replace("FROM lessons", "FROM week_lessons")} WHERE id = $1 AND week_of = $2`, [id, weekOf], c) : await one<LessonRow>(`${LESSON_SELECT} WHERE id = $1`, [id], c);
      if (!was) throw notFound("That lesson");
      if (Number(was.class_id) !== l.classId) throw new HttpError(400, "A lesson stays in its class. Add it to the other class instead.");
      await checkTeacherMay(user, toLesson(was), c);
    }
    await checkTeacherMay(user, l, c);
    const warnings = await checkLesson(l, id ?? null, c);
    const params = [l.classId, l.subjectId, l.weekday, l.start, l.end, l.teacherId, l.room];
    if (weekOf) {
      if (id) {
        await run("UPDATE week_lessons SET subject_id = $2, weekday = $3, start_time = $4, end_time = $5, teacher_id = $6, room = $7 WHERE id = $8 AND class_id = $1", [...params, id], c);
        return { id, warnings };
      }
      const row = await one<{ id: number }>(
        "INSERT INTO week_lessons (class_id, subject_id, weekday, start_time, end_time, teacher_id, room, week_of) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [...params, weekOf],
        c,
      );
      return { id: Number(row!.id), warnings };
    }
    if (id) {
      await run("UPDATE lessons SET class_id = $1, subject_id = $2, weekday = $3, start_time = $4, end_time = $5, teacher_id = $6, room = $7 WHERE id = $8", [...params, id], c);
      return { id, warnings };
    }
    const row = await one<{ id: number }>("INSERT INTO lessons (class_id, subject_id, weekday, start_time, end_time, teacher_id, room) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id", params, c);
    return { id: Number(row!.id), warnings };
  });
}

export async function deleteLesson(user: SessionUser, id: number, weekOf?: string) {
  await tx(async (c) => {
    if (weekOf) checkMonday(weekOf);
    const was = weekOf ? await one<LessonRow>(`${LESSON_SELECT.replace("FROM lessons", "FROM week_lessons")} WHERE id = $1 AND week_of = $2`, [id, weekOf], c) : await one<LessonRow>(`${LESSON_SELECT} WHERE id = $1`, [id], c);
    if (!was) throw notFound("That lesson");
    await openClass(Number(was.class_id), c);
    await checkTeacherMay(user, toLesson(was), c);
    await run(`DELETE FROM ${weekOf ? "week_lessons" : "lessons"} WHERE id = $1`, [id], c);
  });
}

/** Replaces each target class's timetable with a copy of this one's (administrator). */
export async function copyTimetable(fromClassId: number, toClassIds: number[]) {
  await openClass(fromClassId);
  const targets = [...new Set(toClassIds)].filter((x) => x !== fromClassId);
  if (targets.length === 0) throw new HttpError(400, "Choose at least one other class.");
  await tx(async (c) => {
    for (const t of targets) {
      await openClass(t, c);
      await run("DELETE FROM lessons WHERE class_id = $1", [t], c);
      // A teacher who does not teach the other class is left off its copy of the lesson.
      await run(
        `INSERT INTO lessons (class_id, subject_id, weekday, start_time, end_time, teacher_id, room)
         SELECT $1, subject_id, weekday, start_time, end_time, CASE WHEN ${MAY_TEACH("$1::bigint", "l.teacher_id", "l.subject_id")} THEN teacher_id END, room FROM lessons l WHERE class_id = $2`,
        [t, fromClassId],
        c,
      );
    }
  });
  return targets.length;
}
