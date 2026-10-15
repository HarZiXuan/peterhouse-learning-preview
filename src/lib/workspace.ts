import { listPhotos } from "./photos";
import { db, nowIso } from "./db";
import { loadAnswers, reviewRubric, getReviewRow, type ReviewRow } from "./reviews";
import { readinessGaps } from "./calc";
import type { Pronoun, User } from "./types";

// The app is simple on purpose: one list of children, one set of questions
// per child, one report. Behind the scenes that still needs a term, a class
// and a user (the writing engine records them), so they are created once,
// invisibly, the first time the app opens.

export type Workspace = { user: User; termId: number; classId: number };

let cached: Workspace | null = null;

export function workspace(): Workspace {
  if (cached && db().prepare("SELECT 1 FROM users WHERE id = ?").get(cached.user.id)) return cached;
  const d = db();
  let user = d.prepare("SELECT id, email, name, role, active, must_change_password FROM users ORDER BY id LIMIT 1").get() as User | undefined;
  if (!user) {
    d.prepare("INSERT INTO users (email, name, role, password_hash) VALUES ('teacher@local', 'Teacher', 'admin', '-')").run();
    user = d.prepare("SELECT id, email, name, role, active, must_change_password FROM users ORDER BY id LIMIT 1").get() as User;
  }
  let term = d.prepare("SELECT id FROM terms ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  if (!term) {
    const now = new Date();
    const season = now.getMonth() < 8 ? "June" : "December";
    d.prepare("INSERT INTO terms (season, year, status) VALUES (?, ?, 'open')").run(season, now.getFullYear());
    term = d.prepare("SELECT id FROM terms ORDER BY id LIMIT 1").get() as { id: number };
  }
  let cls = d.prepare("SELECT id FROM classes ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  if (!cls) {
    d.prepare("INSERT INTO classes (term_id, name, level) VALUES (?, 'Class', 'K1')").run(term.id);
    cls = d.prepare("SELECT id FROM classes ORDER BY id LIMIT 1").get() as { id: number };
  }
  cached = { user, termId: term.id, classId: cls.id };
  return cached;
}

/** Which half of the year the reports are for, e.g. "June 2026". */
export function setReportPeriod(season: "June" | "December", year: number) {
  const { termId } = workspace();
  db().prepare("UPDATE terms SET season = ?, year = ? WHERE id = ?").run(season, year, termId);
}

export function getReportPeriod() {
  const { termId } = workspace();
  return db().prepare("SELECT season, year FROM terms WHERE id = ?").get(termId) as { season: "June" | "December"; year: number };
}

export function addChild(name: string, pronoun: Pronoun, dateOfBirth: string): number {
  const { termId, classId } = workspace();
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Please type the child’s name.");
  const d = db();
  return d.transaction(() => {
    // photo_consent stays 0: reports use the Peterhouse pattern tile with the initial.
    const res = d
      .prepare("INSERT INTO children (preferred_name, legal_name, date_of_birth, pronoun, photo_consent) VALUES (?, ?, ?, ?, 0)")
      .run(clean, clean, dateOfBirth || "", pronoun);
    const rubric = JSON.stringify(reviewRubricNow());
    const rev = d
      .prepare("INSERT INTO reviews (child_id, term_id, class_id, status, rubric, no_photo, updated_at) VALUES (?, ?, ?, 'draft', ?, 1, ?)")
      .run(res.lastInsertRowid, termId, classId, rubric, nowIso());
    return Number(rev.lastInsertRowid);
  })();
}

function reviewRubricNow() {
  return reviewRubric({ rubric: null });
}

export function removeChild(reviewId: number) {
  const r = getReviewRow(reviewId);
  if (!r) return;
  db().prepare("DELETE FROM children WHERE id = ?").run(r.child_id);
}

export type ChildListItem = {
  reviewId: number;
  name: string;
  answered: number;
  total: number;
  hasReport: boolean;
  /** One entry per learning area: how many of its skills are answered. */
  areas: { name: string; answered: number; total: number }[];
  coverPhotoId: number | null;
};

export function listChildren(): ChildListItem[] {
  const { termId } = workspace();
  const rows = db()
    .prepare(
      `SELECT r.id FROM reviews r JOIN children c ON c.id = r.child_id
       WHERE r.term_id = ? ORDER BY c.preferred_name COLLATE NOCASE, r.id`,
    )
    .all(termId) as { id: number }[];
  return rows.map((x) => {
    const r = getReviewRow(x.id) as ReviewRow;
    const rubric = reviewRubric(r);
    const { answers } = loadAnswers(r.id, rubric);
    const total = rubric.areas.reduce((n, a) => n + a.skills.length, 0);
    const answered = rubric.areas.reduce((n, a) => n + a.skills.filter((s) => answers[a.key]?.skills[s.key]?.touched).length, 0);
    const areas = rubric.areas.map((a) => ({
      name: a.shortName,
      total: a.skills.length,
      answered: a.skills.filter((s) => answers[a.key]?.skills[s.key]?.touched).length,
    }));
    return { reviewId: r.id, name: r.preferred_name, answered, total, hasReport: !!r.draft, areas, coverPhotoId: listPhotos(r.id)[0]?.id ?? null };
  });
}

export function missingAnswers(r: ReviewRow) {
  const rubric = reviewRubric(r);
  const { answers } = loadAnswers(r.id, rubric);
  return readinessGaps(rubric, answers);
}
