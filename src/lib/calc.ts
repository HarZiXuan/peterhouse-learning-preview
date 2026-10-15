// Section 05: every calculation the system makes. Pure functions only, so they
// can be tested and shared between the form, the draft and the report.

import { DEFAULT_LEVEL, LEVELS, type Area, type AreaAnswer, type Level, type Rubric } from "./types";

export function levelWord(level: Level): string {
  return level === 0 ? "Not yet observed" : LEVELS[level - 1];
}

export function emptyAreaAnswer(area: Area): AreaAnswer {
  return {
    skills: Object.fromEntries(area.skills.map((s) => [s.key, { level: DEFAULT_LEVEL }])),
    moments: [],
    note: "",
    visited: false,
  };
}

/** Median of observed skills; null with fewer than two observed. With two, the lower (gentler) one. */
export function areaSummary(area: Area, answer: AreaAnswer | undefined): Level | null {
  if (!answer) return null;
  const observed = area.skills
    .map((s) => answer.skills[s.key]?.level ?? DEFAULT_LEVEL)
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

export type SkillRef = { areaKey: string; skillKey: string; name: string; level: Level };

export function allSkills(rubric: Rubric, answers: Record<string, AreaAnswer>): SkillRef[] {
  return rubric.areas.flatMap((a) =>
    a.skills.map((s) => ({
      areaKey: a.key,
      skillKey: s.key,
      name: s.name,
      level: (answers[a.key]?.skills[s.key]?.level ?? DEFAULT_LEVEL) as Level,
    })),
  );
}

/** Two highest skills as strengths; one or two lowest as next steps. Stable on ties (rubric order). */
export function suggestStrengthsAndNextSteps(rubric: Rubric, answers: Record<string, AreaAnswer>) {
  const observed = allSkills(rubric, answers).filter((s) => s.level > 0);
  const byHigh = [...observed].sort((a, b) => b.level - a.level);
  const strengths = byHigh.slice(0, 2).map((s) => s.skillKey);
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

export function readinessGaps(
  rubric: Rubric,
  answers: Record<string, AreaAnswer>,
  _review?: unknown,
): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];
  for (const a of rubric.areas) {
    const ans = answers[a.key];
    if (!ans?.visited) gaps.push({ key: a.key, label: `${a.shortName}: no questions answered yet` });
    else if (Object.values(ans.skills).some((s) => !s.touched)) {
      gaps.push({ key: a.key, label: `${a.shortName}: some questions are not answered yet` });
    }
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
