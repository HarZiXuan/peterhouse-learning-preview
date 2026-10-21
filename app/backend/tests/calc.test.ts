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
import { DEFAULT_RUBRIC } from "@peterhouse/shared";
import { qualityFlags } from "../src/domain/writer/quality";
import { sentencesFor, withAdverb, writeWithSentenceBank } from "../src/domain/writer/sentence-bank";
import type { AreaAnswer, Level } from "@peterhouse/shared";

const maths = DEFAULT_RUBRIC.areas.find((a) => a.key === "mat")!;
const rate = (...levels: (Level | null)[]): AreaAnswer => ({
  skills: Object.fromEntries(maths.skills.map((s, i) => [s.key, levels[i] === null || levels[i] === undefined ? { level: 0, touched: false } : { level: levels[i]!, touched: true }])),
  note: "",
  visited: true,
});
const allAt = (level: Level): Record<string, AreaAnswer> =>
  Object.fromEntries(DEFAULT_RUBRIC.areas.map((a) => [a.key, { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level, touched: true }])), note: "", visited: true }]));

describe("the question set", () => {
  it("has the five domains and sixteen core ratings of the spec", () => {
    expect(DEFAULT_RUBRIC.areas.map((a) => a.name)).toEqual(["English", "Chinese", "Mathematics", "Social-Emotional Development", "Self-Enrichment"]);
    expect(DEFAULT_RUBRIC.areas.slice(0, 4).reduce((n, a) => n + a.skills.length, 0)).toBe(16);
    expect(DEFAULT_RUBRIC.areas[4]).toMatchObject({ love: { key: "enr_love" } });
    expect(DEFAULT_RUBRIC.areas.every((a) => a.skills.every((s) => s.text.startsWith("{name} ")))).toBe(true);
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
    const t = "{name} can say how {he/she/they} feels.";
    expect(fillTemplate(t, "Mia", "she")).toBe("Mia can say how she feels.");
    expect(fillTemplate(t, "Arjun", "he")).toBe("Arjun can say how he feels.");
    expect(fillTemplate(t, "Sam", "they")).toBe("Sam can say how they feel.");
    expect(fillTemplate("{name} washes {his/her/their} hands.", "Sam", "they")).toBe("Sam washes their hands.");
  });
  it("turns a statement into a phrase for the writer", () => {
    expect(skillPhrase(DEFAULT_RUBRIC.areas[0].skills[0], "she")).toBe("listens well and responds in a group");
    expect(skillPhrase(DEFAULT_RUBRIC.areas[3].skills[2], "he")).toBe("can say how he feels");
  });
});

describe("progress and readiness", () => {
  it("starts blank: nothing counts until tapped, and Not seen yet counts as answered", () => {
    expect(areaProgress(maths, undefined)).toEqual({ rated: 0, notSeen: 0, todo: 4, total: 4 });
    expect(areaProgress(maths, rate(4, 0, null, null))).toEqual({ rated: 1, notSeen: 1, todo: 2, total: 4 });
  });
  it("needs every statement rated or marked Not seen yet in every domain", () => {
    expect(readinessGaps(DEFAULT_RUBRIC, {}).length).toBe(DEFAULT_RUBRIC.areas.length);
    const answers = allAt(3);
    expect(readinessGaps(DEFAULT_RUBRIC, answers)).toEqual([]);
    answers.mat = rate(3, 3, 0, null);
    expect(readinessGaps(DEFAULT_RUBRIC, answers)).toEqual([{ key: "mat", label: "Maths: 1 still to rate" }]);
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
    answers.mat.skills.mat_1.level = 5;
    answers.enr.skills.enr_2.level = 4;
    answers.sed.skills.sed_3.level = 1;
    answers.eng.skills.eng_4.level = 0;
    const s = suggestStrengthsAndNextSteps(DEFAULT_RUBRIC, answers);
    expect(s.strengths).toEqual(["mat_1", "enr_2"]);
    expect(s.nextSteps).toEqual(["sed_3"]);
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
  const opts = { neverUse: DEFAULT_RUBRIC.neverUse };
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

describe("sentence bank", () => {
  it("puts the score's tone into the statement", () => {
    expect(withAdverb("listens well", "confidently")).toBe("confidently listens well");
    expect(withAdverb("can say how she feels", "confidently")).toBe("can confidently say how she feels");
    const listens = DEFAULT_RUBRIC.areas[0].skills[0];
    expect(sentencesFor(listens, 4, "she")[0]).toBe("[Child] confidently listens well and responds in a group.");
    expect(sentencesFor(listens, 1, "she")[0]).toBe("With gentle support, [Child] is beginning to show that she listens well and responds in a group.");
    // "they" repeats the name so the verb still agrees.
    expect(sentencesFor(listens, 1, "they")[0]).toContain("show that [Child] listens");
  });

  it("writes every paragraph without numbers and without describing what was not seen", () => {
    const answers = allAt(4);
    answers.enr = { skills: { enr_1: { level: 0, touched: true }, enr_2: { level: 0, touched: true }, enr_3: { level: 0, touched: true } }, note: "", visited: true, love: "Loved the music corner", home: [] };
    answers.mat.note = "Counted 12 shells at the beach table.";
    const w = writeWithSentenceBank({ pronoun: "she", season: "December", rubric: DEFAULT_RUBRIC, answers, strengths: ["mat_1"], nextSteps: ["sed_3"] }, "seed");
    expect(Object.keys(w.areas)).toEqual(["eng", "chi", "mat", "sed", "enr"]);
    expect(w.areas.enr).toContain("still getting to know");
    expect(w.areas.enr).not.toMatch(/music and movement|art and making|outdoor play/);
    expect(w.areas.mat).toContain("12 shells");
    expect(w.opening).toContain("loved the music corner");
    expect(w.homeIdeas).toHaveLength(2);
    for (const t of [w.opening, w.closing, ...Object.entries(w.areas).filter(([k]) => k !== "mat").map(([, v]) => v)]) expect(t).not.toMatch(/\d/);
  });
});
