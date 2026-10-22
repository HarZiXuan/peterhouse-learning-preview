import { describe, expect, it } from "vitest";
import {
  ageYearsMonths,
  areaProgress,
  areaSummary,
  fillTemplate,
  levelWord,
  movement,
  normaliseRubric,
  readinessGaps,
  skillPhrase,
  staffDisplayNames,
  suggestStrengthsAndNextSteps,
} from "@peterhouse/shared";
import { DEFAULT_RUBRIC, birthdayRange, levelForBirthday, rubricForLevel } from "@peterhouse/shared";
import { qualityFlags } from "../src/domain/writer/quality";
import { sentencesFor, withAdverb, writeWithSentenceBank } from "../src/domain/writer/sentence-bank";
import type { AreaAnswer, Level } from "@peterhouse/shared";

// A K1 child's questions. Most tests below are about one child's form.
const K1 = rubricForLevel(DEFAULT_RUBRIC, "K1");

const maths = K1.areas.find((a) => a.key === "mat")!;
const rate = (...levels: (Level | null)[]): AreaAnswer => ({
  skills: Object.fromEntries(maths.skills.map((s, i) => [s.key, levels[i] === null || levels[i] === undefined ? { level: 0, touched: false } : { level: levels[i]!, touched: true }])),
  note: "",
  visited: true,
});
const allAt = (level: Level): Record<string, AreaAnswer> =>
  Object.fromEntries(K1.areas.map((a) => [a.key, { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level, touched: true }])), note: "", visited: true }]));

describe("the question set", () => {
  it("has the five domains of the spec", () => {
    expect(K1.areas.map((a) => a.name)).toEqual(["English", "Chinese", "Mathematics", "Social-Emotional Development", "Self-Enrichment"]);
    expect(K1.areas.map((a) => a.skills.length)).toEqual([5, 4, 5, 4, 4]);
    expect(K1.areas[4]).toMatchObject({ love: { key: "enr_love" } });
    expect(K1.areas.every((a) => a.skills.every((s) => s.text.startsWith("{name} ")))).toBe(true);
  });
  it("asks each age group its own questions", () => {
    const pg = rubricForLevel(DEFAULT_RUBRIC, "PG");
    const n1 = rubricForLevel(DEFAULT_RUBRIC, "N1");
    expect(pg.level).toBe("PG");
    expect(pg.areas.map((a) => a.skills.length)).toEqual([4, 3, 4, 4, 3]);
    expect(n1.areas[0].skills.map((s) => s.key)).toEqual(["eng_n1_1", "eng_n1_2", "eng_n1_3", "eng_n1_4"]);
    expect(K1.areas.find((a) => a.key === "enr")!.skills.map((s) => s.key)).toEqual(["enr_k1_1", "enr_k1_2", "enr_k1_3", "enr_k1_4"]);
    // Every level has 3 to 6 questions of its own in every area, written without digits (the report never shows one).
    for (const level of ["PG", "N1", "N2", "K1", "K2"] as const) {
      for (const a of rubricForLevel(DEFAULT_RUBRIC, level).areas) {
        expect(a.skills.length).toBeGreaterThanOrEqual(3);
        expect(a.skills.length).toBeLessThanOrEqual(6);
        expect(a.skills.every((s) => s.key.includes(`_${level.toLowerCase()}_`) && !/\d/.test(s.text))).toBe(true);
      }
    }
  });
  it("reads reviews frozen with the older seven-area shape", () => {
    const old = normaliseRubric({ areas: [{ key: "communication", name: "Communication and Language", shortName: "Communication", skills: [{ key: "listens", name: "Listens and responds", statement: "listens well and responds in a group" }, { key: "x", name: "Builds towers" }] }] });
    expect(old.version).toBe(0);
    expect(old.areas[0].skills.map((s) => s.text)).toEqual(["{name} listens well and responds in a group.", "{name} builds towers."]);
  });
});

describe("scale", () => {
  it("uses the fixed anchor labels and never a number", () => {
    expect([1, 2, 3, 4, 5].map((l) => levelWord(l as Level))).toEqual(["Still learning", "Sometimes", "Regularly", "Confidently", "Really shines"]);
    expect(levelWord(0)).toBe("Not seen yet");
  });
});

describe("templates", () => {
  it("fills the name and the pronoun", () => {
    const t = "{name} can say how {he/she} feels.";
    expect(fillTemplate(t, "Mia", "she")).toBe("Mia can say how she feels.");
    expect(fillTemplate(t, "Arjun", "he")).toBe("Arjun can say how he feels.");
    expect(fillTemplate("{name} washes {his/her} hands.", "Arjun", "he")).toBe("Arjun washes his hands.");
    // Questions frozen in older reviews used three-form tokens; they still fill in.
    expect(fillTemplate("{name} washes {his/her/their} hands.", "Mia", "she")).toBe("Mia washes her hands.");
  });
  it("turns a statement into a phrase for the writer", () => {
    expect(skillPhrase(K1.areas[0].skills[0], "she")).toBe("reads simple sentences and common sight words");
    expect(skillPhrase(K1.areas[3].skills[2], "he")).toBe("looks after his own belongings and finishes tasks on his own");
  });
});

describe("progress and readiness", () => {
  it("starts blank: nothing counts until tapped, and Not seen yet counts as answered", () => {
    expect(areaProgress(maths, undefined)).toEqual({ rated: 0, notSeen: 0, todo: 5, total: 5 });
    expect(areaProgress(maths, rate(4, 0, null, null, null))).toEqual({ rated: 1, notSeen: 1, todo: 3, total: 5 });
  });
  it("needs every statement rated or marked Not seen yet in every domain", () => {
    expect(readinessGaps(K1, {}).length).toBe(K1.areas.length);
    const answers = allAt(3);
    expect(readinessGaps(K1, answers)).toEqual([]);
    answers.mat = rate(3, 3, 0, 3, null);
    expect(readinessGaps(K1, answers)).toEqual([{ key: "mat", label: "Maths: 1 still to rate" }]);
  });
});

describe("area summary", () => {
  it("takes the gentler middle of the observed ratings", () => {
    expect(areaSummary(maths, rate(2, 4))).toBe(2);
    expect(areaSummary(maths, rate(5, 5, 4))).toBe(5);
  });
  it("needs two observed", () => {
    expect(areaSummary(maths, rate(0, 4))).toBeNull();
  });
});

describe("progress since last semester", () => {
  it("reports up, same and down", () => {
    expect(movement(4, 3)).toBe("up");
    expect(movement(3, 3)).toBe("same");
    expect(movement(2, 3)).toBe("down");
    expect(movement(0, 3)).toBeNull();
  });
});

describe("strengths and next steps", () => {
  it("suggests the two highest and the lowest observed", () => {
    const answers = allAt(3);
    answers.mat.skills.mat_k1_1.level = 5;
    answers.enr.skills.enr_k1_2.level = 4;
    answers.sed.skills.sed_k1_3.level = 1;
    answers.eng.skills.eng_k1_4.level = 0;
    const s = suggestStrengthsAndNextSteps(K1, answers);
    expect(s.strengths).toEqual(["mat_k1_1", "enr_k1_2"]);
    expect(s.nextSteps).toEqual(["sed_k1_3"]);
  });
});

describe("names and ages", () => {
  it("adds the surname initial when two children share a name", () => {
    const n = staffDisplayNames([
      { child_id: 1, preferred_name: "Mia", legal_name: "Mia Tan Li Ying" },
      { child_id: 2, preferred_name: "Mia", legal_name: "Mia Lee Xin Yi" },
      { child_id: 3, preferred_name: "Arjun", legal_name: "Arjun Nair" },
    ]);
    expect([n.get(1), n.get(2), n.get(3)]).toEqual(["Mia T.", "Mia L.", "Arjun"]);
  });
  it("gives age in years and months", () => {
    expect(ageYearsMonths("2021-03-14", new Date("2026-12-01T00:00:00"))).toBe("5 years 8 months");
    expect(ageYearsMonths("2021-12-01", new Date("2026-12-01T00:00:00"))).toBe("5 years");
  });
});

describe("quality checks", () => {
  const opts = { neverUse: K1.neverUse };
  it("flags numbers, never-use words and comparisons", () => {
    const f = qualityFlags("Mia scored 4 out of 5 and is behind other children.", "area", opts);
    expect(f.some((x) => x.includes("number"))).toBe(true);
    expect(f.some((x) => x.includes("behind"))).toBe(true);
    expect(f.some((x) => x.includes("compare"))).toBe(true);
  });
  it("flags length problems", () => {
    expect(qualityFlags("Short.", "opening", opts).some((x) => x.includes("short"))).toBe(true);
  });
});

describe("writing for the youngest (change 8)", () => {
  it("uses growing language for PG and N1, and tells the writing service the age group", async () => {
    const { buildAnonymousPayload } = await import("../src/domain/anonymise");
    const pg = rubricForLevel(DEFAULT_RUBRIC, "PG");
    const skill = pg.areas[3].skills[0];
    const young = sentencesFor(skill, 5, "she", true).join(" ");
    expect(young).toMatch(/growing/);
    expect(young).not.toMatch(/inspires|helping others/);
    expect(sentencesFor(skill, 5, "she", false).join(" ")).toMatch(/inspires|helping others|joy/);
    const payload = buildAnonymousPayload({ pronoun: "she", season: "June", level: "PG", rubric: pg, answers: {}, strengths: [], nextSteps: [] }, { child: ["Mia"], otherChildren: [], staff: [] });
    expect(payload.text).toContain("age group: Playgroup (turning 2 this year)");
    expect(payload.text).toContain("say plainly what the child cannot do yet");
    expect(payload.text).toContain("Never compare the child with other children");
  });
});

describe("sentence bank", () => {
  it("puts the score's tone into the statement", () => {
    expect(withAdverb("listens well", "confidently")).toBe("confidently listens well");
    expect(withAdverb("can say how she feels", "confidently")).toBe("can confidently say how she feels");
    const reads = K1.areas[0].skills[0];
    expect(sentencesFor(reads, 4, "she")[0]).toBe("[Child] confidently reads simple sentences and common sight words.");
    expect(sentencesFor(reads, 1, "she")[0]).toBe("[Child] does not yet show that she reads simple sentences and common sight words, and still needs an adult's help here.");
  });

  it("writes every paragraph without numbers and without describing what was not seen", () => {
    const answers = allAt(4);
    answers.enr = { skills: Object.fromEntries(["enr_k1_1", "enr_k1_2", "enr_k1_3", "enr_k1_4"].map((k) => [k, { level: 0 as Level, touched: true }])), note: "", visited: true, love: "Loved the music corner", home: [] };
    answers.mat.note = "Counted 12 shells at the beach table.";
    const w = writeWithSentenceBank({ pronoun: "she", season: "December", level: "K1", rubric: K1, answers, strengths: ["mat_k1_1"], nextSteps: ["sed_k1_3"] }, "seed");
    expect(Object.keys(w.areas)).toEqual(["eng", "chi", "mat", "sed", "enr"]);
    expect(w.areas.enr).toContain("still getting to know");
    expect(w.areas.enr).not.toMatch(/art and craft|performances|coordination|experiments/);
    expect(w.areas.mat).toContain("12 shells");
    expect(w.opening).toContain("loved the music corner");
    expect(w.homeIdeas).toHaveLength(2);
    for (const t of [w.opening, w.closing, ...Object.entries(w.areas).filter(([k]) => k !== "mat").map(([, v]) => v)]) expect(t).not.toMatch(/\d/);
  });
});

describe("birthdays the picker allows", () => {
  it("spans Playgroup (turns 2) to K2 (turns 6), and every allowed day gives a level", () => {
    const all = birthdayRange(2026);
    expect(all).toMatchObject({ min: "2020-01-01", max: "2024-12-31" });
    expect(levelForBirthday(all.min, 2026)).toEqual({ level: "K2" });
    expect(levelForBirthday(all.max, 2026)).toEqual({ level: "PG" });
    // Anything outside is refused: 1 January 2025 is too young, which is what the picker used to allow.
    expect(levelForBirthday("2025-01-01", 2026)).toEqual({ problem: "too_young" });
  });
  it("narrows to the levels that have a class", () => {
    expect(birthdayRange(2026, ["K1"])).toMatchObject({ min: "2021-01-01", max: "2021-12-31" });
    expect(birthdayRange(2026, ["N1", "K1"])).toMatchObject({ min: "2021-01-01", max: "2023-12-31" });
  });
});
