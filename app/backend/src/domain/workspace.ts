import type { ChildListItem, ClassLevel, Season, SessionUser } from "@peterhouse/shared";
import { nameForNextLevel, nextLevel } from "@peterhouse/shared";
import { many, one, run, tx } from "../db";
import { HttpError } from "../http";
import { loadAnswersFor, getReviewForUser, getReviewRow, loadAnswers, type ReviewRow } from "./reviews";
import { areaProgress, readinessGaps } from "@peterhouse/shared";

// One semester (term) is open at a time. Its classes, teachers and children are managed in classes.ts.

export type Workspace = { termId: number };

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
  return { termId: term!.id };
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
 * report stay exactly as they were and the new report can show them beside the new ratings. Reports keep their status
 * (approval is the administrator's decision); the old term is closed.
 *
 * In a new year every child turns a year older, so each class moves up a level with its children and teachers
 * ("K1 Sunflower" becomes "K2 Sunflower"), and K2 children are marked as left: they go on to primary school.
 */
export async function startNextSemester(user: SessionUser): Promise<{ termId: number; semester: 1 | 2; year: number; children: number; graduated: number }> {
  if (user.role !== "admin") throw new HttpError(403, "Only an administrator can start a new semester.");
  const { termId: oldTermId } = await workspace();
  const old = (await one<{ semester: 1 | 2; year: number }>("SELECT semester, year FROM terms WHERE id = $1", [oldTermId]))!;
  const next = old.semester === 1 ? { semester: 2 as const, year: old.year } : { semester: 1 as const, year: old.year + 1 };
  const newYear = next.year !== old.year;
  return tx(async (c) => {
    const exists = await one("SELECT 1 FROM terms WHERE year = $1 AND semester = $2", [next.year, next.semester], c);
    if (exists) throw new HttpError(409, "The next semester has already been started.");
    const term = await one<{ id: number }>("INSERT INTO terms (semester, year, status) VALUES ($1, $2, 'open') RETURNING id", [next.semester, next.year], c);
    const classMap = new Map<number, number>();
    const taken = new Set<string>();
    for (const k of await many<{ id: number; name: string; level: ClassLevel }>("SELECT id, name, level FROM classes WHERE term_id = $1 ORDER BY id", [oldTermId], c)) {
      const level = newYear ? nextLevel(k.level) : k.level;
      if (!level) continue; // a K2 class ends with the year
      let name = newYear ? nameForNextLevel(k.name, k.level, level) : k.name;
      for (let n = 2; taken.has(name); n++) name = `${newYear ? nameForNextLevel(k.name, k.level, level) : k.name} (${n})`;
      taken.add(name);
      const created = await one<{ id: number }>("INSERT INTO classes (term_id, name, level) VALUES ($1, $2, $3) RETURNING id", [term!.id, name, level], c);
      await run("INSERT INTO class_staff (class_id, user_id, role) SELECT $1, user_id, role FROM class_staff WHERE class_id = $2", [created!.id, k.id], c);
      classMap.set(k.id, created!.id);
    }
    // Reports keep the status they had: approval is the administrator's decision, not the calendar's. The semester page
    // says how many are not approved before it closes. Last semester's ratings still show beside the new ones.
    const kids = await many<{ child_id: number; class_id: number }>(
      "SELECT r.child_id, r.class_id FROM reviews r JOIN children ch ON ch.id = r.child_id WHERE r.term_id = $1 AND ch.status = 'active'",
      [oldTermId],
      c,
    );
    let moved = 0;
    let graduated = 0;
    for (const k of kids) {
      const classId = classMap.get(k.class_id);
      if (!classId) {
        await run("UPDATE children SET status = 'left', left_at = now() WHERE id = $1", [k.child_id], c);
        graduated++;
        continue;
      }
      // No questions yet: the review copies the published set the first time it is opened.
      await run("INSERT INTO reviews (child_id, term_id, class_id, status) VALUES ($1, $2, $3, 'draft')", [k.child_id, term!.id, classId], c);
      moved++;
    }
    await run("UPDATE terms SET status = 'closed' WHERE id = $1", [oldTermId], c);
    return { termId: term!.id, ...next, children: moved, graduated };
  });
}

export async function getReportPeriod(): Promise<{ season: Season; year: number }> {
  const { termId } = await workspace();
  const t = (await one<{ semester: number; year: number }>("SELECT semester, year FROM terms WHERE id = $1", [termId]))!;
  return { season: seasonOfSemester(t.semester), year: t.year };
}

/** Deletes a child and every review of theirs, for one added by mistake. A child who leaves is marked as left instead. */
export async function removeChild(user: SessionUser, reviewId: number) {
  if (user.role !== "admin") throw new HttpError(403, "Only an administrator can remove a child.");
  const r = await getReviewForUser(user, reviewId);
  await run("DELETE FROM children WHERE id = $1", [r.child_id]);
}

export async function listChildren(user: SessionUser): Promise<ChildListItem[]> {
  const { termId } = await workspace();
  const rows = await many<{ id: number }>(
    `SELECT r.id FROM reviews r
       JOIN children ch ON ch.id = r.child_id
     WHERE r.term_id = $1 AND ch.status = 'active' AND ($2 OR r.class_id IN (SELECT class_id FROM class_staff WHERE user_id = $3))`,
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
    const areas = r.rubric.areas.map((a) => {
      const p = areaProgress(a, answers[a.key]);
      return { name: a.shortName, total: p.total, answered: p.rated + p.notSeen };
    });
    return {
      reviewId: r.id,
      name: r.preferred_name,
      chineseName: r.chinese_name,
      answered: areas.reduce((n, a) => n + a.answered, 0),
      total: areas.reduce((n, a) => n + a.total, 0),
      hasReport: !!r.draft,
      areas,
      coverPhotoId: coverOf.get(r.id) ?? null,
      classId: r.class_id,
      className: r.class_name,
      status: r.status,
    };
  });
}

export async function missingAnswers(r: ReviewRow) {
  const { answers } = await loadAnswers(r.id, r.rubric);
  return readinessGaps(r.rubric, answers);
}
