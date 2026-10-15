import { describe, expect, it } from "vitest";
import { ageYearsMonths, areaSummary, movement, readinessGaps, staffDisplayNames, suggestStrengthsAndNextSteps } from "@/lib/calc";
import { DEFAULT_RUBRIC } from "@/lib/rubric-default";
import { qualityFlags } from "@/lib/writer/quality";
import { writeWithSentenceBank } from "@/lib/writer/sentence-bank";
import type { AreaAnswer, Level } from "@/lib/types";

const maths = DEFAULT_RUBRIC.areas.find((a) => a.key === "mathematics")!;
const ans = (counts: Level, shapes: Level): AreaAnswer => ({
  skills: { counts: { level: counts }, shapes: { level: shapes }, measures: { level: 0 }, solves: { level: 0 } },
  moments: [],
  note: "",
  visited: true,
});

describe("area summary", () => {
  it("takes the gentler of two ratings", () => {
    expect(areaSummary(maths, ans(2, 4))).toBe(2);
    expect(areaSummary(maths, ans(5, 5))).toBe(5);
  });
  it("needs both skills observed", () => {
    expect(areaSummary(maths, ans(0, 4))).toBeNull();
  });
});

describe("progress since last term", () => {
  it("reports up, same and down", () => {
    expect(movement(4, 3)).toBe("up");
    expect(movement(3, 3)).toBe("same");
    expect(movement(2, 3)).toBe("down");
    expect(movement(0, 3)).toBeNull();
  });
});

describe("strengths and next steps", () => {
  it("suggests the two highest and the lowest observed", () => {
    const answers: Record<string, AreaAnswer> = Object.fromEntries(
      DEFAULT_RUBRIC.areas.map((a) => [a.key, { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level: 3 as Level }])), moments: [], note: "", visited: true }]),
    );
    answers.mathematics.skills.counts.level = 5;
    answers.creative.skills.materials.level = 4;
    answers.psed.skills.feelings.level = 1;
    answers.literacy.skills.letters.level = 0;
    const s = suggestStrengthsAndNextSteps(DEFAULT_RUBRIC, answers);
    expect(s.strengths).toEqual(["counts", "materials"]);
    expect(s.nextSteps).toEqual(["feelings"]);
  });
});

describe("readiness", () => {
  it("needs every question answered in every area", () => {
    const gaps = readinessGaps(DEFAULT_RUBRIC, {});
    expect(gaps.length).toBe(DEFAULT_RUBRIC.areas.length);
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
  it("writes every paragraph without numbers and without describing unobserved skills", () => {
    const answers: Record<string, AreaAnswer> = Object.fromEntries(
      DEFAULT_RUBRIC.areas.map((a) => [a.key, { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level: 4 as Level }])), moments: ["With a friend"], note: "", visited: true }]),
    );
    answers.creative.skills = { songs: { level: 0 }, materials: { level: 0 }, ideas: { level: 0 } };
    const w = writeWithSentenceBank(
      { pronoun: "she", season: "December", highlight: "Loved the block area", rubric: DEFAULT_RUBRIC, answers, strengths: ["counts"], nextSteps: ["feelings"] },
      "seed",
    );
    expect(Object.keys(w.areas)).toHaveLength(7);
    expect(w.areas.creative).toContain("still getting to know");
    expect(w.opening).toContain("[Child]");
    expect(w.homeIdeas).toHaveLength(2);
    for (const t of [w.opening, w.closing, ...Object.values(w.areas)]) expect(t).not.toMatch(/\d/);
  });
});
