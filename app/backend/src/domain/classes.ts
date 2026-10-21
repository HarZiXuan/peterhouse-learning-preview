// Classes, their teachers and their children (CHANGES-TO-MAKE change 4). Only an administrator changes any of this;
// a teacher sees the classes they are in. A child's enrolment in a class for a semester is their review.
import type { ClassChild, ClassDetail, ClassesView, ClassLevel, ClassSummary, LevelProblem, NewChildInput, Pronoun, SessionUser, StaffRef } from "@peterhouse/shared";
import { CLASS_LEVEL_KEYS, birthYearOf, classCapacity, levelForBirthday } from "@peterhouse/shared";
import { many, one, run, tx, type Db } from "../db";
import { HttpError, notFound } from "../http";
import { openText, sealText } from "./records";
import { workspace } from "./workspace";

const LEVEL_ORDER = `array_position(ARRAY[${CLASS_LEVEL_KEYS.map((k) => `'${k}'`).join(",")}]::text[], k.level)`;

const termYear = async (termId: number, c?: Db) => (await one<{ year: number }>("SELECT year FROM terms WHERE id = $1", [termId], c))!.year;

/** A child's level this year: the age they turn this calendar year. There are no exceptions. */
export function childLevel(dateOfBirth: string, year: number): { level: ClassLevel | null; problem: LevelProblem | null } {
  const found = levelForBirthday(dateOfBirth, year);
  return "level" in found ? { level: found.level, problem: null } : { level: null, problem: found.problem };
}

async function summaries(termId: number, filter: { all: boolean; userId: number; classId?: number }, c?: Db): Promise<ClassSummary[]> {
  const year = await termYear(termId, c);
  const rows = await many<{ id: number; name: string; level: ClassLevel }>(
    `SELECT k.id, k.name, k.level FROM classes k
      WHERE k.term_id = $1 AND ($2 OR k.id IN (SELECT class_id FROM class_staff WHERE user_id = $3)) AND ($4::bigint IS NULL OR k.id = $4)
      ORDER BY ${LEVEL_ORDER}, k.name`,
    [termId, filter.all, filter.userId, filter.classId ?? null],
    c,
  );
  const ids = rows.map((r) => r.id);
  const staff = await many<{ class_id: number; role: "lead" | "co"; id: number; name: string }>(
    "SELECT s.class_id, s.role, u.id, u.name FROM class_staff s JOIN users u ON u.id = s.user_id WHERE s.class_id = ANY($1::bigint[]) AND u.active ORDER BY u.name",
    [ids],
    c,
  );
  const counts = await many<{ class_id: number; n: number }>(
    "SELECT r.class_id, count(*)::int AS n FROM reviews r JOIN children ch ON ch.id = r.child_id WHERE r.class_id = ANY($1::bigint[]) AND ch.status = 'active' GROUP BY r.class_id",
    [ids],
    c,
  );
  return rows.map((k) => {
    const mine = staff.filter((s) => s.class_id === k.id);
    const lead = mine.find((s) => s.role === "lead");
    const co = mine.filter((s) => s.role === "co").map((s) => ({ id: s.id, name: s.name }));
    return {
      id: k.id,
      name: k.name,
      level: k.level,
      birthYear: birthYearOf(k.level, year),
      lead: lead ? { id: lead.id, name: lead.name } : null,
      co,
      children: counts.find((n) => n.class_id === k.id)?.n ?? 0,
      capacity: classCapacity(k.level, (lead ? 1 : 0) + co.length),
    };
  });
}

/** The classes this person can see this semester. */
export async function classesFor(user: SessionUser): Promise<ClassSummary[]> {
  const { termId } = await workspace();
  return summaries(termId, { all: user.role === "admin", userId: user.id });
}

type PupilRow = {
  review_id: number;
  class_id: number;
  class_level: ClassLevel;
  status: ClassChild["status"];
  has_report: boolean;
  preferred_name: string;
  chinese_name: string;
  date_of_birth: string;
  pronoun: Pronoun;
  child_status: "active" | "left";
};

const PUPIL_SELECT = `
  SELECT r.id AS review_id, r.class_id, k.level AS class_level, r.status, r.draft IS NOT NULL AS has_report,
         c.preferred_name, c.chinese_name, c.date_of_birth, c.pronoun, c.status AS child_status
    FROM reviews r JOIN children c ON c.id = r.child_id JOIN classes k ON k.id = r.class_id`;

function pupil(p: PupilRow, year: number): ClassChild & { classId: number; classLevel: ClassLevel } {
  const dob = openText(p.date_of_birth, "children.date_of_birth");
  const lv = childLevel(dob, year);
  return {
    reviewId: p.review_id,
    classId: p.class_id,
    classLevel: p.class_level,
    name: openText(p.preferred_name, "children.preferred_name"),
    chineseName: openText(p.chinese_name, "children.chinese_name"),
    dateOfBirth: dob,
    pronoun: p.pronoun,
    level: lv.level,
    levelProblem: lv.problem,
    status: p.status,
    hasReport: p.has_report,
    left: p.child_status === "left",
  };
}

const byName = (a: ClassChild, b: ClassChild) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.reviewId - b.reviewId;

/** Every class, the teachers who can be placed in them, and the children whose level needs a look. */
export async function classesView(): Promise<ClassesView> {
  const { termId } = await workspace();
  const year = await termYear(termId);
  const classes = await summaries(termId, { all: true, userId: 0 });
  const teachers = await many<StaffRef>("SELECT id, name FROM users WHERE role = 'teacher' AND active ORDER BY name");
  const pupils = (await many<PupilRow>(`${PUPIL_SELECT} WHERE r.term_id = $1 AND c.status = 'active'`, [termId])).map((p) => pupil(p, year));
  // A level problem (no birthday, too young, too old) or a birthday that no longer fits the class.
  const flagged = pupils.filter((p) => p.levelProblem || p.level !== p.classLevel).sort(byName);
  return { year, classes, teachers, flagged };
}

export async function classDetail(id: number): Promise<ClassDetail> {
  const { termId } = await workspace();
  const [summary] = await summaries(termId, { all: true, userId: 0, classId: id });
  if (!summary) throw notFound("That class");
  const year = await termYear(termId);
  const pupils = (await many<PupilRow>(`${PUPIL_SELECT} WHERE r.class_id = $1`, [id])).map((p) => pupil(p, year)).sort(byName);
  return { ...summary, year, pupils };
}

function uniqueName(e: unknown): never {
  if ((e as { code?: string }).code === "23505") throw new HttpError(409, "There is already a class with that name this semester.");
  throw e;
}

export async function createClass(name: string, level: ClassLevel): Promise<number> {
  const { termId } = await workspace();
  const clean = name.trim();
  if (!clean) throw new HttpError(400, "Please give the class a name.");
  try {
    return (await one<{ id: number }>("INSERT INTO classes (term_id, name, level) VALUES ($1, $2, $3) RETURNING id", [termId, clean, level]))!.id;
  } catch (e) {
    uniqueName(e);
  }
}

/** Classes of a closed semester are a record and do not change. */
async function openClass(id: number, c?: Db) {
  const k = await one<{ id: number; level: ClassLevel; term_status: string }>(
    "SELECT k.id, k.level, t.status AS term_status FROM classes k JOIN terms t ON t.id = k.term_id WHERE k.id = $1",
    [id],
    c,
  );
  if (!k) throw notFound("That class");
  if (k.term_status !== "open") throw new HttpError(409, "That class belongs to a finished semester.");
  return k;
}

export async function updateClass(id: number, patch: { name?: string; level?: ClassLevel }) {
  const k = await openClass(id);
  if (patch.level && patch.level !== k.level) {
    const n = await one<{ n: number }>("SELECT count(*)::int AS n FROM reviews r JOIN children c ON c.id = r.child_id WHERE r.class_id = $1 AND c.status = 'active'", [id]);
    if (n!.n > 0) throw new HttpError(409, "A class can only change level while it has no children. Move them to another class first.");
  }
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) throw new HttpError(400, "Please give the class a name.");
  try {
    await run("UPDATE classes SET name = COALESCE($1, name), level = COALESCE($2, level) WHERE id = $3", [name ?? null, patch.level ?? null, id]);
  } catch (e) {
    uniqueName(e);
  }
}

export async function deleteClass(id: number) {
  await openClass(id);
  const n = await one<{ n: number }>("SELECT count(*)::int AS n FROM reviews WHERE class_id = $1", [id]);
  if (n!.n > 0) throw new HttpError(409, "Move or remove every child in this class first, including children marked as left.");
  await run("DELETE FROM classes WHERE id = $1", [id]);
}

/** Replaces the class's teachers: one lead (or none) and any number of co-teachers. */
export async function setClassStaff(id: number, leadId: number | null, coIds: number[]) {
  await openClass(id);
  const co = [...new Set(coIds)].filter((x) => x !== leadId);
  const wanted = [...(leadId ? [leadId] : []), ...co];
  const ok = await many<{ id: number }>("SELECT id FROM users WHERE id = ANY($1::bigint[]) AND role = 'teacher' AND active", [wanted]);
  if (ok.length !== wanted.length) throw new HttpError(400, "Only active teacher accounts can be placed in a class.");
  await tx(async (c) => {
    await run("DELETE FROM class_staff WHERE class_id = $1", [id], c);
    if (leadId) await run("INSERT INTO class_staff (class_id, user_id, role) VALUES ($1, $2, 'lead')", [id, leadId], c);
    for (const u of co) await run("INSERT INTO class_staff (class_id, user_id, role) VALUES ($1, $2, 'co')", [id, u], c);
  });
}

/** A child goes only into a class of their own level, worked out from their birthday. */
function checkLevel(dateOfBirth: string, year: number, cls: { name: string; level: ClassLevel }) {
  const found = levelForBirthday(dateOfBirth, year);
  if ("level" in found && found.level === cls.level) return;
  const why =
    "level" in found
      ? `By their birthday this child is ${found.level} in ${year}, so they can only join a ${found.level} class.`
      : found.problem === "no_birthday"
        ? "Please enter their birthday: it sets their level."
        : found.problem === "too_young"
          ? `By their birthday this child is too young for Playgroup in ${year}.`
          : `By their birthday this child is past K2 in ${year}.`;
  throw new HttpError(409, why, "wrong_level");
}

export async function addChild(input: NewChildInput): Promise<{ reviewId: number; childId: number }> {
  const { termId } = await workspace();
  const cls = await one<{ id: number; name: string; level: ClassLevel }>("SELECT id, name, level FROM classes WHERE id = $1 AND term_id = $2", [input.classId, termId]);
  if (!cls) throw new HttpError(400, "Choose one of this semester's classes.");
  const clean = input.name.trim().slice(0, 80);
  if (!clean) throw new HttpError(400, "Please type the child’s name.");
  const chinese = input.chineseName.trim().slice(0, 40);
  checkLevel(input.dateOfBirth, await termYear(termId), cls);
  return tx(async (c) => {
    // photo_consent stays false: reports use the Peterhouse pattern tile with the initial.
    const child = await one<{ id: number }>(
      "INSERT INTO children (preferred_name, legal_name, chinese_name, date_of_birth, pronoun, photo_consent) VALUES ($1, $2, $3, $4, $5, false) RETURNING id",
      [
        sealText(clean, "children.preferred_name"),
        sealText(clean, "children.legal_name"),
        chinese ? sealText(chinese, "children.chinese_name") : "",
        sealText(input.dateOfBirth, "children.date_of_birth"),
        input.pronoun,
      ],
      c,
    );
    // The questions are frozen when the review is first opened, not now.
    const review = await one<{ id: number }>("INSERT INTO reviews (child_id, term_id, class_id, status) VALUES ($1, $2, $3, 'draft') RETURNING id", [child!.id, termId, cls.id], c);
    return { reviewId: review!.id, childId: child!.id };
  });
}

/** This semester's review of a child, for the administrator's changes. */
async function currentReview(reviewId: number) {
  const r = await one<{ id: number; child_id: number; term_id: number; class_id: number; date_of_birth: string; term_status: string }>(
    `SELECT r.id, r.child_id, r.term_id, r.class_id, c.date_of_birth, t.status AS term_status
       FROM reviews r JOIN children c ON c.id = r.child_id JOIN terms t ON t.id = r.term_id WHERE r.id = $1`,
    [reviewId],
  );
  if (!r) throw notFound("This child");
  if (r.term_status !== "open") throw new HttpError(409, "That review belongs to a finished semester.");
  return { ...r, date_of_birth: openText(r.date_of_birth, "children.date_of_birth") };
}

async function termClass(id: number, termId: number) {
  const cls = await one<{ id: number; name: string; level: ClassLevel }>("SELECT id, name, level FROM classes WHERE id = $1 AND term_id = $2", [id, termId]);
  if (!cls) throw new HttpError(400, "Choose one of this semester's classes.");
  return cls;
}

/** Moves a child to another class of their own level. Their ratings, comments, photos and report go with them. */
export async function moveChild(reviewId: number, classId: number) {
  const r = await currentReview(reviewId);
  const cls = await termClass(classId, r.term_id);
  checkLevel(r.date_of_birth, await termYear(r.term_id), cls);
  await run("UPDATE reviews SET class_id = $1 WHERE id = $2", [cls.id, r.id]);
  return { childId: r.child_id };
}

/**
 * Corrects a child's details. A new birthday must still fit their class; when it gives another level, `classId` names
 * the class of that level they move to at the same time.
 */
export async function updateChild(reviewId: number, input: { name: string; chineseName: string; dateOfBirth: string; pronoun: Pronoun }, classId?: number) {
  const r = await currentReview(reviewId);
  const clean = input.name.trim().slice(0, 80);
  if (!clean) throw new HttpError(400, "Please type the child’s name.");
  const chinese = input.chineseName.trim().slice(0, 40);
  const cls = await termClass(classId ?? r.class_id, r.term_id);
  checkLevel(input.dateOfBirth, await termYear(r.term_id), cls);
  await tx(async (c) => {
    await run("UPDATE children SET preferred_name = $1, legal_name = $2, chinese_name = $3, date_of_birth = $4, pronoun = $5 WHERE id = $6", [
      sealText(clean, "children.preferred_name"),
      sealText(clean, "children.legal_name"),
      chinese ? sealText(chinese, "children.chinese_name") : "",
      sealText(input.dateOfBirth, "children.date_of_birth"),
      input.pronoun,
      r.child_id,
    ], c);
    if (cls.id !== r.class_id) await run("UPDATE reviews SET class_id = $1 WHERE id = $2", [cls.id, r.id], c);
  });
  return { childId: r.child_id, moved: cls.id !== r.class_id ? cls.id : null };
}

/** A child who leaves keeps every past review and report; they just stop appearing in the class. */
export async function setChildLeft(reviewId: number, left: boolean) {
  const r = await currentReview(reviewId);
  await run("UPDATE children SET status = $1, left_at = $2 WHERE id = $3", [left ? "left" : "active", left ? new Date().toISOString() : null, r.child_id]);
  return { childId: r.child_id };
}
