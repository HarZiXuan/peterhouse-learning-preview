import type {
  AreaAnswer,
  Draft,
  Level,
  NoteDef,
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
import { areaSummary, emptyAreaAnswer, movement, readinessGaps, suggestStrengthsAndNextSteps, type Movement } from "@peterhouse/shared";
import { many, one, pool, run, tx, type Db } from "../db";
import { HttpError, notFound } from "../http";
import { reportPhotoIds } from "./photos";
import { getAi, getRecords, getRubric, getSchool } from "./school";
import { buildAnonymousPayload, restoreName, scrubText, type Roster, type ReviewForWriting } from "./anonymise";
import { openJson, openJsonOrNull, openText, sealJson, sealText } from "./records";
import { writeWithSentenceBank } from "./writer/sentence-bank";
import { getSystemPrompt, WriterError, complete, draftInstruction, paragraphInstruction, parseDraft, parseParagraph, withRetry } from "./writer/ai";
import { qualityFlags } from "./writer/quality";
import type { WrittenDraft } from "./writer/types";

export type ReviewRow = {
  id: number;
  child_id: number;
  term_id: number;
  class_id: number;
  status: ReviewStatus;
  rubric: Rubric;
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
  updated_at: string;
  // joined
  preferred_name: string;
  legal_name: string;
  date_of_birth: string;
  pronoun: Pronoun;
  photo_consent: boolean;
  child_status: "active" | "left";
  class_name: string;
  class_level: string;
  season: "June" | "December";
  year: number;
  term_status: TermStatus;
};

const REVIEW_SELECT = `
  SELECT r.id, r.child_id, r.term_id, r.class_id, r.status, r.rubric, r.highlight, r.highlight_by, r.highlight_at, r.no_photo,
         r.staff_note, r.strengths, r.next_steps, r.draft, r.report_version, r.approved_by, r.approved_at, r.updated_at,
         c.preferred_name, c.legal_name, c.date_of_birth, c.pronoun, c.photo_consent, c.status AS child_status,
         k.name AS class_name, k.level AS class_level,
         CASE t.semester WHEN 1 THEN 'June' ELSE 'December' END AS season, t.year, t.status AS term_status
  FROM reviews r
  JOIN children c ON c.id = r.child_id
  JOIN classes k ON k.id = r.class_id
  JOIN terms t ON t.id = r.term_id`;

type RawReview = Omit<ReviewRow, "rubric" | "draft"> & { rubric: Rubric | null; draft: string | null };

async function hydrate(raw: RawReview): Promise<ReviewRow> {
  return {
    ...raw,
    rubric: raw.rubric ?? (await getRubric()),
    highlight: openText(raw.highlight, "reviews.highlight"),
    staff_note: openText(raw.staff_note, "reviews.staff_note"),
    draft: openJsonOrNull<Draft>(raw.draft, "reviews.draft"),
    preferred_name: openText(raw.preferred_name, "children.preferred_name"),
    legal_name: openText(raw.legal_name, "children.legal_name"),
    date_of_birth: openText(raw.date_of_birth, "children.date_of_birth"),
  };
}

export async function getReviewRow(id: number, c?: Db): Promise<ReviewRow | null> {
  const raw = await one<RawReview>(`${REVIEW_SELECT} WHERE r.id = $1`, [id], c);
  return raw ? hydrate(raw) : null;
}

/** Does this person belong to the class? Administrators belong to every class. */
export async function canAccessClass(user: SessionUser, classId: number): Promise<boolean> {
  if (user.role === "admin") return true;
  return !!(await one("SELECT 1 FROM class_staff WHERE class_id = $1 AND user_id = $2", [classId, user.id]));
}

/** Loads a review, but only for someone allowed to see its class. A review you may not see looks like one that does not exist. */
export async function getReviewForUser(user: SessionUser, id: number, c?: Db): Promise<ReviewRow> {
  const r = await getReviewRow(id, c);
  if (!r || !(await canAccessClass(user, r.class_id))) throw notFound("This child");
  return r;
}

export const reviewRubric = (r: Pick<ReviewRow, "rubric">): Rubric => r.rubric;
export const reviewRubricNow = (): Promise<Rubric> => getRubric();

export type AreaMeta = { updatedBy: string | null; updatedAt: string | null };

type AreaRow = { review_id: number; area_key: string; data: string; updated_at: string; updated_by_name: string | null };

function buildAnswers(rubric: Rubric, rows: AreaRow[]) {
  const answers: Record<string, AreaAnswer> = {};
  const meta: Record<string, AreaMeta> = {};
  for (const a of rubric.areas) {
    const row = rows.find((r) => r.area_key === a.key);
    const stored = row ? openJson<AreaAnswer>(row.data, "review_areas.data") : null;
    const base = emptyAreaAnswer(a);
    // Questions added after this answer was saved start unanswered.
    answers[a.key] = stored ? { ...stored, skills: { ...base.skills, ...stored.skills } } : base;
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

export const EXTRA_NOTES: readonly NoteDef[] = [
  { key: "favourites", label: "What does {name} love doing at school?", hint: "Favourite activities, toys, songs, books, corners of the room", max: 400 },
  { key: "friends", label: "How does {name} play and get on with others?", hint: "Play style, friendships, how {name} joins in or leads", max: 400 },
  { key: "growing", label: "What is {name} working on, and what helps?", hint: "Something tricky or new, and what has helped so far", max: 400 },
];

export async function loadNotes(reviewId: number): Promise<Record<string, string>> {
  const rows = await many<{ key: string; text: string }>("SELECT key, text FROM review_notes WHERE review_id = $1", [reviewId]);
  return Object.fromEntries(rows.map((r) => [r.key, openText(r.text, "review_notes.text")]));
}

export async function saveNote(user: SessionUser, id: number, key: string, text: string): Promise<SaveResult> {
  const r = await getReviewForUser(user, id);
  const def = EXTRA_NOTES.find((n) => n.key === key);
  if (!def) return { ok: false, error: "Unknown question." };
  const clean = text.slice(0, def.max);
  const old = (await loadNotes(id))[key] ?? "";
  await tx(async (c) => {
    await run(
      "INSERT INTO review_notes (review_id, key, text) VALUES ($1, $2, $3) ON CONFLICT (review_id, key) DO UPDATE SET text = EXCLUDED.text",
      [id, key, sealText(clean, "review_notes.text")],
      c,
    );
    await run("UPDATE reviews SET updated_at = now() WHERE id = $1", [id], c);
    if (clean !== old) await markStale(c, r, ["opening", "closing"]);
  });
  return { ok: true, savedAt: new Date().toISOString(), status: r.status };
}

const skillSig = (rb: Rubric) => rb.areas.map((a) => `${a.key}:${a.skills.map((s) => s.key).join(",")}`).join("|");

/** A review that is not approved picks up question changes: new skills appear unanswered, old answers stay. */
export async function syncRubric(r: ReviewRow): Promise<ReviewRow> {
  if (r.status === "approved" || r.term_status !== "open") return r;
  const live = await getRubric();
  if (skillSig(live) === skillSig(r.rubric)) return r;
  await tx(async (c) => {
    await run("UPDATE reviews SET rubric = $1::jsonb, updated_at = now() WHERE id = $2", [JSON.stringify(live), r.id], c);
    await refreshStatus(c, r.id);
  });
  return (await getReviewRow(r.id))!;
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
  const r = await getReviewForUser(user, id);
  const area = r.rubric.areas.find((a) => a.key === areaKey);
  if (!area) return { ok: false, error: "Unknown area." };

  // Sanitise: only known skills, levels 0–5, moments from this area, note ≤ 400.
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

export async function saveHighlight(user: SessionUser, id: number, highlight: string): Promise<SaveResult> {
  const r = await getReviewForUser(user, id);
  const text = highlight.slice(0, 600);
  const status = await tx(async (c) => {
    await run(
      "UPDATE reviews SET highlight = $1, highlight_by = $2, highlight_at = now(), updated_at = now() WHERE id = $3",
      [sealText(text, "reviews.highlight"), user.id, id],
      c,
    );
    if (text !== r.highlight) await markStale(c, r, ["opening"]);
    await refreshStatus(c, id);
    return (await getReviewRow(id, c))!.status;
  });
  return { ok: true, savedAt: new Date().toISOString(), status };
}

export async function saveStaffNote(user: SessionUser, id: number, note: string): Promise<SaveResult> {
  const r = await getReviewForUser(user, id);
  await run("UPDATE reviews SET staff_note = $1, updated_at = now() WHERE id = $2", [sealText(note.slice(0, 2000), "reviews.staff_note"), id]);
  return { ok: true, savedAt: new Date().toISOString(), status: r.status };
}

/** The child's last approved review before this term, for "↑ since last time". */
export async function previousApproved(childId: number, termId: number) {
  const row = await one<{ id: number; rubric: Rubric; semester: number; year: number }>(
    `SELECT r.id, r.rubric, t.semester, t.year FROM reviews r JOIN terms t ON t.id = r.term_id
     WHERE r.child_id = $1 AND r.status = 'approved'
       AND (t.year * 2 + t.semester) < (SELECT year * 2 + semester FROM terms WHERE id = $2)
     ORDER BY t.year DESC, t.semester DESC LIMIT 1`,
    [childId, termId],
  );
  if (!row || !row.rubric) return null;
  const { answers } = await loadAnswers(row.id, row.rubric);
  const levels: Record<string, Level> = {};
  for (const a of row.rubric.areas)
    for (const s of a.skills) {
      const l = answers[a.key]?.skills[s.key];
      if (l?.touched && l.level > 0) levels[s.key] = l.level;
    }
  return { reviewId: row.id, season: row.semester === 1 ? "June" : "December", year: row.year, levels };
}

export async function skillMovements(r: ReviewRow, rubric: Rubric, answers: Record<string, AreaAnswer>) {
  const prev = await previousApproved(r.child_id, r.term_id);
  const out: Record<string, Movement> = {};
  for (const a of rubric.areas)
    for (const s of a.skills) {
      const now = answers[a.key]?.skills[s.key]?.level ?? 3;
      out[s.key] = prev && prev.levels[s.key] ? movement(now as Level, prev.levels[s.key]) : null;
    }
  return { prev, movements: out };
}

// ─── Writing ─────────────────────────────────────────────────────────────

export async function rosterFor(r: ReviewRow): Promise<Roster> {
  const children = await many<{ id: number; preferred_name: string; legal_name: string }>("SELECT id, preferred_name, legal_name FROM children");
  const staff = await many<{ name: string }>("SELECT name FROM users");
  return {
    child: [r.preferred_name, r.legal_name],
    otherChildren: children
      .filter((c) => c.id !== r.child_id)
      .flatMap((c) => [openText(c.preferred_name, "children.preferred_name"), openText(c.legal_name, "children.legal_name")]),
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
    input: { pronoun: r.pronoun, season: r.season, highlight: r.highlight, notes: await loadNotes(r.id), rubric, answers, strengths, nextSteps },
  };
}

function notObservedSkillNames(rubric: Rubric, answers: Record<string, AreaAnswer>, areaKey?: string) {
  return rubric.areas
    .filter((a) => !areaKey || a.key === areaKey)
    .flatMap((a) => a.skills.filter((s) => answers[a.key]?.skills[s.key]?.level === 0).map((s) => s.name));
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

/** Writes (or rewrites) the whole draft. The previous version is always kept. */
export async function writeDraft(user: SessionUser, id: number, opts: { provider?: "sentence_bank" } = {}): Promise<WriteOutcome> {
  const r = await getReviewForUser(user, id);
  if (r.status !== "ready" && r.status !== "written") {
    return { ok: false, error: "This review is not ready yet. Finish the readiness check first." };
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
      "UPDATE reviews SET draft = $1, status = 'written', strengths = $2::jsonb, next_steps = $3::jsonb, updated_at = now() WHERE id = $4",
      [sealJson(draft, "reviews.draft"), JSON.stringify(input.strengths), JSON.stringify(input.nextSteps), id],
      c,
    );
  });
  return { ok: true, provider, fellBack };
}

/** Rewrites one paragraph without touching the teacher's edits elsewhere. */
export async function rewriteParagraph(user: SessionUser, id: number, key: string, tone?: string): Promise<WriteOutcome> {
  const r = await getReviewForUser(user, id);
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
      rosterNames: await otherRosterNames(r),
    }),
  });
  await storeDraft(pool, id, draft);
  return { ok: true, provider, fellBack };
}

export async function editParagraph(user: SessionUser, id: number, key: string, text: string) {
  const r = await getReviewForUser(user, id);
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
      notObservedSkills: notObservedSkillNames(r.rubric, answers, key.startsWith("area:") ? key.slice(5) : undefined),
      rosterNames: await otherRosterNames(r),
    });
  }
  await run("UPDATE reviews SET draft = $1, updated_at = now() WHERE id = $2", [sealJson(draft, "reviews.draft"), id]);
  return { savedAt: new Date().toISOString(), flags: draft.paragraphs.find((p) => p.key === key)?.flags ?? [] };
}

/** Swapping strengths or next steps updates the closing: rewritten if untouched, otherwise marked. */
export async function setStrengths(user: SessionUser, id: number, strengths: string[], nextSteps: string[]) {
  const r = await getReviewForUser(user, id);
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
  const r = await getReviewForUser(user, id);
  const v = await one<{ draft: string }>("SELECT draft FROM draft_versions WHERE id = $1 AND review_id = $2", [versionId, id]);
  if (!v) throw new WriteBlocked("That version does not exist.");
  await tx(async (c) => {
    if (r.draft) await run("INSERT INTO draft_versions (review_id, draft, replaced_by) VALUES ($1, $2, $3)", [id, sealJson(r.draft, "draft_versions.draft"), user.id], c);
    // The stored version was sealed under another column name, so re-seal it for reviews.draft.
    await run("UPDATE reviews SET draft = $1, updated_at = now() WHERE id = $2", [sealJson(openJson(v.draft, "draft_versions.draft"), "reviews.draft"), id], c);
  });
}

// ─── Report data ─────────────────────────────────────────────────────────

function areaScore(area: Rubric["areas"][number], ans: AreaAnswer | undefined): number | null {
  const levels: number[] = area.skills.map((s) => ans?.skills[s.key]?.level ?? 0).filter((l) => l > 0);
  if (!levels.length) return null;
  return Math.round((levels.reduce((n, l) => n + l, 0) / levels.length) * 2 * 10) / 10;
}

function overall(scores: (number | null)[]): number | null {
  const v = scores.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((n, x) => n + x, 0) / v.length) * 10) / 10 : null;
}

export async function buildReportData(r: ReviewRow): Promise<ReportData> {
  const rubric = r.rubric;
  const { answers } = await loadAnswers(r.id, rubric);
  const draft = r.draft;
  const { prev, movements } = await skillMovements(r, rubric, answers);
  const records = await getRecords();
  const school = await getSchool();
  const text = (key: string) => draft?.paragraphs.find((p) => p.key === key)?.text ?? "";
  const { strengths, nextSteps } = strengthsAndNextSteps(r, rubric, answers);
  const skillName = new Map(rubric.areas.flatMap((a) => a.skills.map((s) => [s.key, s.name] as const)));
  const teachers = school.teachers.split(",").map((t) => t.trim()).filter(Boolean);
  return {
    reviewId: r.id,
    childName: r.preferred_name,
    childInitial: [...r.preferred_name][0]?.toUpperCase() ?? "",
    className: school.className,
    dateOfBirth: r.date_of_birth,
    season: r.season,
    year: r.year,
    photoIds: await reportPhotoIds(r.id),
    areas: rubric.areas.map((a) => ({
      key: a.key,
      name: a.name,
      summary: areaSummary(a, answers[a.key]),
      skills: a.skills.map((s) => ({
        name: s.name,
        level: (answers[a.key]?.skills[s.key]?.level ?? 3) as Level,
        // Families only ever see "moved up"; never a drop.
        up: records.showProgressOnReports && movements[s.key] === "up",
        previous: prev?.levels[s.key] ?? null,
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
