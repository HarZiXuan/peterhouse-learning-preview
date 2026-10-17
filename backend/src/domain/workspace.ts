import type { ChildListItem, Pronoun, Season, SessionUser } from "@peterhouse/shared";
import { many, one, run, tx } from "../db";
import { HttpError } from "../http";
import { loadAnswersFor, getReviewForUser, getReviewRow, loadAnswers, type ReviewRow } from "./reviews";
import { reviewRubricNow } from "./reviews";
import { sealText } from "./records";
import { readinessGaps } from "@peterhouse/shared";

// The app is simple on purpose: one list of children, one set of questions per child, one report.
// Behind the scenes that still needs a term and a class, created once the first time the app opens.

export type Workspace = { termId: number; classId: number };

export const seasonOfSemester = (s: number): Season => (s === 1 ? "June" : "December");
export const semesterOfSeason = (s: Season): 1 | 2 => (s === "June" ? 1 : 2);

/** Semester 1 is January to June, Semester 2 is July to December. */
export const currentSemester = (d = new Date()): { semester: 1 | 2; year: number } => ({ semester: d.getMonth() < 6 ? 1 : 2, year: d.getFullYear() });

export async function workspace(): Promise<Workspace> {
  let term = await one<{ id: number }>("SELECT id FROM terms WHERE status = 'open' ORDER BY year DESC, semester DESC LIMIT 1");
  if (!term) {
    const { semester, year } = currentSemester();
    term = await one<{ id: number }>("INSERT INTO terms (semester, year, status) VALUES ($1, $2, 'open') ON CONFLICT (year, semester) DO UPDATE SET status = 'open' RETURNING id", [semester, year]);
  }
  let cls = await one<{ id: number }>("SELECT id FROM classes WHERE term_id = $1 ORDER BY id LIMIT 1", [term!.id]);
  if (!cls) {
    cls = await one<{ id: number }>("INSERT INTO classes (term_id, name, level) VALUES ($1, 'Class', 'K1') ON CONFLICT (term_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id", [term!.id]);
  }
  return { termId: term!.id, classId: cls!.id };
}

export async function setReportPeriod(season: Season, year: number) {
  const { termId } = await workspace();
  try {
    await run("UPDATE terms SET semester = $1, year = $2 WHERE id = $3", [semesterOfSeason(season), year, termId]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "There is already a semester for that period.");
    throw e;
  }
}

/**
 * Finishes the current semester and opens the next one (Semester 1 → Semester 2 of the same year, Semester 2 → Semester 1 of the next).
 *
 * Nothing is overwritten: every child gets a NEW review in the new term, so last semester's ratings, comments and written
 * report stay exactly as they were and the new report can show them beside the new ratings. Reports that were written are
 * marked approved (they are the record of that semester); the old term is closed.
 */
export async function startNextSemester(user: SessionUser): Promise<{ termId: number; semester: 1 | 2; year: number; children: number }> {
  if (user.role !== "admin") throw new HttpError(403, "Only an administrator can start a new semester.");
  const { termId: oldTermId } = await workspace();
  const old = (await one<{ semester: 1 | 2; year: number }>("SELECT semester, year FROM terms WHERE id = $1", [oldTermId]))!;
  const next = old.semester === 1 ? { semester: 2 as const, year: old.year } : { semester: 1 as const, year: old.year + 1 };
  const rubric = JSON.stringify(await reviewRubricNow());
  return tx(async (c) => {
    const exists = await one("SELECT 1 FROM terms WHERE year = $1 AND semester = $2", [next.year, next.semester], c);
    if (exists) throw new HttpError(409, "The next semester has already been started.");
    const term = await one<{ id: number }>("INSERT INTO terms (semester, year, status) VALUES ($1, $2, 'open') RETURNING id", [next.semester, next.year], c);
    const classMap = new Map<number, number>();
    for (const k of await many<{ id: number; name: string; level: string }>("SELECT id, name, level FROM classes WHERE term_id = $1", [oldTermId], c)) {
      const created = await one<{ id: number }>("INSERT INTO classes (term_id, name, level) VALUES ($1, $2, $3) RETURNING id", [term!.id, k.name, k.level], c);
      await run("INSERT INTO class_staff (class_id, user_id, role) SELECT $1, user_id, role FROM class_staff WHERE class_id = $2", [created!.id, k.id], c);
      classMap.set(k.id, created!.id);
    }
    // The finished semester's written reports become its permanent record.
    await run("UPDATE reviews SET status = 'approved', approved_by = $2, approved_at = now() WHERE term_id = $1 AND draft IS NOT NULL AND status <> 'approved'", [oldTermId, user.id], c);
    const kids = await many<{ child_id: number; class_id: number }>(
      "SELECT r.child_id, r.class_id FROM reviews r JOIN children ch ON ch.id = r.child_id WHERE r.term_id = $1 AND ch.status = 'active'",
      [oldTermId],
      c,
    );
    for (const k of kids) {
      await run("INSERT INTO reviews (child_id, term_id, class_id, status, rubric) VALUES ($1, $2, $3, 'draft', $4::jsonb)", [k.child_id, term!.id, classMap.get(k.class_id), rubric], c);
    }
    await run("UPDATE terms SET status = 'closed' WHERE id = $1", [oldTermId], c);
    return { termId: term!.id, ...next, children: kids.length };
  });
}

export async function getReportPeriod(): Promise<{ season: Season; year: number }> {
  const { termId } = await workspace();
  const t = (await one<{ semester: number; year: number }>("SELECT semester, year FROM terms WHERE id = $1", [termId]))!;
  return { season: seasonOfSemester(t.semester), year: t.year };
}

export async function addChild(user: SessionUser, name: string, pronoun: Pronoun, dateOfBirth: string): Promise<number> {
  const { termId, classId } = await workspace();
  if (user.role !== "admin" && !(await one("SELECT 1 FROM class_staff WHERE class_id = $1 AND user_id = $2", [classId, user.id]))) {
    throw new HttpError(403, "You are not in this class.");
  }
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new HttpError(400, "Please type the child’s name.");
  const rubric = JSON.stringify(await reviewRubricNow());
  return tx(async (c) => {
    // photo_consent stays false: reports use the Peterhouse pattern tile with the initial.
    const child = await one<{ id: number }>(
      "INSERT INTO children (preferred_name, legal_name, date_of_birth, pronoun, photo_consent) VALUES ($1, $2, $3, $4, false) RETURNING id",
      [sealText(clean, "children.preferred_name"), sealText(clean, "children.legal_name"), sealText(dateOfBirth || "", "children.date_of_birth"), pronoun],
      c,
    );
    const review = await one<{ id: number }>(
      "INSERT INTO reviews (child_id, term_id, class_id, status, rubric) VALUES ($1, $2, $3, 'draft', $4::jsonb) RETURNING id",
      [child!.id, termId, classId, rubric],
      c,
    );
    return review!.id;
  });
}

export async function removeChild(user: SessionUser, reviewId: number) {
  const r = await getReviewForUser(user, reviewId);
  await run("DELETE FROM children WHERE id = $1", [r.child_id]);
}

export async function listChildren(user: SessionUser): Promise<ChildListItem[]> {
  const { termId } = await workspace();
  const rows = await many<{ id: number }>(
    `SELECT r.id FROM reviews r
     WHERE r.term_id = $1 AND ($2 OR r.class_id IN (SELECT class_id FROM class_staff WHERE user_id = $3))`,
    [termId, user.role === "admin", user.id],
  );
  const reviews = (await Promise.all(rows.map((x) => getReviewRow(x.id)))).filter((r): r is ReviewRow => !!r);
  reviews.sort((a, b) => a.preferred_name.localeCompare(b.preferred_name, undefined, { sensitivity: "base" }) || a.id - b.id);
  const answersByReview = await loadAnswersFor(reviews.map((r) => ({ id: r.id, rubric: r.rubric })));
  const covers = await many<{ review_id: number; id: number }>(
    "SELECT DISTINCT ON (review_id) review_id, id FROM review_photos WHERE review_id = ANY($1::bigint[]) ORDER BY review_id, position, id",
    [reviews.map((r) => r.id)],
  );
  const coverOf = new Map(covers.map((c) => [c.review_id, c.id]));
  return reviews.map((r) => {
    const answers = answersByReview.get(r.id)!;
    const total = r.rubric.areas.reduce((n, a) => n + a.skills.length, 0);
    const answered = r.rubric.areas.reduce((n, a) => n + a.skills.filter((s) => answers[a.key]?.skills[s.key]?.touched).length, 0);
    return {
      reviewId: r.id,
      name: r.preferred_name,
      answered,
      total,
      hasReport: !!r.draft,
      areas: r.rubric.areas.map((a) => ({
        name: a.shortName,
        total: a.skills.length,
        answered: a.skills.filter((s) => answers[a.key]?.skills[s.key]?.touched).length,
      })),
      coverPhotoId: coverOf.get(r.id) ?? null,
    };
  });
}

export async function missingAnswers(r: ReviewRow) {
  const { answers } = await loadAnswers(r.id, r.rubric);
  return readinessGaps(r.rubric, answers);
}
