import { db, nowIso } from "./db";
import { reportPhotoIds } from "./photos";
import { getAi, getRecords, getRubric, getSchool } from "./school";
import {
  areaSummary,
  emptyAreaAnswer,
  movement,
  readinessGaps,
  suggestStrengthsAndNextSteps,
  type Movement,
} from "./calc";
import { buildAnonymousPayload, restoreName, scrubText, type Roster, type ReviewForWriting } from "./anonymise";
import { writeWithSentenceBank } from "./writer/sentence-bank";
import {
  getSystemPrompt,
  WriterError,
  complete,
  draftInstruction,
  paragraphInstruction,
  parseDraft,
  parseParagraph,
  withRetry,
} from "./writer/ai";
import { qualityFlags } from "./writer/quality";
import type { WrittenDraft } from "./writer/types";
import type {
  AreaAnswer,
  Draft,
  Level,
  Paragraph,
  Pronoun,
  ReviewStatus,
  Rubric,
  TermStatus,
  User,
} from "./types";

export type ReviewRow = {
  id: number;
  child_id: number;
  term_id: number;
  class_id: number;
  status: ReviewStatus;
  rubric: string | null;
  highlight: string;
  highlight_by: number | null;
  highlight_at: string | null;
  photo_file: string | null;
  no_photo: number;
  staff_note: string;
  strengths: string | null;
  next_steps: string | null;
  draft: string | null;
  report_version: number;
  approved_by: number | null;
  approved_at: string | null;
  approved_snapshot: string | null;
  updated_at: string;
  // joined
  preferred_name: string;
  legal_name: string;
  date_of_birth: string;
  pronoun: Pronoun;
  photo_consent: number;
  child_status: "active" | "left";
  class_name: string;
  class_level: string;
  season: "June" | "December";
  year: number;
  term_status: TermStatus;
};

const REVIEW_SELECT = `
  SELECT r.*, c.preferred_name, c.legal_name, c.date_of_birth, c.pronoun, c.photo_consent, c.status AS child_status,
         k.name AS class_name, k.level AS class_level, t.season, t.year, t.status AS term_status
  FROM reviews r
  JOIN children c ON c.id = r.child_id
  JOIN classes k ON k.id = r.class_id
  JOIN terms t ON t.id = r.term_id`;

export function getReviewRow(id: number): ReviewRow | null {
  return (db().prepare(`${REVIEW_SELECT} WHERE r.id = ?`).get(id) as ReviewRow | undefined) ?? null;
}

export function getReviewForUser(user: User, id: number): ReviewRow {
  const r = getReviewRow(id);
  if (!r) throw new WriteBlocked("This child could not be found.");
  return r;
}

export function reviewRubric(r: Pick<ReviewRow, "rubric">): Rubric {
  return r.rubric ? (JSON.parse(r.rubric) as Rubric) : getRubric();
}

export type AreaMeta = { updatedBy: string | null; updatedAt: string | null };

export function loadAnswers(reviewId: number, rubric: Rubric) {
  const rows = db()
    .prepare(
      `SELECT a.area_key, a.data, a.updated_at, u.name AS updated_by_name
       FROM review_areas a LEFT JOIN users u ON u.id = a.updated_by WHERE a.review_id = ?`,
    )
    .all(reviewId) as { area_key: string; data: string; updated_at: string; updated_by_name: string | null }[];
  const answers: Record<string, AreaAnswer> = {};
  const meta: Record<string, AreaMeta> = {};
  for (const a of rubric.areas) {
    const row = rows.find((r) => r.area_key === a.key);
    const stored = row ? (JSON.parse(row.data) as AreaAnswer) : null;
    const base = emptyAreaAnswer(a);
    // Questions added after this answer was saved start unanswered.
    answers[a.key] = stored ? { ...stored, skills: { ...base.skills, ...stored.skills } } : base;
    meta[a.key] = { updatedBy: row?.updated_by_name ?? null, updatedAt: row?.updated_at ?? null };
  }
  return { answers, meta };
}

export class WriteBlocked extends Error {}

export const EXTRA_NOTES = [
  { key: "favourites", label: "What does {name} love doing at school?", hint: "Favourite activities, toys, songs, books, corners of the room", max: 400 },
  { key: "friends", label: "How does {name} play and get on with others?", hint: "Play style, friendships, how {name} joins in or leads", max: 400 },
  { key: "growing", label: "What is {name} working on, and what helps?", hint: "Something tricky or new, and what has helped so far", max: 400 },
] as const;

export function loadNotes(reviewId: number): Record<string, string> {
  const rows = db().prepare("SELECT key, text FROM review_notes WHERE review_id = ?").all(reviewId) as { key: string; text: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.text]));
}

export function saveNote(user: User, id: number, key: string, text: string): SaveResult {
  const r = getReviewForUser(user, id);
  const def = EXTRA_NOTES.find((n) => n.key === key);
  if (!def) return { ok: false, error: "Unknown question." };
  const clean = text.slice(0, def.max);
  const old = loadNotes(id)[key] ?? "";
  db().prepare("INSERT INTO review_notes (review_id, key, text) VALUES (?, ?, ?) ON CONFLICT(review_id, key) DO UPDATE SET text = excluded.text").run(id, key, clean);
  const now = nowIso();
  db().prepare("UPDATE reviews SET updated_at = ? WHERE id = ?").run(now, id);
  if (clean !== old) markStale(r, ["opening", "closing"]);
  return { ok: true, savedAt: now, status: r.status };
}

const skillSig = (rb: Rubric) => rb.areas.map((a) => `${a.key}:${a.skills.map((s) => s.key).join(",")}`).join("|");

/** A review that is not approved picks up question changes: new skills appear unanswered, old answers stay. */
export function syncRubric(r: ReviewRow): ReviewRow {
  if (r.status === "approved" || r.term_status !== "open") return r;
  const live = getRubric();
  if (skillSig(live) === skillSig(reviewRubric(r))) return r;
  db().prepare("UPDATE reviews SET rubric = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(live), nowIso(), r.id);
  refreshStatus(r.id);
  return getReviewRow(r.id)!;
}


/** Opening a review freezes the rubric wording onto it (rule 2) and moves it to Draft. */
export function openReview(user: User, id: number): ReviewRow {
  const r = getReviewForUser(user, id);
  if (r.status === "not_started" && r.term_status === "open") {
    db()
      .prepare("UPDATE reviews SET status = 'draft', rubric = ?, updated_at = ? WHERE id = ? AND status = 'not_started'")
      .run(JSON.stringify(getRubric()), nowIso(), id);
    return getReviewRow(id)!;
  }
  return r;
}

/** Recompute Draft ↔ Ready after any change to the answers. Written and Approved are not touched. */
function refreshStatus(id: number) {
  const r = getReviewRow(id)!;
  if (r.status !== "draft" && r.status !== "ready") return;
  const rubric = reviewRubric(r);
  const { answers } = loadAnswers(id, rubric);
  // Without photo consent the pattern tile is used, so no photo decision is needed.
  const photo = { ...r, no_photo: r.photo_consent ? r.no_photo : 1 };
  const next: ReviewStatus = readinessGaps(rubric, answers, photo).length === 0 ? "ready" : "draft";
  if (next !== r.status) db().prepare("UPDATE reviews SET status = ? WHERE id = ?").run(next, id);
}

/** Rule 3: changing an answer after writing marks the paragraph, never rewrites it. */
function markStale(r: ReviewRow, keys: string[]) {
  if (!r.draft) return;
  const draft = JSON.parse(r.draft) as Draft;
  let changed = false;
  for (const p of draft.paragraphs) {
    if (keys.includes(p.key) && !p.stale) {
      p.stale = true;
      changed = true;
    }
  }
  if (changed) db().prepare("UPDATE reviews SET draft = ? WHERE id = ?").run(JSON.stringify(draft), r.id);
}

export type SaveResult =
  | { ok: true; savedAt: string; status: ReviewStatus }
  | { ok: false; conflict: { by: string; at: string; answer: AreaAnswer } }
  | { ok: false; error: string };

/**
 * Saves one area. Changes save per area, so two people editing different
 * areas never lose work. If someone else changed this area since the client
 * loaded it, the save is refused unless `force` (the teacher was asked first).
 */
export function saveArea(
  user: User,
  id: number,
  areaKey: string,
  answer: AreaAnswer,
  baseUpdatedAt: string | null,
  force: boolean,
): SaveResult {
  const r = getReviewForUser(user, id);
  const rubric = reviewRubric(r);
  const area = rubric.areas.find((a) => a.key === areaKey);
  if (!area) return { ok: false, error: "Unknown area." };

  // Sanitise: only known skills, levels 0–5, moments from this area, note ≤ 140.
  const clean: AreaAnswer = {
    skills: Object.fromEntries(
      area.skills.map((s) => {
        const a = answer.skills[s.key];
        const level = (a && Number.isInteger(a.level) && a.level >= 0 && a.level <= 5 ? a.level : 3) as Level;
        return [s.key, { level, touched: !!a?.touched }];
      }),
    ),
    moments: answer.moments.filter((m) => area.moments.includes(m)).slice(0, 5),
    note: (answer.note ?? "").slice(0, 400),
    visited: true,
  };

  const existing = db()
    .prepare(
      `SELECT a.data, a.updated_at, a.updated_by, u.name FROM review_areas a LEFT JOIN users u ON u.id = a.updated_by
       WHERE a.review_id = ? AND a.area_key = ?`,
    )
    .get(id, areaKey) as { data: string; updated_at: string; updated_by: number; name: string } | undefined;
  const now = nowIso();
  db()
    .prepare(
      `INSERT INTO review_areas (review_id, area_key, data, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(review_id, area_key) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    )
    .run(id, areaKey, JSON.stringify(clean), user.id, now);
  db().prepare("UPDATE reviews SET updated_at = ? WHERE id = ?").run(now, id);
  if (existing && existing.data !== JSON.stringify(clean)) {
    markStale(r, [`area:${areaKey}`]);
  }
  refreshStatus(id);
  return { ok: true, savedAt: now, status: getReviewRow(id)!.status };
}

export function saveHighlight(user: User, id: number, highlight: string): SaveResult {
  const r = getReviewForUser(user, id);
  const now = nowIso();
  const text = highlight.slice(0, 600);
  db().prepare("UPDATE reviews SET highlight = ?, highlight_by = ?, highlight_at = ?, updated_at = ? WHERE id = ?").run(text, user.id, now, now, id);
  if (text !== r.highlight) markStale(r, ["opening"]);
  refreshStatus(id);
  return { ok: true, savedAt: now, status: getReviewRow(id)!.status };
}

export function saveStaffNote(user: User, id: number, note: string): SaveResult {
  const r = getReviewForUser(user, id);
  const now = nowIso();
  db().prepare("UPDATE reviews SET staff_note = ?, updated_at = ? WHERE id = ?").run(note.slice(0, 2000), now, id);
  return { ok: true, savedAt: now, status: r.status };
}

export function setPhoto(user: User, id: number, file: string | null, noPhoto: boolean): SaveResult {
  const r = getReviewForUser(user, id);
  const now = nowIso();
  db().prepare("UPDATE reviews SET photo_file = ?, no_photo = ?, updated_at = ? WHERE id = ?").run(file, noPhoto ? 1 : 0, now, id);
  refreshStatus(id);
  return { ok: true, savedAt: now, status: getReviewRow(id)!.status };
}

/** The child's last approved review before this term, for "↑ since June" and Copy from last term. */
export function previousApproved(childId: number, termId: number) {
  const t = db().prepare("SELECT season, year FROM terms WHERE id = ?").get(termId) as { season: string; year: number };
  const order = t.year * 2 + (t.season === "December" ? 1 : 0);
  const row = db()
    .prepare(
      `SELECT r.id, r.rubric, t.season, t.year FROM reviews r JOIN terms t ON t.id = r.term_id
       WHERE r.child_id = ? AND r.status = 'approved' AND (t.year * 2 + (CASE t.season WHEN 'December' THEN 1 ELSE 0 END)) < ?
       ORDER BY t.year DESC, t.season = 'December' DESC LIMIT 1`,
    )
    .get(childId, order) as { id: number; rubric: string; season: string; year: number } | undefined;
  if (!row) return null;
  const rubric = JSON.parse(row.rubric) as Rubric;
  const { answers } = loadAnswers(row.id, rubric);
  const levels: Record<string, Level> = {};
  for (const a of rubric.areas) for (const s of a.skills) levels[s.key] = answers[a.key]?.skills[s.key]?.level ?? 3;
  return { reviewId: row.id, season: row.season, year: row.year, levels };
}

export function skillMovements(r: ReviewRow, rubric: Rubric, answers: Record<string, AreaAnswer>) {
  const prev = previousApproved(r.child_id, r.term_id);
  const out: Record<string, Movement> = {};
  for (const a of rubric.areas)
    for (const s of a.skills) {
      const now = answers[a.key]?.skills[s.key]?.level ?? 3;
      out[s.key] = prev ? movement(now as Level, prev.levels[s.key]) : null;
    }
  return { prev, movements: out };
}

// ─── Writing ─────────────────────────────────────────────────────────────

export function rosterFor(r: ReviewRow): Roster {
  const children = db().prepare("SELECT id, preferred_name, legal_name FROM children").all() as {
    id: number;
    preferred_name: string;
    legal_name: string;
  }[];
  const staff = db().prepare("SELECT name FROM users").all() as { name: string }[];
  return {
    child: [r.preferred_name, r.legal_name],
    otherChildren: children.filter((c) => c.id !== r.child_id).flatMap((c) => [c.preferred_name, c.legal_name]),
    staff: staff.map((s) => s.name),
  };
}

export function strengthsAndNextSteps(r: ReviewRow, rubric: Rubric, answers: Record<string, AreaAnswer>) {
  const suggested = suggestStrengthsAndNextSteps(rubric, answers);
  return {
    strengths: r.strengths ? (JSON.parse(r.strengths) as string[]) : suggested.strengths,
    nextSteps: r.next_steps ? (JSON.parse(r.next_steps) as string[]) : suggested.nextSteps,
    suggested,
  };
}

function forWriting(r: ReviewRow): { input: ReviewForWriting; rubric: Rubric; answers: Record<string, AreaAnswer> } {
  const rubric = reviewRubric(r);
  const { answers } = loadAnswers(r.id, rubric);
  const { strengths, nextSteps } = strengthsAndNextSteps(r, rubric, answers);
  return {
    rubric,
    answers,
    input: { pronoun: r.pronoun, season: r.season, highlight: r.highlight, notes: loadNotes(r.id), rubric, answers, strengths, nextSteps },
  };
}

function notObservedSkillNames(rubric: Rubric, answers: Record<string, AreaAnswer>, areaKey?: string) {
  return rubric.areas
    .filter((a) => !areaKey || a.key === areaKey)
    .flatMap((a) => a.skills.filter((s) => answers[a.key]?.skills[s.key]?.level === 0).map((s) => s.name));
}

function otherRosterNames(r: ReviewRow) {
  const roster = rosterFor(r);
  const own = new Set(r.preferred_name.toLowerCase().split(/\s+/));
  return [...roster.otherChildren, ...roster.staff]
    .flatMap((n) => n.split(/\s+/))
    .filter((n) => n.length > 2 && !own.has(n.toLowerCase()));
}

function toParagraphs(r: ReviewRow, rubric: Rubric, answers: Record<string, AreaAnswer>, w: WrittenDraft): Paragraph[] {
  const others = otherRosterNames(r);
  const mk = (key: string, title: string, raw: string, kind: "opening" | "area" | "closing", areaKey?: string): Paragraph => {
    const text = restoreName(raw, r.preferred_name).replace(/\s{2,}/g, " ").trim();
    return {
      key,
      title,
      text,
      flags: qualityFlags(text, kind, {
        neverUse: rubric.neverUse,
        notObservedSkills: notObservedSkillNames(rubric, answers, areaKey),
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

export type WriteOutcome = { ok: true; provider: string; fellBack: string | null } | { ok: false; error: string };

/** Writes (or rewrites) the whole draft. The previous version is always kept. */
export async function writeDraft(user: User, id: number, opts: { provider?: "sentence_bank" } = {}): Promise<WriteOutcome> {
  const r = getReviewForUser(user, id);
  if (r.status !== "ready" && r.status !== "written") {
    return { ok: false, error: "This review is not ready yet. Finish the readiness check first." };
  }
  const { input, rubric, answers } = forWriting(r);
  const ai = getAi();
  const roster = rosterFor(r);
  const payload = buildAnonymousPayload(input, roster);
  const useAi = opts.provider !== "sentence_bank" && ai.provider !== "sentence_bank";

  let written: WrittenDraft;
  let provider = "sentence_bank";
  let sent = "";
  let fellBack: string | null = null;
  if (useAi) {
    const user_ = `${draftInstruction(rubric.areas.map((a) => ({ key: a.key, name: a.name })))}\n\n${payload.text}`;
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
  if (written.homeIdeas.length < 2) {
    const fallback = writeWithSentenceBank(input, String(r.id)).homeIdeas;
    written.homeIdeas = [...written.homeIdeas, ...fallback.filter((h) => !written.homeIdeas.includes(h))].slice(0, 2);
  }

  const draft: Draft = {
    paragraphs: toParagraphs(r, rubric, answers, written),
    homeIdeas: written.homeIdeas.map((h) => restoreName(h, r.preferred_name)),
    provider,
    writtenAt: nowIso(),
    writtenBy: user.id,
    sent,
    notes: [
      ...(fellBack ? [`${fellBack} The sentence bank was used instead; your ratings are safe.`] : []),
      ...(payload.replaced ? [`${payload.replaced} name${payload.replaced === 1 ? " was" : "s were"} replaced before sending.`] : []),
      ...(payload.blocked ? [`${payload.blocked} contact detail${payload.blocked === 1 ? " was" : "s were"} removed before sending.`] : []),
    ],
  };
  db().transaction(() => {
    if (r.draft) db().prepare("INSERT INTO draft_versions (review_id, draft, replaced_by, replaced_at) VALUES (?, ?, ?, ?)").run(id, r.draft, user.id, nowIso());
    db()
      .prepare("UPDATE reviews SET draft = ?, status = 'written', strengths = ?, next_steps = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(draft), JSON.stringify(input.strengths), JSON.stringify(input.nextSteps), nowIso(), id);
  })();
  return { ok: true, provider, fellBack };
}

/** Rewrites one paragraph without touching the teacher's edits elsewhere. */
export async function rewriteParagraph(user: User, id: number, key: string, tone?: string): Promise<WriteOutcome> {
  const r = getReviewForUser(user, id);
  if (!r.draft) return { ok: false, error: "Write the draft first." };
  const draft = JSON.parse(r.draft) as Draft;
  const para = draft.paragraphs.find((p) => p.key === key);
  if (!para) return { ok: false, error: "Unknown paragraph." };
  const { input, rubric, answers } = forWriting(r);
  const ai = getAi();
  const bank = writeWithSentenceBank(input, `${r.id}:${Date.now()}`);
  const areaKey = key.startsWith("area:") ? key.slice(5) : undefined;
  const bankText = key === "opening" ? bank.opening : key === "closing" ? bank.closing : bank.areas[areaKey!];

  let raw = bankText;
  let provider = "sentence_bank";
  let fellBack: string | null = null;
  if (ai.provider !== "sentence_bank") {
    const roster = rosterFor(r);
    const payload = buildAnonymousPayload(input, roster);
    // The teacher's current text contains the name; send it scrubbed like everything else.
    const current = scrubText(para.text, roster).text;
    const user_ = `${paragraphInstruction(para.title, current, tone)}\n\n${payload.text}`;
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
      notObservedSkills: notObservedSkillNames(rubric, answers, areaKey),
      rosterNames: otherRosterNames(r),
    }),
  });
  db().prepare("UPDATE reviews SET draft = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(draft), nowIso(), id);
  return { ok: true, provider, fellBack };
}

export function editParagraph(user: User, id: number, key: string, text: string) {
  const r = getReviewForUser(user, id);
  if (!r.draft) throw new WriteBlocked("Write the draft first.");
  const draft = JSON.parse(r.draft) as Draft;
  const rubric = reviewRubric(r);
  const { answers } = loadAnswers(id, rubric);
  if (key === "home") {
    draft.homeIdeas = text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  } else {
    const para = draft.paragraphs.find((p) => p.key === key);
    if (!para) throw new WriteBlocked("Unknown paragraph.");
    const kind = key === "opening" ? "opening" : key === "closing" ? "closing" : "area";
    para.text = text.slice(0, 2000);
    para.edited = true;
    para.flags = qualityFlags(para.text, kind, {
      neverUse: rubric.neverUse,
      notObservedSkills: notObservedSkillNames(rubric, answers, key.startsWith("area:") ? key.slice(5) : undefined),
      rosterNames: otherRosterNames(r),
    });
  }
  const now = nowIso();
  db().prepare("UPDATE reviews SET draft = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(draft), now, id);
  return { savedAt: now, flags: draft.paragraphs.find((p) => p.key === key)?.flags ?? [] };
}

/** Swapping strengths or next steps updates the closing: rewritten if untouched, otherwise marked. */
export async function setStrengths(user: User, id: number, strengths: string[], nextSteps: string[]) {
  const r = getReviewForUser(user, id);
  db()
    .prepare("UPDATE reviews SET strengths = ?, next_steps = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(strengths.slice(0, 2)), JSON.stringify(nextSteps.slice(0, 2)), nowIso(), id);
  if (!r.draft) return;
  const closing = (JSON.parse(r.draft) as Draft).paragraphs.find((p) => p.key === "closing");
  if (closing && !closing.edited) await rewriteParagraph(user, id, "closing");
  else markStale(getReviewRow(id)!, ["closing"]);
}

export function restoreDraftVersion(user: User, id: number, versionId: number) {
  const r = getReviewForUser(user, id);
  const v = db().prepare("SELECT draft FROM draft_versions WHERE id = ? AND review_id = ?").get(versionId, id) as { draft: string } | undefined;
  if (!v) throw new WriteBlocked("That version does not exist.");
  db().transaction(() => {
    if (r.draft) db().prepare("INSERT INTO draft_versions (review_id, draft, replaced_by, replaced_at) VALUES (?, ?, ?, ?)").run(id, r.draft, user.id, nowIso());
    db().prepare("UPDATE reviews SET draft = ?, updated_at = ? WHERE id = ?").run(v.draft, nowIso(), id);
  })();
}

// ─── Report data ─────────────────────────────────────────────────────────

export type ReportData = {
  reviewId: number;
  childName: string;
  childInitial: string;
  className: string;
  dateOfBirth: string;
  season: string;
  year: number;
  photoIds: number[];
  areas: {
    key: string;
    name: string;
    summary: Level | null;
    skills: { name: string; level: Level; up: boolean }[];
    moments: string[];
    /** Average of the observed skills on a 0–10 scale, one decimal; null when nothing was observed. */
    score: number | null;
    paragraph: string;
  }[];
  /** Average of the area scores; null when scores are hidden or nothing was observed. */
  overallScore: number | null;
  opening: string;
  closing: string;
  strengths: string[];
  nextSteps: string[];
  homeIdeas: string[];
  leadTeachers: string[];
  coTeachers: string[];
  version: number;
  previousSeason: string | null;
};

function areaScore(area: Rubric["areas"][number], ans: AreaAnswer | undefined): number | null {
  const levels: number[] = area.skills.map((s) => ans?.skills[s.key]?.level ?? 0).filter((l) => l > 0);
  if (!levels.length) return null;
  return Math.round((levels.reduce((n, l) => n + l, 0) / levels.length) * 2 * 10) / 10;
}

function overall(scores: (number | null)[]): number | null {
  const v = scores.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((n, x) => n + x, 0) / v.length) * 10) / 10 : null;
}

export function buildReportData(r: ReviewRow): ReportData {
  const rubric = reviewRubric(r);
  const { answers } = loadAnswers(r.id, rubric);
  const draft = r.draft ? (JSON.parse(r.draft) as Draft) : null;
  const { prev, movements } = skillMovements(r, rubric, answers);
  const records = getRecords();
  const text = (key: string) => draft?.paragraphs.find((p) => p.key === key)?.text ?? "";
  const { strengths, nextSteps } = strengthsAndNextSteps(r, rubric, answers);
  const skillName = new Map(rubric.areas.flatMap((a) => a.skills.map((s) => [s.key, s.name] as const)));
  const teachers = getSchool().teachers.split(",").map((t) => t.trim()).filter(Boolean);
  return {
    reviewId: r.id,
    childName: r.preferred_name,
    childInitial: r.preferred_name.charAt(0).toUpperCase(),
    className: getSchool().className,
    dateOfBirth: r.date_of_birth,
    season: r.season,
    year: r.year,
    photoIds: reportPhotoIds(r.id),
    areas: rubric.areas.map((a) => ({
      key: a.key,
      name: a.name,
      summary: areaSummary(a, answers[a.key]),
      skills: a.skills.map((s) => ({
        name: s.name,
        level: (answers[a.key]?.skills[s.key]?.level ?? 3) as Level,
        // Families only ever see "moved up"; never a drop.
        up: records.showProgressOnReports && movements[s.key] === "up",
      })),
      moments: answers[a.key]?.moments ?? [],
      score: records.showScoresOnReports ? areaScore(a, answers[a.key]) : null,
      paragraph: text(`area:${a.key}`),
    })),
    overallScore: records.showScoresOnReports ? overall(rubric.areas.map((a) => areaScore(a, answers[a.key]))) : null,
    opening: text("opening"),
    closing: text("closing"),
    strengths: strengths.map((k) => skillName.get(k) ?? k),
    nextSteps: nextSteps.map((k) => skillName.get(k) ?? k),
    homeIdeas: records.homeIdeasOnReports ? draft?.homeIdeas ?? [] : [],
    leadTeachers: teachers,
    coTeachers: [],
    version: r.report_version,
    previousSeason: prev?.season ?? null,
  };
}

/** Approved reports use the frozen snapshot; anything else is a live DRAFT preview. */
export function reportDataFor(r: ReviewRow): { data: ReportData; isDraft: boolean } {
  return { data: buildReportData(r), isDraft: false };
}

