// Prints a sentence-bank draft for a fictional child, for checking the wording.
import { DEFAULT_RUBRIC } from "@peterhouse/shared";
import { writeWithSentenceBank } from "../src/domain/writer/sentence-bank";
import type { AreaAnswer, Level } from "@peterhouse/shared";

const levels: Level[] = [2, 3, 4, 3, 5, 1, 3, 4, 2, 3, 3, 4, 2, 2, 3, 4, 4, 3, 0];
let i = 0;
const answers: Record<string, AreaAnswer> = Object.fromEntries(
  DEFAULT_RUBRIC.areas.map((a) => [
    a.key,
    {
      skills: Object.fromEntries(a.skills.map((s) => [s.key, { level: levels[i++ % levels.length], touched: true }])),
      note: a.key === "mat" ? "Counted 12 shells at the beach table" : "",
      visited: true,
      ...(a.love ? { love: "Loved building a boat for the toy animals", home: a.homeIdeas!.slice(0, 2) } : {}),
    },
  ]),
);
const pronoun = (process.argv[2] as "she" | "he" | "they") ?? "she";
const w = writeWithSentenceBank({ pronoun, season: "December", rubric: DEFAULT_RUBRIC, answers, strengths: ["eng_3", "chi_1"], nextSteps: ["chi_2"] }, "x");
console.log(w.opening + "\n");
for (const [k, v] of Object.entries(w.areas)) console.log(`${k}: ${v}\n`);
console.log(w.closing + "\n");
console.log(w.homeIdeas);
