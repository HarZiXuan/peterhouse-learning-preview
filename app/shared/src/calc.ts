// Section 05: every calculation the system makes. Pure functions only, so they
// can be tested and shared between the form, the draft and the report.

import { LEVELS, NOT_SEEN, SCALE, type Area, type AreaAnswer, type Level, type Pronoun, type Rubric, type Skill } from "./types";

/** The anchor label families and teachers see: "Confidently", or "Not seen yet". Never the number. */
export function levelWord(level: Level): string {
  return level === 0 ? NOT_SEEN.label : LEVELS[level - 1];
}

/** The tooltip meaning for a score. */
export function levelMeaning(level: Level): string {
  return level === 0 ? NOT_SEEN.meaning : SCALE[level - 1].meaning;
}

const PRONOUN_FORMS: Record<string, Record<Pronoun, string>> = {
  "he/she": { she: "she", he: "he" },
  "him/her": { she: "her", he: "him" },
  "his/her": { she: "her", he: "his" },
  // Questions frozen in older reviews spelled the tokens with a third form; they read the same.
  "he/she/they": { she: "she", he: "he" },
  "him/her/them": { she: "her", he: "him" },
  "his/her/their": { she: "her", he: "his" },
  // Chinese questions: 他 or 她.
  "他/她": { she: "她", he: "他" },
};

/** Fills a question template: {name} becomes the child's preferred name and {he/she}, {him/her}, {his/her} (or {他/她}) the pronoun. */
export function fillTemplate(text: string, name: string, pronoun: Pronoun): string {
  let out = text.replace(/\{name\}/g, name);
  for (const [token, forms] of Object.entries(PRONOUN_FORMS)) out = out.split(`{${token}}`).join(forms[pronoun]);
  return out;
}

const HAN = /\p{Script=Han}/u;

/** Is this text written in Chinese? */
export const isChineseText = (text: string) => HAN.test(text);

/**
 * "{name} listens well and responds in a group." → "listens well and responds in a group";
 * "{name}能听懂简单的华语指令。" → "能听懂简单的华语指令" (for the writer and lists).
 */
export function skillPhrase(skill: Skill, pronoun: Pronoun): string {
  const chinese = isChineseText(skill.text);
  return fillTemplate(skill.text, "\u0001", pronoun)
    .replace(/^\s*\u0001\s*/, "")
    .replace(/\u0001/g, chinese ? "孩子" : "the child")
    .replace(/[.!?。！？\s]+$/u, "");
}

export function emptyAreaAnswer(area: Area): AreaAnswer {
  return {
    skills: Object.fromEntries(area.skills.map((s) => [s.key, { level: 0, touched: false }])),
    note: "",
    visited: false,
    ...(area.love ? { love: "" } : {}),
    ...(area.homeIdeas ? { home: [] } : {}),
  };
}

/** The score that counts: only a touched rating, and 0 for "Not seen yet" or not rated. */
export function scoreOf(answer: AreaAnswer | undefined, skillKey: string): Level {
  const a = answer?.skills[skillKey];
  return a?.touched ? a.level : 0;
}

export type AreaProgress = { rated: number; notSeen: number; todo: number; total: number };

export function areaProgress(area: Area, answer: AreaAnswer | undefined): AreaProgress {
  let rated = 0;
  let notSeen = 0;
  for (const s of area.skills) {
    const a = answer?.skills[s.key];
    if (!a?.touched) continue;
    if (a.level > 0) rated++;
    else notSeen++;
  }
  return { rated, notSeen, todo: area.skills.length - rated - notSeen, total: area.skills.length };
}

/** Median of observed skills; null with fewer than two observed. With an even count, the lower (gentler) one. */
export function areaSummary(area: Area, answer: AreaAnswer | undefined): Level | null {
  if (!answer) return null;
  const observed = area.skills
    .map((s) => scoreOf(answer, s.key))
    .filter((l): l is Exclude<Level, 0> => l > 0)
    .sort((a, b) => a - b);
  if (observed.length < 2) return null;
  return observed[Math.floor((observed.length - 1) / 2)];
}

export type Movement = "up" | "same" | "down" | null;

export function movement(now: Level, before: Level | undefined): Movement {
  if (!before || !now) return null;
  if (now > before) return "up";
  if (now < before) return "down";
  return "same";
}

export type SkillRef = { areaKey: string; skillKey: string; skill: Skill; level: Level };

export function allSkills(rubric: Rubric, answers: Record<string, AreaAnswer>): SkillRef[] {
  return rubric.areas.flatMap((a) => a.skills.map((s) => ({ areaKey: a.key, skillKey: s.key, skill: s, level: scoreOf(answers[a.key], s.key) })));
}

/** Two highest skills as strengths; one or two lowest as next steps. Stable on ties (question order). */
export function suggestStrengthsAndNextSteps(rubric: Rubric, answers: Record<string, AreaAnswer>) {
  const observed = allSkills(rubric, answers).filter((s) => s.level > 0);
  const byHigh = [...observed].sort((a, b) => b.level - a.level);
  const strengths = byHigh.slice(0, 2).filter((s) => s.level >= 3).map((s) => s.skillKey);
  const rest = observed.filter((s) => !strengths.includes(s.skillKey));
  const byLow = [...rest].sort((a, b) => a.level - b.level);
  const lowest = byLow[0];
  const nextSteps: string[] = [];
  if (lowest) {
    nextSteps.push(lowest.skillKey);
    const second = byLow[1];
    // A second next step only when it is genuinely as low as the first.
    if (second && second.level === lowest.level) nextSteps.push(second.skillKey);
  }
  return { strengths, nextSteps };
}

export type ReadinessGap = { key: string; label: string };

/** The report can be written once every statement is rated or marked "Not seen yet". */
export function readinessGaps(rubric: Rubric, answers: Record<string, AreaAnswer>): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];
  for (const a of rubric.areas) {
    const { todo, total } = areaProgress(a, answers[a.key]);
    if (todo === total) gaps.push({ key: a.key, label: `${a.shortName}: nothing rated yet` });
    else if (todo > 0) gaps.push({ key: a.key, label: `${a.shortName}: ${todo} still to rate` });
  }
  return gaps;
}

/** Age in years and months, for the report cover. */
export function ageYearsMonths(dob: string, at: Date = new Date()): string {
  const d = new Date(dob + "T00:00:00");
  let months = (at.getFullYear() - d.getFullYear()) * 12 + (at.getMonth() - d.getMonth());
  if (at.getDate() < d.getDate()) months -= 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = `${y} year${y === 1 ? "" : "s"}`;
  return m ? `${ys} ${m} month${m === 1 ? "" : "s"}` : ys;
}

/**
 * Staff screens add the surname initial when two children share a preferred
 * name ("Mia T.", "Mia L."). Legal names come in many orders (Mia Tan Li Ying,
 * Arjun Nair, Nur Aisyah binte Rahman), so the first word after the preferred
 * name is tried, then the last word, then each word in turn, until the
 * initials tell the children apart.
 */
export function staffDisplayNames<T extends { child_id: number; preferred_name: string; legal_name: string }>(
  children: T[],
): Map<number, string> {
  const groups = new Map<string, T[]>();
  for (const c of children) {
    const k = c.preferred_name.toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const out = new Map<number, string>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.set(group[0].child_id, group[0].preferred_name);
      continue;
    }
    const others = (c: T) => {
      const words = c.legal_name.trim().split(/\s+/);
      const rest = words.filter((w) => w.toLowerCase() !== c.preferred_name.toLowerCase());
      return [rest[0], words[words.length - 1], ...rest].filter(Boolean);
    };
    const maxTries = Math.max(...group.map((c) => others(c).length));
    let chosen = group.map((c) => others(c)[0] ?? "");
    for (let t = 0; t < maxTries; t++) {
      const attempt = group.map((c) => others(c)[t] ?? others(c)[0] ?? "");
      const initials = attempt.map((w) => w.charAt(0).toUpperCase());
      chosen = attempt;
      if (new Set(initials).size === initials.length) break;
    }
    group.forEach((c, i) => out.set(c.child_id, `${c.preferred_name} ${chosen[i].charAt(0).toUpperCase()}.`));
  }
  return out;
}

export function termLabel(t: { season: string; year: number }) {
  return `${t.season} ${t.year}`;
}

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Length of Chinese text: each character counts, and any English word in it counts once. */
export function countChineseChars(text: string) {
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latin = text.match(/[A-Za-z]+/g)?.length ?? 0;
  return han + latin;
}

/** "June" is Semester 1 (January to June), "December" is Semester 2 (July to December). */
/** "December 2026 reports": how staff screens name a reporting period, instead of "Semester 2 2026". */
export const reportPeriod = (season: string, year: number) => `${season} ${year} reports`;

export function semesterLabel(season: string): string {
  return season === "June" ? "Semester 1" : season === "December" ? "Semester 2" : season;
}
