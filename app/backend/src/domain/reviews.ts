import type {
  AreaAnswer,
  ClassLevel,
  Draft,
  Level,
  Paragraph,
  Pronoun,
  ReportData,
  ReviewStatus,
  Rubric,
  SaveResult,
  SessionUser,
  TermStatus,
  WriteOutcome,
} from "@peterhouse/shared";
import {
  COVER_PHOTO_KEY,
  childPhotoUrl,
  HOME_PICKS_MAX,
  LOVE_MAX,
  NOTE_MAX,
  areaProgress,
  areaSummary,
  emptyAreaAnswer,
  fillTemplate,
  movement,
  normaliseRubric,
  readinessGaps,
  rubricForLevel,
  scoreOf,
  skillPhrase,
  suggestStrengthsAndNextSteps,
  type Movement,
} from "@peterhouse/shared";
import { many, one, pool, run, tx, type Db } from "../db";
import { HttpError, notFound } from "../http";
import { listPhotos, reportPhotoIds } from "./photos";
import { publishedRubric } from "./questions";
import { getAi, getRecords, getRubric, getSchool } from "./school";
import { buildAnonymousPayload, restoreName, scrubText, type Roster, type ReviewForWriting } from "./anonymise";
import { openJson, openJsonOrNull, openText, sealJson, sealText } from "./records";
import { writeWithSentenceBank } from "./writer/sentence-bank";
import { getSystemPrompt, WriterError, complete, draftInstruction, paragraphInstruction, parseDraft, parseParagraph, partInstruction, withRetry } from "./writer/ai";
import { canEditArea, isLead, partDone, workingOn, partRows, setPartDone, storePartParagraph, waitingParts } from "./parts";
import { qualityFlags } from "./writer/quality";
import type { WrittenDraft } from "./writer/types";

export type ReviewRow = {
  id: number;
  child_id: number;
  term_id: number;
  class_id: number;
  status: ReviewStatus;
  rubric: Rubric;
  /** False until a teacher first opens the review; only then is the question set frozen. */
  opened: boolean;
  rubric_version_id: number | null;
  highlight: string;
  highlight_by: number | null;
  highlight_at: string | null;
  no_photo: boolean;
  staff_note: string;
  strengths: string[] | null;
  next_steps: string[] | null;
  draft: Draft | null;
  report_version: number;
  approved_by: number | null;
  approved_at: string | null;
  submitted_by: number | null;
  submitted_at: string | null;
  change_note: string;
  change_note_by: number | null;
  change_note_at: string | null;
  taken_over_by: number | null;
  taken_over_at: string | null;
  admin_edited: boolean;
  updated_at: string;
  // joined
  /** The first name: what the report calls the child. */
  preferred_name: string;
  last_name: string;
  /** First and last name together. */
  legal_name: string;
  chinese_name: string;
  date_of_birth: string;
  pronoun: Pronoun;
  photo_consent: boolean;
  /** When the child's profile photo last changed; null without one. */
  photo_at: string | null;
  child_status: "active" | "left";
  class_name: string;
  class_level: ClassLevel;
  season: "June" | "December";
  year: number;
  term_status: TermStatus;
};

const REVIEW_SELECT = `
  SELECT r.id, r.child_id, r.term_id, r.class_id, r.status, r.rubric, r.rubric_version_id, r.highlight, r.highlight_by, r.highlight_at, r.no_photo,
         r.staff_note, r.strengths, r.next_steps, r.draft, r.report_version, r.approved_by, r.approved_at, r.updated_at,
         r.submitted_by, r.submitted_at, r.change_note, r.change_note_by, r.change_note_at, r.taken_over_by, r.taken_over_at, r.admin_edited,
         c.preferred_name, c.last_name, c.legal_name, c.chinese_name, c.date_of_birth, c.pronoun, c.photo_consent, c.photo_at, c.status AS child_status,
         k.name AS class_name, k.level AS class_level,
         CASE t.semester WHEN 1 THEN 'June' ELSE 'December' END AS season, t.year, t.status AS term_status
  FROM reviews r
  JOIN children c ON c.id = r.child_id
  JOIN classes k ON k.id = r.class_id
  JOIN terms t ON t.id = r.term_id`;

type RawReview = Omit<ReviewRow, "rubric" | "draft" | "opened"> & { rubric: unknown; draft: string | null };

async function hydrate(raw: RawReview): Promise<ReviewRow> {
  return {
    ...raw,
    // A review not opened yet shows the latest published questions; opening it freezes them (openReview).
    rubric: raw.rubric ? normaliseRubric(raw.rubric) : rubricForLevel(await getRubric(), raw.class_level),
    opened: !!raw.rubric,
    chinese_name: openText(raw.chinese_name, "children.chinese_name"),
    highlight: openText(raw.highlight, "reviews.highlight"),
    staff_note: openText(raw.staff_note, "reviews.staff_note"),
    change_note: openText(raw.change_note, "reviews.change_note"),
    draft: openJsonOrNull<Draft>(raw.draft, "reviews.draft"),
    preferred_name: openText(raw.preferred_name, "children.preferred_name"),
    last_name: openText(raw.last_name, "children.last_name"),
    legal_name: openText(raw.legal_name, "children.legal_name"),
    date_of_birth: openText(raw.date_of_birth, "children.date_of_birth"),
  };
}

export async function getReviewRow(id: number, c?: Db): Promise<ReviewRow | null> {
  const raw = await one<RawReview>(`${REVIEW_SELECT} WHERE r.id = $1`, [id], c);
  return raw ? hydrate(raw) : null;
}

/** Does this person belong to the class? Administrators belong to every class; a subject teacher to the classes they teach. */
export async function canAccessClass(user: SessionUser, classId: number): Promise<boolean> {
  return (await classRole(user, classId)) !== null;
}

/**
 * How this person belongs to a class: "class" for its lead and co-teachers, "subject" for a teacher who only teaches
 * lessons in it (change 7), or null when they do not.
 */
export async function classRole(user: SessionUser, classId: number, c?: Db): Promise<"admin" | "class" | "subject" | null> {
  if (user.role === "admin") return "admin";
  if (await one("SELECT 1 FROM class_staff WHERE class_id = $1 AND user_id = $2", [classId, user.id], c)) return "class";
  if (await one("SELECT 1 FROM class_subject_teachers WHERE class_id = $1 AND user_id = $2", [classId, user.id], c)) return "subject";
  return null;
}

/** Loads a review, but only for someone allowed to see its class. A review you may not see looks like one that does not exist. */
export async function getReviewForUser(user: SessionUser, id: number, c?: Db): Promise<ReviewRow> {
  const r = await getReviewRow(id, c);
  if (!r || !(await canAccessClass(user, r.class_id))) throw notFound("This child");
  return r;
}

export const reviewRubric = (r: Pick<ReviewRow, "rubric">): Rubric => r.rubric;

/**
 * Why this person cannot change a review's ratings, photos or wording right now (null when they can).
 * Teachers own the report: they edit until they submit it, and again when changes are requested. An administrator
 * edits only a report they have taken over, and nobody edits an approved one.
 */
export function lockReason(user: SessionUser, r: ReviewRow): string | null {
  if (r.term_status !== "open") return "This review belongs to a finished semester.";
  if (r.status === "approved") return "This report is approved. An administrator can send it back if something must change.";
  if (user.role === "admin") return r.taken_over_by ? null : "Teachers write the reports. Take this one over from Reports to change it yourself.";
  if (r.taken_over_by) return "An administrator has taken this report over, so it cannot be changed here for now.";
  if (r.status === "submitted") return "This report is waiting for review. Take it back to change something.";
  return null;
}

/**
 * Loads a review for a change, refusing when it is locked. An administrator's change is marked for staff.
 * With `area`, the change is to that area's part: its teacher, the lead or an administrator may make it, and once its
 * teacher has sent it to the lead only the lead (or the teacher, after reopening it) changes it. Without `area` the
 * change is to the report as a whole, which is the lead teacher's.
 */
export async function getReviewForEdit(user: SessionUser, id: number, c?: Db, area?: string): Promise<ReviewRow> {
  const r = await getReviewForUser(user, id, c);
  const why = lockReason(user, r);
  if (why) throw new HttpError(409, why, "locked");
  if (user.role !== "admin") {
    const lead = await isLead(user, r.class_id, c);
    if (area) {
      if (!(await canEditArea(user, r, area, c))) {
        const who = lead ? await workingOn(r, area, c) : null;
        throw new HttpError(403, who ? `${who} is still working on this area. You can change it once they send it to you.` : "Another teacher rates this area for this class.", "not_your_part");
      }
      if (!lead && (await partDone(r.id, area, c))) throw new HttpError(409, "You sent this part to the lead teacher. Reopen it to change it.", "part_sent");
    } else if (!lead) {
      throw new HttpError(403, "The lead teacher writes the whole report and sends it. Rate your own areas and send your part.", "not_lead");
    }
  }
  if (user.role === "admin" && !r.admin_edited) await run("UPDATE reviews SET admin_edited = true WHERE id = $1", [id], c);
  return r;
}

/**
 * Rule 2, frozen wording per review: the first time a review is opened it copies the current published question
 * set. Later edits only reach reviews not opened yet, so past and in-progress reports never change.
 */
export async function openReview(r: ReviewRow): Promise<ReviewRow> {
  if (r.opened || r.status === "approved" || r.term_status !== "open") return r;
  const live = await publishedRubric();
  // Only the questions for the child's level (change 8): a Playgroup child is not asked about letters.
  await run("UPDATE reviews SET rubric = $1::jsonb, rubric_version_id = $2 WHERE id = $3 AND rubric IS NULL", [JSON.stringify(rubricForLevel(live.rubric, r.class_level)), live.id, r.id]);
  return (await getReviewRow(r.id))!;
}

export type AreaMeta = { updatedBy: string | null; updatedAt: string | null };

type AreaRow = { review_id: number; area_key: string; data: string; updated_at: string; updated_by_name: string | null };

function buildAnswers(rubric: Rubric, rows: AreaRow[]) {
  const answers: Record<string, AreaAnswer> = {};
  const meta: Record<string, AreaMeta> = {};
  for (const a of rubric.areas) {
    const row = rows.find((r) => r.area_key === a.key);
    const stored = row ? openJson<AreaAnswer>(row.data, "review_areas.data") : null;
    const base = emptyAreaAnswer(a);
    answers[a.key] = stored ? { ...base, ...stored, skills: { ...base.skills, ...stored.skills } } : base;
    meta[a.key] = { updatedBy: row?.updated_by_name ?? null, updatedAt: row?.updated_at ?? null };
  }
  return { answers, meta };
}

export async function loadAnswers(reviewId: number, rubric: Rubric, c?: Db) {
  const rows = await many<AreaRow>(
    `SELECT a.review_id, a.area_key, a.data, a.updated_at, u.name AS updated_by_name
     FROM review_areas a LEFT JOIN users u ON u.id = a.updated_by WHERE a.review_id = $1`,
    [reviewId],
    c,
  );
  return buildAnswers(rubric, rows);
}

/** Answers for many reviews with one query (the class list). */
export async function loadAnswersFor(reviews: { id: number; rubric: Rubric }[]) {
  const rows = await many<AreaRow>(
    `SELECT a.review_id, a.area_key, a.data, a.updated_at, u.name AS updated_by_name
     FROM review_areas a LEFT JOIN users u ON u.id = a.updated_by WHERE a.review_id = ANY($1::bigint[])`,
    [reviews.map((r) => r.id)],
  );
  return new Map(reviews.map((r) => [r.id, buildAnswers(r.rubric, rows.filter((x) => x.review_id === r.id)).answers]));
}

export class WriteBlocked extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export async function loadNotes(reviewId: number): Promise<Record<string, string>> {
  const rows = await many<{ key: string; text: string }>("SELECT key, text FROM review_notes WHERE review_id = $1", [reviewId]);
  return Object.fromEntries(rows.map((r) => [r.key, openText(r.text, "review_notes.text")]));
}

export async function setChineseName(user: SessionUser, id: number, name: string) {
  const r = await getReviewForUser(user, id);
  await run("UPDATE children SET chinese_name = $1 WHERE id = $2", [sealText(name.trim().slice(0, 40), "children.chinese_name"), r.child_id]);
}

/** Recompute Draft ↔ Ready after any change to the answers (exported for the report route). */
export async function refreshReviewStatus(id: number) {
  await tx((c) => refreshStatus(c, id));
}

/** Recompute Draft ↔ Ready after any change to the answers. Written and Approved are not touched. */
async function refreshStatus(c: Db, id: number) {
  const r = (await getReviewRow(id, c))!;
  if (r.status !== "draft" && r.status !== "ready") return;
  const { answers } = await loadAnswers(id, r.rubric, c);
  const next: ReviewStatus = readinessGaps(r.rubric, answers).length === 0 ? "ready" : "draft";
  if (next !== r.status) await run("UPDATE reviews SET status = $1 WHERE id = $2", [next, id], c);
}

async function storeDraft(c: Db, id: number, draft: Draft) {
  await run("UPDATE reviews SET draft = $1, updated_at = now() WHERE id = $2", [sealJson(draft, "reviews.draft"), id], c);
}

/** Rule 3: changing an answer after writing marks the paragraph, never rewrites it. */
async function markStale(c: Db, r: ReviewRow, keys: string[]) {
  if (!r.draft) return;
  const draft = r.draft;
  let changed = false;
  for (const p of draft.paragraphs) {
    if (keys.includes(p.key) && !p.stale) {
      p.stale = true;
      changed = true;
    }
  }
  if (changed) await storeDraft(c, r.id, draft);
}

/**
 * Saves one area. Changes save per area, so two people editing different areas never lose work.
 */
export async function saveArea(user: SessionUser, id: number, areaKey: string, answer: AreaAnswer): Promise<SaveResult> {
  const r = await getReviewForEdit(user, id, undefined, areaKey);
  const area = r.rubric.areas.find((a) => a.key === areaKey);
  if (!area) return { ok: false, error: "Unknown area." };

  if (!r.opened) throw new HttpError(409, "Open this child's review first.");
  // Sanitise: only known questions, scores 0–5, a short comment, picks from this domain's list.
  const clean: AreaAnswer = {
    skills: Object.fromEntries(
      area.skills.map((s) => {
        const a = answer.skills[s.key];
        const touched = !!a?.touched && Number.isInteger(a.level) && a.level >= 0 && a.level <= 5;
        return [s.key, { level: (touched ? a.level : 0) as Level, touched }];
      }),
    ),
    note: (answer.note ?? "").slice(0, NOTE_MAX),
    visited: true,
    ...(area.love ? { love: (answer.love ?? "").slice(0, LOVE_MAX) } : {}),
    ...(area.homeIdeas ? { home: [...new Set(answer.home ?? [])].filter((h) => area.homeIdeas!.includes(h)).slice(0, HOME_PICKS_MAX) } : {}),
  };

  const status = await tx(async (c) => {
    const existing = await one<{ data: string }>("SELECT data FROM review_areas WHERE review_id = $1 AND area_key = $2", [id, areaKey], c);
    await run(
      `INSERT INTO review_areas (review_id, area_key, data, updated_by, updated_at) VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (review_id, area_key) DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`,
      [id, areaKey, sealJson(clean, "review_areas.data"), user.id],
      c,
    );
    await run("UPDATE reviews SET updated_at = now() WHERE id = $1", [id], c);
    if (existing && JSON.stringify(openJson(existing.data, "review_areas.data")) !== JSON.stringify(clean)) {
      await markStale(c, r, [`area:${areaKey}`]);
    }
    await refreshStatus(c, id);
    return (await getReviewRow(id, c))!.status;
  });
  return { ok: true, savedAt: new Date().toISOString(), status };
}

export async function saveStaffNote(user: SessionUser, id: number, note: string): Promise<SaveResult> {
  // A note for staff, not part of the report: any of the child's teachers may keep it.
  const r = await getReviewForUser(user, id);
  const why = lockReason(user, r);
  if (why) throw new HttpError(409, why, "locked");
  await run("UPDATE reviews SET staff_note = $1, updated_at = now() WHERE id = $2", [sealText(note.slice(0, 2000), "reviews.staff_note"), id]);
  return { ok: true, savedAt: new Date().toISOString(), status: r.status };
}

/**
 * The child's last written review before this term, for "↑ since last time". Approved is preferred, but a report
 * the semester closed on before approval still holds that semester's ratings.
 */
export async function previousApproved(childId: number, termId: number, level: ClassLevel) {
  // Only within the same level (change 8): an older child's version of a shared question may ask more.
  const row = await one<{ id: number; rubric: unknown; semester: number; year: number }>(
    `SELECT r.id, r.rubric, t.semester, t.year FROM reviews r JOIN terms t ON t.id = r.term_id JOIN classes k ON k.id = r.class_id
     WHERE r.child_id = $1 AND r.draft IS NOT NULL AND k.level = $3
       AND (t.year * 2 + t.semester) < (SELECT year * 2 + semester FROM terms WHERE id = $2)
     ORDER BY t.year DESC, t.semester DESC LIMIT 1`,
    [childId, termId, level],
  );
  if (!row || !row.rubric) return null;
  const rubric = normaliseRubric(row.rubric);
  const { answers } = await loadAnswers(row.id, rubric);
  // Scores line up by the permanent question key: a reworded question still compares, a new skill does not.
  const levels: Record<string, Level> = {};
  for (const a of rubric.areas)
    for (const s of a.skills) {
      const l = scoreOf(answers[a.key], s.key);
      if (l > 0) levels[s.key] = l;
    }
  return { reviewId: row.id, season: row.semester === 1 ? "June" : "December", year: row.year, levels };
}

export async function skillMovements(r: ReviewRow, rubric: Rubric, answers: Record<string, AreaAnswer>) {
  const prev = await previousApproved(r.child_id, r.term_id, r.class_level);
  const out: Record<string, Movement> = {};
  for (const a of rubric.areas)
    for (const s of a.skills) {
      const now = scoreOf(answers[a.key], s.key);
      out[s.key] = prev && prev.levels[s.key] ? movement(now, prev.levels[s.key]) : null;
    }
  return { prev, movements: out };
}

// ─── Writing ─────────────────────────────────────────────────────────────

export async function rosterFor(r: ReviewRow): Promise<Roster> {
  const children = await many<{ id: number; preferred_name: string; last_name: string; legal_name: string; chinese_name: string }>(
    "SELECT id, preferred_name, last_name, legal_name, chinese_name FROM children",
  );
  const staff = await many<{ name: string }>("SELECT name FROM users");
  return {
    child: [r.preferred_name, r.last_name, r.legal_name, r.chinese_name].filter(Boolean),
    otherChildren: children
      .filter((c) => c.id !== r.child_id)
      .flatMap((c) => [
        openText(c.preferred_name, "children.preferred_name"),
        openText(c.last_name, "children.last_name"),
        openText(c.legal_name, "children.legal_name"),
        openText(c.chinese_name, "children.chinese_name"),
      ])
      .filter(Boolean),
    staff: staff.map((s) => s.name),
  };
}

export function strengthsAndNextSteps(r: ReviewRow, rubric: Rubric, answers: Record<string, AreaAnswer>) {
  const suggested = suggestStrengthsAndNextSteps(rubric, answers);
  return {
    strengths: r.strengths ?? suggested.strengths,
    nextSteps: r.next_steps ?? suggested.nextSteps,
    suggested,
  };
}

async function forWriting(r: ReviewRow): Promise<{ input: ReviewForWriting; rubric: Rubric; answers: Record<string, AreaAnswer> }> {
  const rubric = r.rubric;
  const { answers } = await loadAnswers(r.id, rubric);
  const { strengths, nextSteps } = strengthsAndNextSteps(r, rubric, answers);
  return {
    rubric,
    answers,
    input: { pronoun: r.pronoun, season: r.season, level: r.class_level, rubric, answers, strengths, nextSteps },
  };
}

function notObservedSkillNames(rubric: Rubric, answers: Record<string, AreaAnswer>, pronoun: Pronoun, areaKey?: string) {
  return rubric.areas
    .filter((a) => !areaKey || a.key === areaKey)
    .flatMap((a) => a.skills.filter((s) => scoreOf(answers[a.key], s.key) === 0).map((s) => skillPhrase(s, pronoun)));
}

async function otherRosterNames(r: ReviewRow) {
  const roster = await rosterFor(r);
  const own = new Set(r.preferred_name.toLowerCase().split(/\s+/));
  return [...roster.otherChildren, ...roster.staff].flatMap((n) => n.split(/\s+/)).filter((n) => n.length > 2 && !own.has(n.toLowerCase()));
}

function toParagraphs(r: ReviewRow, rubric: Rubric, answers: Record<string, AreaAnswer>, w: WrittenDraft, others: string[]): Paragraph[] {
  const mk = (key: string, title: string, raw: string, kind: "opening" | "area" | "closing", areaKey?: string): Paragraph => {
    const text = restoreName(raw, r.preferred_name).replace(/\s{2,}/g, " ").trim();
    return {
      key,
      title,
      text,
      flags: qualityFlags(text, kind, {
        neverUse: rubric.neverUse,
        notObservedSkills: notObservedSkillNames(rubric, answers, r.pronoun, areaKey),
        rosterNames: others,
      }),
      stale: false,
      edited: false,
    };
  };
  return [
    mk("opening", "Opening", w.opening, "opening"),
    ...rubric.areas.map((a) => mk(`area:${a.key}`, a.name, w.areas[a.key] ?? "", "area", a.key)),
    mk("closing", "Looking ahead", w.closing, "closing"),
  ];
}

/** Writes (or rewrites) the whole draft. The previous version is always kept. */
export async function writeDraft(user: SessionUser, id: number, opts: { provider?: "sentence_bank" } = {}): Promise<WriteOutcome> {
  const r = await getReviewForEdit(user, id);
  if (r.status !== "ready" && r.status !== "written" && r.status !== "changes_requested") {
    return { ok: false, error: "This review is not ready yet. Finish the readiness check first." };
  }
  // The lead writes the report once every other teacher has sent their part.
  const waiting = await waitingParts(r, r.rubric.areas, user.role === "admin" ? null : user.id);
  if (waiting.length && user.role !== "admin") {
    return { ok: false, error: `Still waiting for ${waiting.map((w) => `${w.teacher} (${w.area})`).join(", ")} to send their part.` };
  }
  const { input, rubric, answers } = await forWriting(r);
  const ai = getAi();
  const roster = await rosterFor(r);
  const payload = buildAnonymousPayload(input, roster);
  const useAi = opts.provider !== "sentence_bank" && ai.provider !== "sentence_bank";

  let written: WrittenDraft;
  let provider = "sentence_bank";
  let sent = "";
  let fellBack: string | null = null;
  if (useAi) {
    const user_ = `${draftInstruction(rubric.areas.map((a) => ({ key: a.key, name: a.name, language: a.language })))}\n\n${payload.text}`;
    sent = `SYSTEM\n${getSystemPrompt()}\n\nUSER\n${user_}`;
    try {
      written = await withRetry(async () => parseDraft(await complete(ai, getSystemPrompt(), user_), rubric.areas.map((a) => a.key)));
      provider = ai.provider;
    } catch (e) {
      fellBack = e instanceof WriterError ? e.message : "The writing service failed.";
      written = writeWithSentenceBank(input, String(r.id));
    }
  } else {
    written = writeWithSentenceBank(input, String(r.id));
  }
  // Each part a teacher checked and sent is used as it is; the writer's own version fills only the others.
  for (const part of await partRows([r.id])) {
    if (part.done_at && part.paragraph.trim()) written.areas[part.area_key] = part.paragraph;
  }
  // The writer suggests the ideas to try at home, aimed at what the child finds hardest; the sentence bank tops them up.
  if (written.homeIdeas.length < 2) {
    const fallback = writeWithSentenceBank(input, String(r.id)).homeIdeas;
    written.homeIdeas = [...written.homeIdeas, ...fallback.filter((h) => !written.homeIdeas.includes(h))].slice(0, 2);
  }

  const others = [...roster.otherChildren, ...roster.staff]
    .flatMap((n) => n.split(/\s+/))
    .filter((n) => n.length > 2 && !new Set(r.preferred_name.toLowerCase().split(/\s+/)).has(n.toLowerCase()));
  const draft: Draft = {
    paragraphs: toParagraphs(r, rubric, answers, written, others),
    homeIdeas: written.homeIdeas.map((h) => restoreName(h, r.preferred_name)),
    provider,
    writtenAt: new Date().toISOString(),
    writtenBy: user.id,
    sent,
    notes: [
      ...(fellBack ? [`${fellBack} The sentence bank was used instead; your ratings are safe.`] : []),
      ...(payload.replaced ? [`${payload.replaced} name${payload.replaced === 1 ? " was" : "s were"} replaced before sending.`] : []),
      ...(payload.blocked ? [`${payload.blocked} contact detail${payload.blocked === 1 ? " was" : "s were"} removed before sending.`] : []),
    ],
  };
  await tx(async (c) => {
    if (r.draft) {
      await run("INSERT INTO draft_versions (review_id, draft, replaced_by) VALUES ($1, $2, $3)", [id, sealJson(r.draft, "draft_versions.draft"), user.id], c);
    }
    await run(
      // A report sent back stays "Changes requested" until the teacher submits it again.
      "UPDATE reviews SET draft = $1, status = CASE WHEN status = 'changes_requested' THEN status ELSE 'written' END, strengths = $2::jsonb, next_steps = $3::jsonb, updated_at = now() WHERE id = $4",
      [sealJson(draft, "reviews.draft"), JSON.stringify(input.strengths), JSON.stringify(input.nextSteps), id],
      c,
    );
  });
  return { ok: true, provider, fellBack };
}

/** Rewrites one paragraph without touching the teacher's edits elsewhere. */
/** `request` is what the teacher asked for ("mention his drawing", "make it shorter"); names in it are removed before sending. */
export async function rewriteParagraph(user: SessionUser, id: number, key: string, tone?: string, request?: string): Promise<WriteOutcome> {
  const r = await getReviewForEdit(user, id);
  if (!r.draft) return { ok: false, error: "Write the draft first." };
  const draft = r.draft;
  const para = draft.paragraphs.find((p) => p.key === key);
  if (!para) return { ok: false, error: "Unknown paragraph." };
  const { input, rubric, answers } = await forWriting(r);
  const ai = getAi();
  const bank = writeWithSentenceBank(input, `${r.id}:${Date.now()}`);
  const areaKey = key.startsWith("area:") ? key.slice(5) : undefined;
  const bankText = key === "opening" ? bank.opening : key === "closing" ? bank.closing : bank.areas[areaKey!];

  let raw = bankText;
  let provider = "sentence_bank";
  let fellBack: string | null = null;
  if (ai.provider !== "sentence_bank") {
    const roster = await rosterFor(r);
    const payload = buildAnonymousPayload(input, roster);
    // The teacher's current text contains the name; send it scrubbed like everything else.
    const current = scrubText(para.text, roster).text;
    const asked = request?.trim() ? scrubText(request.trim(), roster).text : undefined;
    const user_ = `${paragraphInstruction(para.title, current, tone, rubric.areas.find((a) => a.key === areaKey)?.language, asked)}\n\n${payload.text}`;
    try {
      raw = await withRetry(async () => parseParagraph(await complete(ai, getSystemPrompt(), user_)));
      provider = ai.provider;
      draft.sent = `${draft.sent}\n\n— Rewrite of “${para.title}” —\nSYSTEM\n${getSystemPrompt()}\n\nUSER\n${user_}`;
    } catch (e) {
      fellBack = e instanceof WriterError ? e.message : "The writing service failed.";
    }
  }
  const kind = key === "opening" ? "opening" : key === "closing" ? "closing" : "area";
  const text = restoreName(raw, r.preferred_name).replace(/\s{2,}/g, " ").trim();
  Object.assign(para, {
    text,
    stale: false,
    edited: false,
    flags: qualityFlags(text, kind, {
      neverUse: rubric.neverUse,
      notObservedSkills: notObservedSkillNames(rubric, answers, r.pronoun, areaKey),
      rosterNames: await otherRosterNames(r),
    }),
  });
  await storeDraft(pool, id, draft);
  return { ok: true, provider, fellBack };
}

export async function editParagraph(user: SessionUser, id: number, key: string, text: string) {
  const r = await getReviewForEdit(user, id);
  if (!r.draft) throw new WriteBlocked("Write the draft first.");
  const draft = r.draft;
  const { answers } = await loadAnswers(id, r.rubric);
  if (key === "home") {
    draft.homeIdeas = text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  } else {
    const para = draft.paragraphs.find((p) => p.key === key);
    if (!para) throw new WriteBlocked("Unknown paragraph.");
    const kind = key === "opening" ? "opening" : key === "closing" ? "closing" : "area";
    para.text = text.slice(0, 2000);
    para.edited = true;
    para.flags = qualityFlags(para.text, kind, {
      neverUse: r.rubric.neverUse,
      notObservedSkills: notObservedSkillNames(r.rubric, answers, r.pronoun, key.startsWith("area:") ? key.slice(5) : undefined),
      rosterNames: await otherRosterNames(r),
    });
  }
  await run("UPDATE reviews SET draft = $1, updated_at = now() WHERE id = $2", [sealJson(draft, "reviews.draft"), id]);
  return { savedAt: new Date().toISOString(), flags: draft.paragraphs.find((p) => p.key === key)?.flags ?? [] };
}

/** Swapping strengths or next steps updates the closing: rewritten if untouched, otherwise marked. */
export async function setStrengths(user: SessionUser, id: number, strengths: string[], nextSteps: string[]) {
  const r = await getReviewForEdit(user, id);
  await run("UPDATE reviews SET strengths = $1::jsonb, next_steps = $2::jsonb, updated_at = now() WHERE id = $3", [
    JSON.stringify(strengths.slice(0, 2)),
    JSON.stringify(nextSteps.slice(0, 2)),
    id,
  ]);
  if (!r.draft) return;
  const closing = r.draft.paragraphs.find((p) => p.key === "closing");
  if (closing && !closing.edited) await rewriteParagraph(user, id, "closing");
  else await tx(async (c) => markStale(c, (await getReviewRow(id, c))!, ["closing"]));
}

export async function restoreDraftVersion(user: SessionUser, id: number, versionId: number) {
  const r = await getReviewForEdit(user, id);
  const v = await one<{ draft: string }>("SELECT draft FROM draft_versions WHERE id = $1 AND review_id = $2", [versionId, id]);
  if (!v) throw new WriteBlocked("That version does not exist.");
  await tx(async (c) => {
    if (r.draft) await run("INSERT INTO draft_versions (review_id, draft, replaced_by) VALUES ($1, $2, $3)", [id, sealJson(r.draft, "draft_versions.draft"), user.id], c);
    // The stored version was sealed under another column name, so re-seal it for reviews.draft.
    await run("UPDATE reviews SET draft = $1, updated_at = now() WHERE id = $2", [sealJson(openJson(v.draft, "draft_versions.draft"), "reviews.draft"), id], c);
  });
}

// ─── Report data ─────────────────────────────────────────────────────────

export async function buildReportData(r: ReviewRow): Promise<ReportData> {
  const rubric = r.rubric;
  const { answers } = await loadAnswers(r.id, rubric);
  const draft = r.draft;
  const { prev, movements } = await skillMovements(r, rubric, answers);
  const records = await getRecords();
  const school = await getSchool();
  const text = (key: string) => draft?.paragraphs.find((p) => p.key === key)?.text ?? "";
  const { strengths, nextSteps } = strengthsAndNextSteps(r, rubric, answers);
  const fill = (t: string) => fillTemplate(t, r.preferred_name, r.pronoun);
  const statement = new Map(rubric.areas.flatMap((a) => a.skills.map((s) => [s.key, fill(s.text).replace(/[.\s]+$/, "")] as const)));
  const skillLabel = new Map(
    rubric.areas.flatMap((a) => a.skills.map((s) => [s.key, skillPhrase(s, r.pronoun).replace(/^./, (c) => c.toUpperCase())] as const)),
  );
  // The child's own class prints its name and teachers; the old single-class setting is only a fallback.
  const staff = await many<{ name: string; role: "lead" | "co" }>(
    "SELECT u.name, s.role FROM class_staff s JOIN users u ON u.id = s.user_id WHERE s.class_id = $1 AND u.active ORDER BY s.role DESC, u.name",
    [r.class_id],
  );
  const lead = staff.filter((s) => s.role === "lead").map((s) => s.name);
  const co = staff.filter((s) => s.role === "co").map((s) => s.name);
  const fallback = school.teachers.split(",").map((t) => t.trim()).filter(Boolean);
  const allowed = new Set(await reportPhotoIds(r.id));
  const photos = (await listPhotos(r.id)).filter((p) => allowed.has(p.id));
  // The cover photo is chosen on its own; any other photo belongs to a learning area (or, from before that, to none).
  const cover = photos.find((p) => p.area_key === COVER_PHOTO_KEY);
  const ordered = [...rubric.areas.flatMap((a) => photos.filter((p) => p.area_key === a.key)), ...photos.filter((p) => p.area_key !== COVER_PHOTO_KEY && !rubric.areas.some((a) => a.key === p.area_key))];
  return {
    reviewId: r.id,
    childName: r.legal_name,
    firstName: r.preferred_name,
    chineseName: r.chinese_name,
    childInitial: [...r.preferred_name][0]?.toUpperCase() ?? "",
    className: r.class_name,
    dateOfBirth: r.date_of_birth,
    season: r.season,
    year: r.year,
    // An approved report keeps the cover it was approved with; every other report shows the child's profile photo.
    coverPhoto: r.status === "approved" && cover ? `/api/photos/${cover.id}` : childPhotoUrl(r.child_id, r.photo_at),
    photoIds: ordered.map((p) => p.id),
    areas: rubric.areas.map((a) => {
      const ans = answers[a.key];
      return {
        key: a.key,
        name: a.name,
        subName: a.subName ?? null,
        icon: a.icon ?? null,
        language: a.language ?? "en",
        summary: areaSummary(a, ans),
        skills: a.skills.map((s) => ({
          key: s.key,
          text: statement.get(s.key) ?? s.key,
          level: scoreOf(ans, s.key),
          // Families only ever see "moved up"; never a drop.
          up: records.showProgressOnReports && movements[s.key] === "up",
          previous: prev?.levels[s.key] ?? null,
        })),
        photoIds: photos.filter((p) => p.area_key === a.key).map((p) => p.id),
        love: a.love && ans?.love?.trim() ? { question: fill(a.love.text), answer: ans.love.trim() } : null,
        paragraph: text(`area:${a.key}`),
      };
    }),
    opening: text("opening"),
    closing: text("closing"),
    // The skill itself ("Recognises some familiar Chinese characters"), so a next step never reads as already done.
    strengths: strengths.map((k) => skillLabel.get(k) ?? k),
    nextSteps: nextSteps.map((k) => skillLabel.get(k) ?? k),
    homeIdeas: records.homeIdeasOnReports ? draft?.homeIdeas ?? [] : [],
    leadTeachers: staff.length ? lead : fallback,
    coTeachers: staff.length ? co : [],
    version: r.report_version,
    previousSeason: prev?.season ?? null,
  };
}

// ─── A teacher's part ────────────────────────────────────────────────────

/** Has the AI (or the sentence bank) write one area's paragraph for its teacher to check, optionally with their request. */
export async function writePart(user: SessionUser, id: number, areaKey: string, request?: string): Promise<WriteOutcome & { text?: string }> {
  const r = await getReviewForEdit(user, id, undefined, areaKey);
  const area = r.rubric.areas.find((a) => a.key === areaKey);
  if (!area) return { ok: false, error: "Unknown area." };
  const { input, answers } = await forWriting(r);
  if (areaProgress(area, answers[areaKey]).todo > 0) return { ok: false, error: `Rate every statement in ${area.name}, or mark it Not seen yet, first.` };
  const ai = getAi();
  let raw = writeWithSentenceBank(input, `${r.id}:${areaKey}:${Date.now()}`).areas[areaKey] ?? "";
  let provider = "sentence_bank";
  let fellBack: string | null = null;
  if (ai.provider !== "sentence_bank") {
    const roster = await rosterFor(r);
    const payload = buildAnonymousPayload(input, roster);
    const asked = request?.trim() ? scrubText(request.trim(), roster).text : undefined;
    const current = (await partRows([r.id])).find((p) => p.area_key === areaKey)?.paragraph;
    const user_ = `${partInstruction(area.name, area.language, current ? scrubText(current, roster).text : undefined, asked)}\n\n${payload.text}`;
    try {
      raw = await withRetry(async () => parseParagraph(await complete(ai, getSystemPrompt(), user_)));
      provider = ai.provider;
    } catch (e) {
      fellBack = e instanceof WriterError ? e.message : "The writing service failed.";
    }
  }
  const text = restoreName(raw, r.preferred_name).replace(/\s{2,}/g, " ").trim();
  await storePartParagraph(r.id, areaKey, text);
  return { ok: true, provider, fellBack, text };
}

/** The teacher's own wording of their part. */
export async function savePartText(user: SessionUser, id: number, areaKey: string, text: string) {
  const r = await getReviewForEdit(user, id, undefined, areaKey);
  await storePartParagraph(r.id, areaKey, text.trim());
}

/** The teacher sends their checked part to the lead teacher. */
export async function sendPart(user: SessionUser, id: number, areaKey: string) {
  const r = await getReviewForEdit(user, id, undefined, areaKey);
  const area = r.rubric.areas.find((a) => a.key === areaKey);
  if (!area) throw new HttpError(400, "Unknown area.");
  const { answers } = await loadAnswers(r.id, r.rubric);
  if (areaProgress(area, answers[areaKey]).todo > 0) throw new HttpError(409, `Rate every statement in ${area.name}, or mark it Not seen yet, first.`);
  if (!(await partRows([r.id])).find((p) => p.area_key === areaKey)?.paragraph.trim()) throw new HttpError(409, `Write and check the ${area.name} paragraph first.`);
  await setPartDone(r.id, areaKey, user.id);
}

/** Takes a part back from the lead to change it (its teacher or the lead). */
export async function reopenPart(user: SessionUser, id: number, areaKey: string) {
  const r = await getReviewForUser(user, id);
  const why = lockReason(user, r);
  if (why) throw new HttpError(409, why, "locked");
  if (!(await canEditArea(user, r, areaKey))) throw new HttpError(403, "Another teacher rates this area for this class.");
  await setPartDone(r.id, areaKey, null);
}
