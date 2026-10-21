// The questions teachers answer (Teacher Questions v0.3, section 4).
//
// The administrator edits a DRAFT (the domains and questions tables). Publishing freezes the draft into
// rubric_versions; a review copies the latest version the first time it is opened and keeps it, so later edits
// never change a past or in-progress report. Question keys are permanent: rewording keeps the key (scores still
// compare across semesters), a different skill gets a new key (no misleading comparison).

import type { Area, AuditEntry, DraftDomain, QuestionBankView, QuestionChange, Rubric, SessionUser } from "@peterhouse/shared";
import { DEFAULT_RUBRIC, NEVER_USE, QUESTIONS_MAX, QUESTIONS_MIN, SCALE, normaliseRubric } from "@peterhouse/shared";
import { audit } from "../audit";
import { many, one, pool, run, tx, type Db } from "../db";
import { HttpError } from "../http";
import type { Request } from "express";

type DomainRow = {
  id: number;
  key: string;
  name: string;
  short_name: string;
  sub_name: string | null;
  icon: string | null;
  position: number;
  love_key: string | null;
  love_text: string | null;
  home_ideas: string[] | null;
};
type QuestionRow = { id: number; domain_id: number; key: string; text_template: string; position: number; active: boolean; retired_at: string | null };
type VersionRow = { id: number; version: number; snapshot: Rubric; created_at: string; created_by: number | null };

const SEED_LOCK = 7_201_027;
const TEXT_MAX = 200;
const HOME_IDEA_MAX = 120;
const HOME_IDEAS_MAX = 12;

// ─── Seeding ─────────────────────────────────────────────────────────────

let seeded: Promise<void> | null = null;

/** On first use, copies the starting questions (spec section 2) into the draft and publishes them as v1. */
export function ensureQuestionBank(): Promise<void> {
  seeded ??= seed().catch((e) => {
    seeded = null;
    throw e;
  });
  return seeded;
}

async function seed() {
  await tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock($1)", [SEED_LOCK]);
    if (await one("SELECT 1 FROM rubric_versions LIMIT 1", [], c)) return;
    if (!(await one("SELECT 1 FROM domains LIMIT 1", [], c))) {
      for (const [i, a] of DEFAULT_RUBRIC.areas.entries()) {
        const d = await one<{ id: number }>(
          `INSERT INTO domains (key, name, short_name, sub_name, icon, position, love_key, love_text, home_ideas)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) RETURNING id`,
          [a.key, a.name, a.shortName, a.subName ?? null, a.icon ?? null, i, a.love?.key ?? null, a.love?.text ?? null, a.homeIdeas ? JSON.stringify(a.homeIdeas) : null],
          c,
        );
        for (const [j, s] of a.skills.entries()) {
          await run("INSERT INTO questions (domain_id, key, text_template, position) VALUES ($1, $2, $3, $4)", [d!.id, s.key, s.text, j], c);
        }
      }
    }
    await insertVersion(c, await draftRubric(c), null);
  });
}

// ─── Reading ─────────────────────────────────────────────────────────────

async function loadDraft(c: Db = pool) {
  const domains = await many<DomainRow>("SELECT * FROM domains ORDER BY position, id", [], c);
  const questions = await many<QuestionRow>("SELECT id, domain_id, key, text_template, position, active, retired_at FROM questions ORDER BY position, id", [], c);
  return { domains, questions };
}

function toArea(d: DomainRow, qs: QuestionRow[]): Area {
  return {
    key: d.key,
    name: d.name,
    shortName: d.short_name,
    ...(d.sub_name ? { subName: d.sub_name } : {}),
    ...(d.icon ? { icon: d.icon } : {}),
    skills: qs.filter((q) => q.domain_id === d.id && q.active).map((q) => ({ key: q.key, text: q.text_template })),
    ...(d.love_key && d.love_text ? { love: { key: d.love_key, text: d.love_text } } : {}),
    ...(d.home_ideas ? { homeIdeas: d.home_ideas } : {}),
  };
}

/** The draft as a question set, numbered as the next version. */
async function draftRubric(c: Db = pool): Promise<Rubric> {
  const { domains, questions } = await loadDraft(c);
  const last = await one<{ version: number }>("SELECT max(version) AS version FROM rubric_versions", [], c);
  return { version: (last?.version ?? 0) + 1, areas: domains.map((d) => toArea(d, questions)), neverUse: NEVER_USE };
}

async function latestVersion(c: Db = pool): Promise<VersionRow> {
  await ensureQuestionBank();
  const row = await one<VersionRow>("SELECT id, version, snapshot, created_at, created_by FROM rubric_versions ORDER BY version DESC LIMIT 1", [], c);
  return { ...row!, snapshot: normaliseRubric(row!.snapshot) };
}

/** The question set new reviews are opened with. */
export async function publishedRubric(c: Db = pool): Promise<{ id: number; rubric: Rubric }> {
  const v = await latestVersion(c);
  return { id: v.id, rubric: v.snapshot };
}

// ─── Comparing the draft with what is live ───────────────────────────────

/** Every question key that has ever been published, so a key that comes back counts as restored. */
async function everPublishedKeys(c: Db = pool): Promise<Set<string>> {
  const rows = await many<{ key: string }>(
    "SELECT DISTINCT s ->> 'key' AS key FROM rubric_versions v, jsonb_array_elements(v.snapshot -> 'areas') a, jsonb_array_elements(a -> 'skills') s",
    [],
    c,
  );
  return new Set(rows.map((r) => r.key));
}

function diff(live: Rubric, draft: Rubric, everPublished: Set<string>): QuestionChange[] {
  const changes: QuestionChange[] = [];
  const liveSkill = new Map(live.areas.flatMap((a) => a.skills.map((s) => [s.key, { area: a, skill: s }] as const)));
  const draftKeys = new Set(draft.areas.flatMap((a) => a.skills.map((s) => s.key)));
  for (const a of draft.areas) {
    const la = live.areas.find((x) => x.key === a.key);
    for (const s of a.skills) {
      const was = liveSkill.get(s.key);
      if (!was) {
        changes.push(
          everPublished.has(s.key)
            ? { kind: "restored", areaKey: a.key, areaName: a.name, key: s.key, text: s.text, was: null, effect: "Comes back. Earlier scores for it compare again." }
            : { kind: "added", areaKey: a.key, areaName: a.name, key: s.key, text: s.text, was: null, effect: "New skill. The next report shows no comparison for it." },
        );
      } else if (was.skill.text !== s.text) {
        changes.push({ kind: "reworded", areaKey: a.key, areaName: a.name, key: s.key, text: s.text, was: was.skill.text, effect: "Same skill. Earlier scores still compare." });
      }
    }
    if (la) {
      const kept = la.skills.map((s) => s.key).filter((k) => a.skills.some((s) => s.key === k));
      const nowOrder = a.skills.map((s) => s.key).filter((k) => kept.includes(k));
      if (kept.join() !== nowOrder.join()) {
        changes.push({ kind: "reordered", areaKey: a.key, areaName: a.name, key: null, text: `New order: ${a.skills.map((s) => s.key).join(", ")}`, was: null, effect: "Only the order on the form changes." });
      }
      if ((la.love?.text ?? null) !== (a.love?.text ?? null) && a.love) {
        changes.push({ kind: "prompt", areaKey: a.key, areaName: a.name, key: a.love.key, text: a.love.text, was: la.love?.text ?? null, effect: "New wording for the short answer." });
      }
      if (JSON.stringify(la.homeIdeas ?? null) !== JSON.stringify(a.homeIdeas ?? null)) {
        changes.push({ kind: "home", areaKey: a.key, areaName: a.name, key: null, text: (a.homeIdeas ?? []).join(" · "), was: (la.homeIdeas ?? []).join(" · "), effect: "Teachers pick from the new list." });
      }
    }
  }
  for (const [key, { area, skill }] of liveSkill) {
    if (!draftKeys.has(key)) {
      changes.push({ kind: "retired", areaKey: area.key, areaName: area.name, key, text: skill.text, was: null, effect: "Hidden from new reviews. Stays in past reports and history." });
    }
  }
  return changes;
}

function problemsOf(draft: Rubric): string[] {
  const out: string[] = [];
  for (const a of draft.areas) {
    if (a.skills.length < QUESTIONS_MIN) out.push(`${a.name} has ${a.skills.length} question${a.skills.length === 1 ? "" : "s"}; it needs at least ${QUESTIONS_MIN}.`);
    if (a.skills.length > QUESTIONS_MAX) out.push(`${a.name} has ${a.skills.length} questions; the most is ${QUESTIONS_MAX}.`);
    for (const s of a.skills) if (!s.text.includes("{name}")) out.push(`${s.key} needs {name} where the child's name goes.`);
    if (a.homeIdeas && a.homeIdeas.length === 0) out.push(`${a.name} needs at least one idea to try at home.`);
  }
  return out;
}

// ─── The admin page ──────────────────────────────────────────────────────

export async function questionBank(): Promise<QuestionBankView> {
  const live = await latestVersion();
  const draft = await draftRubric();
  const { domains, questions } = await loadDraft();
  const changes = diff(live.snapshot, draft, await everPublishedKeys());
  const liveSkill = new Map(live.snapshot.areas.flatMap((a) => a.skills.map((s) => [s.key, s.text] as const)));
  const by = live.created_by ? await one<{ name: string }>("SELECT name FROM users WHERE id = $1", [live.created_by]) : null;
  const usage = await one<{ n: number }>("SELECT count(*)::int AS n FROM reviews WHERE rubric_version_id = $1", [live.id]);
  const open = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM reviews r JOIN terms t ON t.id = r.term_id
     WHERE t.status = 'open' AND r.rubric IS NOT NULL AND r.status <> 'approved'`,
  );
  const activity = await many<{ id: number; at: string; user_name: string | null; action: string; detail: string }>(
    `SELECT a.id, a.at, u.name AS user_name, a.action, a.detail FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.action LIKE 'questions.%' ORDER BY a.id DESC LIMIT 30`,
  );
  const liveArea = new Map(live.snapshot.areas.map((a) => [a.key, a]));
  const view: DraftDomain[] = domains.map((d) => {
    const area = toArea(d, questions);
    const la = liveArea.get(d.key);
    return {
      key: d.key,
      name: d.name,
      shortName: d.short_name,
      subName: d.sub_name,
      icon: d.icon,
      questions: area.skills.map((s) => {
        const was = liveSkill.get(s.key);
        return { key: s.key, text: s.text, change: was === undefined ? "added" : was !== s.text ? "reworded" : null, was: was !== undefined && was !== s.text ? was : null };
      }),
      retired: questions
        .filter((q) => q.domain_id === d.id && !q.active)
        .map((q) => ({ key: q.key, text: q.text_template, retiredAt: q.retired_at })),
      love: area.love ? { ...area.love, was: la?.love && la.love.text !== area.love.text ? la.love.text : null } : null,
      homeIdeas: area.homeIdeas ?? null,
      homeChanged: JSON.stringify(la?.homeIdeas ?? null) !== JSON.stringify(area.homeIdeas ?? null),
    };
  });
  return {
    live: { version: live.version, publishedAt: live.created_at, publishedBy: by?.name ?? null, reviews: usage?.n ?? 0 },
    domains: view,
    changes,
    problems: problemsOf(draft),
    openReviews: open?.n ?? 0,
    preview: draft,
    activity: activity.map((r): AuditEntry => ({ id: r.id, at: r.at, userName: r.user_name, action: r.action, detail: r.detail })),
    scale: SCALE.map((s) => ({ ...s })),
  };
}

// ─── Editing the draft ───────────────────────────────────────────────────

function cleanText(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) throw new HttpError(400, "Please type the question.");
  if (t.length > TEXT_MAX) throw new HttpError(400, `Keep a question under ${TEXT_MAX} characters.`);
  if (!t.includes("{name}")) throw new HttpError(400, "Put {name} where the child's name goes, e.g. “{name} counts objects one by one.”");
  // End with a full stop unless it already ends a sentence ("…bigger”)." stays as it is).
  return /[.!?…]["”')]*$/.test(t) ? t : `${t}.`;
}

async function domainByKey(c: Db, key: string): Promise<DomainRow> {
  const d = await one<DomainRow>("SELECT * FROM domains WHERE key = $1", [key], c);
  if (!d) throw new HttpError(404, "That domain could not be found.");
  return d;
}

async function questionByKey(c: Db, key: string): Promise<QuestionRow> {
  const q = await one<QuestionRow>("SELECT id, domain_id, key, text_template, position, active, retired_at FROM questions WHERE key = $1", [key], c);
  if (!q) throw new HttpError(404, "That question could not be found.");
  return q;
}

const activeCount = async (c: Db, domainId: number) =>
  (await one<{ n: number }>("SELECT count(*)::int AS n FROM questions WHERE domain_id = $1 AND active", [domainId], c))!.n;

/** The next unused key in a domain: mat_5 after mat_1…mat_4, never reusing a retired one. */
async function nextKey(c: Db, d: DomainRow): Promise<string> {
  const rows = await many<{ key: string }>("SELECT key FROM questions WHERE domain_id = $1", [d.id], c);
  const used = new Set([...rows.map((r) => r.key), ...(await everPublishedKeys(c))]);
  let n = Math.max(0, ...rows.map((r) => Number(/_(\d+)$/.exec(r.key)?.[1] ?? 0)).filter(Number.isFinite)) + 1;
  while (used.has(`${d.key}_${n}`)) n++;
  return `${d.key}_${n}`;
}

const nextPosition = async (c: Db, domainId: number) =>
  (await one<{ p: number }>("SELECT COALESCE(max(position), -1) + 1 AS p FROM questions WHERE domain_id = $1", [domainId], c))!.p;

export async function addQuestion(req: Request, user: SessionUser, areaKey: string, text: string): Promise<string> {
  const clean = cleanText(text);
  return tx(async (c) => {
    const d = await domainByKey(c, areaKey);
    if ((await activeCount(c, d.id)) >= QUESTIONS_MAX) throw new HttpError(400, `${d.name} already has ${QUESTIONS_MAX} questions, the most allowed.`);
    const key = await nextKey(c, d);
    await run("INSERT INTO questions (domain_id, key, text_template, position) VALUES ($1, $2, $3, $4)", [d.id, key, clean, await nextPosition(c, d.id)], c);
    await audit(req, user.id, "questions.added", { detail: key }, c);
    return key;
  });
}

/**
 * Rewords a question. Same skill: the key stays, so earlier scores still compare. A different skill: the old
 * question is retired and a new one with a new key takes its place, so the next report shows no comparison.
 * Returns the key the question now has.
 */
export async function rewordQuestion(req: Request, user: SessionUser, key: string, text: string, sameSkill: boolean): Promise<string> {
  const clean = cleanText(text);
  return tx(async (c) => {
    const q = await questionByKey(c, key);
    if (!q.active) throw new HttpError(400, "Restore this question before changing it.");
    if (q.text_template === clean) return key;
    // A question that was never published has no history to protect, so it is simply edited.
    if (sameSkill || !(await everPublishedKeys(c)).has(key)) {
      await run("UPDATE questions SET text_template = $1 WHERE id = $2", [clean, q.id], c);
      await audit(req, user.id, "questions.reworded", { detail: key }, c);
      return key;
    }
    const d = (await one<DomainRow>("SELECT * FROM domains WHERE id = $1", [q.domain_id], c))!;
    const newKey = await nextKey(c, d);
    await run("UPDATE questions SET active = false, retired_at = now() WHERE id = $1", [q.id], c);
    await run("INSERT INTO questions (domain_id, key, text_template, position) VALUES ($1, $2, $3, $4)", [d.id, newKey, clean, q.position], c);
    await audit(req, user.id, "questions.replaced", { detail: `${key} → ${newKey}` }, c);
    return newKey;
  });
}

export async function retireQuestion(req: Request, user: SessionUser, key: string) {
  await tx(async (c) => {
    const q = await questionByKey(c, key);
    if (!q.active) return;
    const d = (await one<DomainRow>("SELECT * FROM domains WHERE id = $1", [q.domain_id], c))!;
    if ((await activeCount(c, d.id)) <= QUESTIONS_MIN) {
      throw new HttpError(400, `${d.name} needs at least ${QUESTIONS_MIN} questions. Add another before retiring this one.`);
    }
    if (!(await everPublishedKeys(c)).has(key)) {
      // Never reached a review, so there is no history to keep.
      await run("DELETE FROM questions WHERE id = $1", [q.id], c);
      await audit(req, user.id, "questions.removed", { detail: key }, c);
      return;
    }
    await run("UPDATE questions SET active = false, retired_at = now() WHERE id = $1", [q.id], c);
    await audit(req, user.id, "questions.retired", { detail: key }, c);
  });
}

export async function restoreQuestion(req: Request, user: SessionUser, key: string) {
  await tx(async (c) => {
    const q = await questionByKey(c, key);
    if (q.active) return;
    const d = (await one<DomainRow>("SELECT * FROM domains WHERE id = $1", [q.domain_id], c))!;
    if ((await activeCount(c, d.id)) >= QUESTIONS_MAX) throw new HttpError(400, `${d.name} already has ${QUESTIONS_MAX} questions. Retire one first.`);
    await run("UPDATE questions SET active = true, retired_at = NULL, position = $1 WHERE id = $2", [await nextPosition(c, d.id), q.id], c);
    await audit(req, user.id, "questions.restored", { detail: key }, c);
  });
}

export async function moveQuestion(req: Request, user: SessionUser, key: string, direction: "up" | "down") {
  await tx(async (c) => {
    const q = await questionByKey(c, key);
    const list = await many<QuestionRow>("SELECT id, domain_id, key, text_template, position, active, retired_at FROM questions WHERE domain_id = $1 AND active ORDER BY position, id", [q.domain_id], c);
    const i = list.findIndex((x) => x.id === q.id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    for (const [p, row] of list.entries()) await run("UPDATE questions SET position = $1 WHERE id = $2", [p, row.id], c);
    await audit(req, user.id, "questions.moved", { detail: `${key} ${direction}` }, c);
  });
}

export async function updateDomainExtras(req: Request, user: SessionUser, areaKey: string, patch: { loveText?: string; homeIdeas?: string[] }) {
  await tx(async (c) => {
    const d = await domainByKey(c, areaKey);
    if (patch.loveText !== undefined) {
      if (!d.love_key) throw new HttpError(400, `${d.name} has no short answer question.`);
      const clean = cleanText(patch.loveText);
      await run("UPDATE domains SET love_text = $1 WHERE id = $2", [clean, d.id], c);
      await audit(req, user.id, "questions.prompt_changed", { detail: d.love_key }, c);
    }
    if (patch.homeIdeas !== undefined) {
      if (!d.home_ideas) throw new HttpError(400, `${d.name} has no home ideas.`);
      const ideas = [...new Set(patch.homeIdeas.map((h) => h.replace(/\s+/g, " ").trim()).filter(Boolean))];
      if (!ideas.length) throw new HttpError(400, "Keep at least one idea to try at home.");
      if (ideas.length > HOME_IDEAS_MAX) throw new HttpError(400, `Up to ${HOME_IDEAS_MAX} home ideas.`);
      if (ideas.some((h) => h.length > HOME_IDEA_MAX)) throw new HttpError(400, `Keep each idea under ${HOME_IDEA_MAX} characters.`);
      await run("UPDATE domains SET home_ideas = $1::jsonb WHERE id = $2", [JSON.stringify(ideas), d.id], c);
      await audit(req, user.id, "questions.home_ideas_changed", { detail: `${d.key}, ${ideas.length} ideas` }, c);
    }
  });
}

/** Throws away every unpublished change: the draft goes back to the live version. */
export async function discardDraft(req: Request, user: SessionUser) {
  const live = await latestVersion();
  await tx(async (c) => {
    const ever = await everPublishedKeys(c);
    const liveKeys = new Set<string>();
    for (const a of live.snapshot.areas) {
      const d = await domainByKey(c, a.key);
      await run("UPDATE domains SET love_text = $1, home_ideas = $2::jsonb WHERE id = $3", [a.love?.text ?? d.love_text, a.homeIdeas ? JSON.stringify(a.homeIdeas) : d.home_ideas ? JSON.stringify(d.home_ideas) : null, d.id], c);
      for (const [p, s] of a.skills.entries()) {
        liveKeys.add(s.key);
        await run("UPDATE questions SET text_template = $1, position = $2, active = true, retired_at = NULL WHERE key = $3", [s.text, p, s.key], c);
      }
    }
    for (const q of await many<{ id: number; key: string; active: boolean }>("SELECT id, key, active FROM questions", [], c)) {
      if (liveKeys.has(q.key)) continue;
      if (!ever.has(q.key)) await run("DELETE FROM questions WHERE id = $1", [q.id], c);
      else if (q.active) await run("UPDATE questions SET active = false, retired_at = now() WHERE id = $1", [q.id], c);
    }
    await audit(req, user.id, "questions.discarded", {}, c);
  });
}

async function insertVersion(c: Db, rubric: Rubric, userId: number | null): Promise<number> {
  const row = await one<{ id: number }>("INSERT INTO rubric_versions (version, snapshot, created_by) VALUES ($1, $2::jsonb, $3) RETURNING id", [rubric.version, JSON.stringify(rubric), userId], c);
  return row!.id;
}

/** Freezes the draft as the next version. Reviews already opened keep the version they started with. */
export async function publishQuestions(req: Request, user: SessionUser): Promise<{ version: number; changes: number }> {
  // Seed outside the transaction: seeding takes the same lock.
  await ensureQuestionBank();
  return tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock($1)", [SEED_LOCK]);
    const live = await latestVersion(c);
    const draft = await draftRubric(c);
    const problems = problemsOf(draft);
    if (problems.length) throw new HttpError(400, problems[0]);
    const changes = diff(live.snapshot, draft, await everPublishedKeys(c));
    if (!changes.length) throw new HttpError(400, "There are no changes to publish.");
    await insertVersion(c, draft, user.id);
    await audit(req, user.id, "questions.published", { detail: `v${draft.version}, ${changes.length} change${changes.length === 1 ? "" : "s"}` }, c);
    return { version: draft.version, changes: changes.length };
  });
}
