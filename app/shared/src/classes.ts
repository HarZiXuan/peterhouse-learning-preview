// Class levels (CHANGES-TO-MAKE change 4). A child's level is the age they turn during the calendar year,
// not their exact age today: a child turning 4 in January and one turning 4 in December are both N2.

export const CLASS_LEVELS = [
  { key: "PG", name: "Playgroup", turns: 2, ratio: 6 },
  { key: "N1", name: "Nursery 1", turns: 3, ratio: 8 },
  { key: "N2", name: "Nursery 2", turns: 4, ratio: 10 },
  { key: "K1", name: "Kindergarten 1", turns: 5, ratio: 12 },
  { key: "K2", name: "Kindergarten 2", turns: 6, ratio: 15 },
] as const;

export type ClassLevel = (typeof CLASS_LEVELS)[number]["key"];

export const CLASS_LEVEL_KEYS = CLASS_LEVELS.map((l) => l.key) as ClassLevel[];

export const classLevel = (key: ClassLevel) => CLASS_LEVELS.find((l) => l.key === key)!;

export const isClassLevel = (v: unknown): v is ClassLevel => CLASS_LEVEL_KEYS.includes(v as ClassLevel);

/** Why a date of birth gives no level: missing, too young for Playgroup, or past K2. */
export type LevelProblem = "no_birthday" | "too_young" | "too_old";

/** The level for a child born on `dateOfBirth` (YYYY-MM-DD) in the calendar year `year`. */
export function levelForBirthday(dateOfBirth: string, year: number): { level: ClassLevel } | { problem: LevelProblem } {
  const born = Number(/^(\d{4})-\d{2}-\d{2}$/.exec(dateOfBirth)?.[1]);
  if (!born) return { problem: "no_birthday" };
  const turns = year - born;
  const found = CLASS_LEVELS.find((l) => l.turns === turns);
  if (found) return { level: found.key };
  return { problem: turns < CLASS_LEVELS[0].turns ? "too_young" : "too_old" };
}

/** The year a level's children are born in, for "turning 5 in 2026". */
export const birthYearOf = (level: ClassLevel, year: number) => year - classLevel(level).turns;

/** The level after this one, or null after K2 (the child goes on to primary school). */
export function nextLevel(level: ClassLevel): ClassLevel | null {
  const i = CLASS_LEVEL_KEYS.indexOf(level);
  return CLASS_LEVEL_KEYS[i + 1] ?? null;
}

/** Most children a class may have for its teachers. With no teacher yet, the ratio for one. */
export const classCapacity = (level: ClassLevel, teachers: number) => classLevel(level).ratio * Math.max(1, teachers);

export const LEVEL_PROBLEM_TEXT: Record<LevelProblem, string> = {
  no_birthday: "No birthday yet, so no level",
  too_young: "Too young for Playgroup this year",
  too_old: "Past K2 this year",
};

/** "K1 Sunflower" for "N2 Sunflower" moving up; a name without the old level in front stays as it is. */
export function nameForNextLevel(name: string, from: ClassLevel, to: ClassLevel): string {
  return name.startsWith(`${from} `) || name === from ? to + name.slice(from.length) : name;
}
