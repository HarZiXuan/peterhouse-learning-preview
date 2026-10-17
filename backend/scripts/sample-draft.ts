// Prints a sentence-bank draft for a fictional child, for checking the wording.
import { DEFAULT_RUBRIC } from "@peterhouse/shared";
import { writeWithSentenceBank } from "../src/domain/writer/sentence-bank";
import type { AreaAnswer, Level } from "@peterhouse/shared";

const levels: Level[] = [2, 3, 4, 3, 5, 1, 3, 4, 2, 3, 3, 4, 2, 2, 3, 4, 4, 3, 0, 3, 4];
let i = 0;
const answers: Record<string, AreaAnswer> = Object.fromEntries(
  DEFAULT_RUBRIC.areas.map((a) => [a.key, { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level: levels[i++ % levels.length] }])), moments: a.moments.slice(0, 2).concat(a.moments.filter((m) => /^(With|On|In) /.test(m)).slice(0, 1)), note: a.key === "mathematics" ? "Counted 12 shells at the beach table" : "", visited: true }]),
);
const pronoun = (process.argv[2] as "she" | "he" | "they") ?? "she";
const w = writeWithSentenceBank({ pronoun, season: "December", highlight: "Loved building a boat for the toy animals", rubric: DEFAULT_RUBRIC, answers, strengths: ["materials", "counts"], nextSteps: ["feelings"] }, "x");
console.log(w.opening + "\n");
for (const [k, v] of Object.entries(w.areas)) console.log(`${k}: ${v}\n`);
console.log(w.closing + "\n");
console.log(w.homeIdeas);
