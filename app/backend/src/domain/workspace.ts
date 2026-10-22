import type { ChildListItem, ClassLevel, Season, SessionUser } from "@peterhouse/shared";
import { nameForNextLevel, nextLevel } from "@peterhouse/shared";
import { many, one, run, tx } from "../db";
import { HttpError } from "../http";
import { TAUGHT_BY } from "./staff";
import { loadAnswersFor, getReviewForUser, getReviewRow, loadAnswers, type ReviewRow } from "./reviews";
import { areaProgress, childPhotoUrl, readinessGaps } from "@peterhouse/shared";
import { isLead, leadsOf, ownersOf, partRows } from "./parts";

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
      await run("INSERT INTO class_subject_teachers (class_id, user_id, subject_id) SELECT $1, user_id, subject_id FROM class_subject_teachers WHERE class_id = $2", [created!.id, k.id], c);
      // The class keeps its weekly timetable and its calendar entries in the new semester.
      await run(
        "INSERT INTO lessons (class_id, subject_id, weekday, start_time, end_time, teacher_id, room) SELECT $1, subject_id, weekday, start_time, end_time, teacher_id, room FROM lessons WHERE class_id = $2",
        [created!.id, k.id],
        c,
      );
      await run("INSERT INTO calendar_event_classes (event_id, class_id) SELECT event_id, $1 FROM calendar_event_classes WHERE class_id = $2", [created!.id, k.id], c);
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
        await run("UPDATE children SET status = 'left', left_at = now(), graduated_after = $2 WHERE id = $1", [k.child_id, oldTermId], c);
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

/**
 * Undoes "start next semester": the period before the current one is opened again and the current one is removed.
 * Meant for a semester started by mistake, so it refuses once anything has been done in the new one: a rating,
 * a note, a written report, or a child added there. Classes go back to the previous semester's, and children
 * who were marked as left after K2 return to their classes.
 */
export async function reopenPreviousSemester(user: SessionUser): Promise<{ semester: 1 | 2; year: number; restored: number }> {
  if (user.role !== "admin") throw new HttpError(403, "Only an administrator can change the report period.");
  const { termId: nowId } = await workspace();
  return tx(async (c) => {
    const prev = await one<{ id: number; semester: 1 | 2; year: number }>(
      `SELECT p.id, p.semester, p.year FROM terms p, terms n
        WHERE n.id = $1 AND p.status = 'closed' AND (p.year, p.semester) < (n.year, n.semester)
        ORDER BY p.year DESC, p.semester DESC LIMIT 1`,
      [nowId],
      c,
    );
    if (!prev) throw new HttpError(409, "There is no earlier period to go back to.");
    const worked = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM reviews r
        WHERE r.term_id = $1
          AND (r.status NOT IN ('not_started', 'draft') OR r.draft IS NOT NULL
               OR EXISTS (SELECT 1 FROM review_areas a WHERE a.review_id = r.id)
               OR EXISTS (SELECT 1 FROM review_notes x WHERE x.review_id = r.id))`,
      [nowId],
      c,
    );
    if (worked!.n > 0) throw new HttpError(409, `Work has already started in this period (${worked!.n} ${worked!.n === 1 ? "report" : "reports"}), so it cannot be undone.`);
    const added = await one<{ n: number }>(
      "SELECT count(*)::int AS n FROM reviews r WHERE r.term_id = $1 AND NOT EXISTS (SELECT 1 FROM reviews o WHERE o.child_id = r.child_id AND o.term_id = $2)",
      [nowId, prev.id],
      c,
    );
    if (added!.n > 0) throw new HttpError(409, `${added!.n} ${added!.n === 1 ? "child was" : "children were"} added in this period, so it cannot be undone.`);
    // Children marked as left when the new year started.
    const restored = await many<{ id: number }>(
      "UPDATE children SET status = 'active', left_at = NULL, graduated_after = NULL WHERE status = 'left' AND graduated_after = $1 RETURNING id",
      [prev.id],
      c,
    );
    await run("DELETE FROM reviews WHERE term_id = $1", [nowId], c);
    await run("DELETE FROM classes WHERE term_id = $1", [nowId], c);
    await run("DELETE FROM terms WHERE id = $1", [nowId], c);
    await run("UPDATE terms SET status = 'open' WHERE id = $1", [prev.id], c);
    return { semester: prev.semester, year: prev.year, restored: restored.length };
  });
}

/**
 * Makes the given period the one teachers write for. Any period that already exists can be opened, earlier or later,
 * and nothing is deleted: the one that was open closes and keeps its reports. The period right after the latest one
 * is created the first time it is opened. Children who left after K2 are shown as left only from the period after
 * the one they finished in.
 */
export async function openPeriod(user: SessionUser, semester: 1 | 2, year: number): Promise<{ semester: 1 | 2; year: number; created: boolean }> {
  if (user.role !== "admin") throw new HttpError(403, "Only an administrator can change the report period.");
  const find = () => one<{ id: number; status: string }>("SELECT id, status FROM terms WHERE year = $1 AND semester = $2", [year, semester]);
  let target = await find();
  let created = false;
  if (!target) {
    const last = (await one<{ semester: 1 | 2; year: number }>("SELECT semester, year FROM terms ORDER BY year DESC, semester DESC LIMIT 1"))!;
    const first = (await one<{ id: number; semester: 1 | 2; year: number }>("SELECT id, semester, year FROM terms ORDER BY year, semester LIMIT 1"))!;
    const after = last.semester === 1 ? { semester: 2, year: last.year } : { semester: 1, year: last.year + 1 };
    const before = first.semester === 2 ? { semester: 1, year: first.year } : { semester: 2, year: first.year - 1 };
    if (after.semester === semester && after.year === year) {
      const open = await one<{ semester: 1 | 2; year: number }>("SELECT semester, year FROM terms WHERE status = 'open'");
      if (!open || open.semester !== last.semester || open.year !== last.year) await openPeriod(user, last.semester, last.year);
      await startNextSemester(user);
      target = await find();
      created = true;
      return { semester, year, created };
    }
    if (before.semester !== semester || before.year !== year) throw new HttpError(409, "You can open a period that already exists, or the one right before the first or right after the latest.");
    if (before.year !== first.year) throw new HttpError(409, "Going back into an earlier year is not supported, because classes and children would need to move down a level.");
    await createEarlierSemester(first.id, semester, year);
    target = await find();
    created = true;
  }
  if (target!.status === "locked") {
    throw new HttpError(409, "That period is locked.");
  } else if (target!.status !== "open") {
    await tx(async (c) => {
      const later = "(t.year, t.semester) > (g.year, g.semester)";
      await run(`UPDATE children ch SET status = 'left', left_at = now() FROM terms g, terms t WHERE t.id = $1 AND g.id = ch.graduated_after AND ch.status = 'active' AND ${later}`, [target!.id], c);
      await run(`UPDATE children ch SET status = 'active', left_at = NULL FROM terms g, terms t WHERE t.id = $1 AND g.id = ch.graduated_after AND ch.status = 'left' AND NOT ${later}`, [target!.id], c);
      await run("UPDATE terms SET status = CASE WHEN id = $1 THEN 'open' ELSE 'closed' END WHERE status <> 'locked'", [target!.id], c);
    });
  }
  return { semester, year, created };
}

/** Semester 1 of a year that starts with Semester 2: same classes, teachers and children as that semester, each with an empty report. */
async function createEarlierSemester(fromTermId: number, semester: 1 | 2, year: number) {
  await tx(async (c) => {
    const term = await one<{ id: number }>("INSERT INTO terms (semester, year, status) VALUES ($1, $2, 'closed') RETURNING id", [semester, year], c);
    for (const k of await many<{ id: number; name: string; level: ClassLevel }>("SELECT id, name, level FROM classes WHERE term_id = $1 ORDER BY id", [fromTermId], c)) {
      const made = (await one<{ id: number }>("INSERT INTO classes (term_id, name, level) VALUES ($1, $2, $3) RETURNING id", [term!.id, k.name, k.level], c))!;
      await run("INSERT INTO class_staff (class_id, user_id, role) SELECT $1, user_id, role FROM class_staff WHERE class_id = $2", [made.id, k.id], c);
      await run("INSERT INTO class_subject_teachers (class_id, user_id, subject_id) SELECT $1, user_id, subject_id FROM class_subject_teachers WHERE class_id = $2", [made.id, k.id], c);
      await run(
        "INSERT INTO lessons (class_id, subject_id, weekday, start_time, end_time, teacher_id, room) SELECT $1, subject_id, weekday, start_time, end_time, teacher_id, room FROM lessons WHERE class_id = $2",
        [made.id, k.id],
        c,
      );
      await run("INSERT INTO calendar_event_classes (event_id, class_id) SELECT event_id, $1 FROM calendar_event_classes WHERE class_id = $2", [made.id, k.id], c);
      await run(
        "INSERT INTO reviews (child_id, term_id, class_id, status) SELECT r.child_id, $1, $2, 'draft' FROM reviews r JOIN children ch ON ch.id = r.child_id WHERE r.term_id = $3 AND r.class_id = $4 AND (ch.status = 'active' OR ch.graduated_after IS NOT NULL) AND ch.joined_on <= make_date($5::int, $6::int * 6, CASE $6::int WHEN 1 THEN 30 ELSE 31 END)",
        [term!.id, made.id, fromTermId, k.id, year, semester],
        c,
      );
    }
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

/** The children of a semester (the current one unless `pastTermId` names another), each with how far their report is. An earlier semester keeps the children who have left since. */
export async function listChildren(user: SessionUser, pastTermId?: number): Promise<ChildListItem[]> {
  const current = (await workspace()).termId;
  const termId = pastTermId ?? current;
  const rows = await many<{ id: number }>(
    `SELECT r.id FROM reviews r
       JOIN children ch ON ch.id = r.child_id
     WHERE r.term_id = $1 AND ($4 OR ch.status = 'active')
       AND ($2 OR r.class_id IN ${TAUGHT_BY(3)})`,
    [termId, user.role === "admin", user.id, termId !== current],
  );
  const reviews = (await Promise.all(rows.map((x) => getReviewRow(x.id)))).filter((r): r is ReviewRow => !!r);
  reviews.sort((a, b) => a.preferred_name.localeCompare(b.preferred_name, undefined, { sensitivity: "base" }) || a.id - b.id);
  const answersByReview = await loadAnswersFor(reviews.map((r) => ({ id: r.id, rubric: r.rubric })));
  const submitters = await many<{ id: number; name: string }>("SELECT id, name FROM users WHERE id = ANY($1::bigint[])", [[...new Set(reviews.map((r) => r.submitted_by).filter((x): x is number => !!x))]]);
  // The report in parts: who rates each area, which parts are in, and whether this person is the lead who finishes it.
  const classIds = [...new Set(reviews.map((r) => r.class_id))];
  const areaKeys = [...new Set(reviews.flatMap((r) => r.rubric.areas.map((a) => a.key)))];
  const owners = await ownersOf(classIds, areaKeys);
  const parts = await partRows(reviews.map((r) => r.id));
  const leads = await leadsOf(classIds);
  const leadOf = new Map<number, boolean>();
  for (const k of classIds) leadOf.set(k, await isLead(user, k));
  const partsFor = (r: ReviewRow) => {
    const own = owners.get(r.class_id)!;
    const lead = leadOf.get(r.class_id)!;
    const classLead = leads.get(r.class_id)?.id ?? null;
    const done = (key: string) => !!parts.find((p) => p.review_id === r.id && p.area_key === key)?.done_at;
    const partsOpen = !r.taken_over_by && !r.draft && (r.status === "not_started" || r.status === "draft" || r.status === "ready");
    return {
      partsOpen,
      takenOver: !!r.taken_over_by,
      iAmLead: lead,
      myParts: lead ? [] : r.rubric.areas.filter((a) => own[a.key]?.id === user.id).map((a) => ({ area: a.shortName, done: done(a.key) })),
      // Parts another teacher still has to send: what the lead (and the office) is waiting for.
      waitingFor: !partsOpen ? [] : r.rubric.areas.filter((a) => own[a.key] && own[a.key]!.id !== classLead && !done(a.key)).map((a) => ({ area: a.shortName, teacher: own[a.key]!.name })),
    };
  };
  const submitter = new Map(submitters.map((u) => [u.id, u.name]));
  return reviews.map((r) => {
    const answers = answersByReview.get(r.id)!;
    const areas = r.rubric.areas.map((a) => {
      const p = areaProgress(a, answers[a.key]);
      return { name: a.shortName, total: p.total, answered: p.rated + p.notSeen };
    });
    return {
      reviewId: r.id,
      ...partsFor(r),
      name: r.legal_name,
      chineseName: r.chinese_name,
      answered: areas.reduce((n, a) => n + a.answered, 0),
      total: areas.reduce((n, a) => n + a.total, 0),
      hasReport: !!r.draft,
      areas,
      photo: childPhotoUrl(r.child_id, r.photo_at),
      classId: r.class_id,
      className: r.class_name,
      status: r.status,
      submittedBy: r.submitted_by ? (submitter.get(r.submitted_by) ?? null) : null,
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
    };
  });
}

export async function missingAnswers(r: ReviewRow) {
  const { answers } = await loadAnswers(r.id, r.rubric);
  return readinessGaps(r.rubric, answers);
}
