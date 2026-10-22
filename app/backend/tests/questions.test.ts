// Teacher Questions v0.3, section 4: the administrator edits the questions, with guard rails so history stays correct.
import type { Request } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AreaAnswer, Rubric, SessionUser } from "@peterhouse/shared";
import { makeClass, setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
let admin: SessionUser;
let teacher: SessionUser;
const req = null as unknown as Request;

const sessionUser = (id: number, role: "admin" | "teacher"): SessionUser => ({ id, email: `${role}${id}@x.sg`, name: `${role} ${id}`, role, mustChangePassword: false });

async function rateAll(reviewId: number, rubric: Rubric, level: 1 | 2 | 3 | 4 | 5) {
  const R = await import("../src/domain/reviews");
  for (const a of rubric.areas) {
    const ans: AreaAnswer = { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level, touched: true }])), note: "", visited: true };
    await R.saveArea(teacher, reviewId, a.key, ans);
  }
}

beforeAll(async () => {
  t = await setupTestDb();
  const U = await import("../src/domain/users");
  const W = await import("../src/domain/workspace");
  await W.workspace();
  admin = sessionUser(await U.createUser(null, null, { email: "admin@x.sg", name: "Ms Lee", role: "admin", password: "an admin passphrase" }), "admin");
  teacher = sessionUser(await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "a teacher passphrase" }), "teacher");
});
afterAll(async () => {
  await t.teardown();
});

describe("question bank", () => {
  it("starts with the spec's questions published as v1", async () => {
    const Q = await import("../src/domain/questions");
    const bank = await Q.questionBank();
    expect(bank.live.version).toBe(1);
    expect(bank.changes).toEqual([]);
    expect(bank.problems).toEqual([]);
    // Every level's own questions: each level is asked only its own.
    expect(bank.domains.map((d) => [d.key, d.questions.length])).toEqual([["eng", 23], ["chi", 20], ["mat", 23], ["sed", 20], ["enr", 19]]);
    expect(bank.domains[0].questions.find((q) => q.key === "eng_k2_1")!.levels).toEqual(["K2"]);
    expect(bank.scale.map((s) => s.label)).toEqual(["Still learning", "Sometimes", "Regularly", "Confidently", "Really shines"]);
  });

  it("keeps IDs on rewording, gives a new ID to a different skill, and never reuses one", async () => {
    const Q = await import("../src/domain/questions");
    expect(await Q.rewordQuestion(req, admin, "mat_k1_2", "{name} adds and takes away within ten, and knows the number bonds to ten.", true)).toBe("mat_k1_2");
    expect(await Q.addQuestion(req, admin, "mat", "{name} uses counting to solve small problems")).toBe("mat_6");
    const replaced = await Q.rewordQuestion(req, admin, "mat_k1_3", "{name} explains how {he/she/they} solved a problem.", false);
    expect(replaced).toBe("mat_7");

    const bank = await Q.questionBank();
    const mat = bank.domains.find((d) => d.key === "mat")!;
    // The replacement takes the old question's place; the old one is retired, kept for history.
    expect(mat.questions.filter((q) => q.levels.includes("K1")).map((q) => q.key)).toEqual(["mat_k1_1", "mat_k1_2", "mat_7", "mat_k1_4", "mat_k1_5", "mat_6"]);
    // The replacement keeps the old question's levels; a new question is asked at every level unless chosen.
    expect(mat.questions.find((q) => q.key === "mat_7")!.levels).toEqual(["K1"]);
    expect(mat.questions.find((q) => q.key === "mat_6")!.levels).toEqual(["PG", "N1", "N2", "K1", "K2"]);
    expect(mat.questions.find((q) => q.key === "mat_6")!.text).toBe("{name} uses counting to solve small problems.");
    expect(mat.retired.map((q) => q.key)).toEqual(["mat_k1_3"]);
    expect(Object.fromEntries(bank.changes.map((c) => [c.key, c.kind]))).toMatchObject({ mat_k1_2: "reworded", mat_6: "added", mat_7: "added", mat_k1_3: "retired" });
    expect(bank.changes.find((c) => c.key === "mat_k1_2")!.was).toContain("adds and subtracts within ten");
  });

  it("holds every domain between 3 and 6 questions, and needs {name}", async () => {
    const Q = await import("../src/domain/questions");
    // K1 Maths already has 6, so a question for every level is refused; Playgroup has room for two more.
    await expect(Q.addQuestion(req, admin, "mat", "{name} counts backwards.")).rejects.toMatchObject({ status: 400 });
    const extra = await Q.addQuestion(req, admin, "mat", "{name} spots patterns in songs.", ["PG"]);
    await expect(Q.addQuestion(req, admin, "mat", "{name} stacks cups by size.", ["PG"])).rejects.toMatchObject({ status: 400 });
    // Playgroup Self-Enrichment has exactly 3, so none of them can go.
    await expect(Q.retireQuestion(req, admin, "enr_pg_1")).rejects.toMatchObject({ status: 400 });
    await expect(Q.addQuestion(req, admin, "eng", "Counts to ten.")).rejects.toMatchObject({ status: 400 });
    // A question that was never published leaves no trace when removed.
    await Q.retireQuestion(req, admin, extra);
    expect((await Q.questionBank()).domains.find((d) => d.key === "mat")!.retired.map((q) => q.key)).toEqual(["mat_k1_3"]);
  });

  it("reorders, edits the enrichment prompts, and can discard everything", async () => {
    const Q = await import("../src/domain/questions");
    await Q.moveQuestion(req, admin, "eng_k1_4", "up");
    await Q.updateDomainExtras(req, admin, "enr", { loveText: "What made {name} smile most this semester?", homeIdeas: ["Bake together", "Bake together", "Dance in the kitchen"] });
    let bank = await Q.questionBank();
    expect(bank.domains[0].questions.filter((q) => q.levels.includes("K1")).map((q) => q.key)).toEqual(["eng_k1_1", "eng_k1_2", "eng_k1_4", "eng_k1_3", "eng_k1_5"]);
    expect(bank.domains[4].homeIdeas).toEqual(["Bake together", "Dance in the kitchen"]);
    expect(bank.changes.map((c) => c.kind)).toEqual(expect.arrayContaining(["reordered", "prompt", "home"]));
    await Q.discardDraft(req, admin);
    bank = await Q.questionBank();
    expect(bank.changes).toEqual([]);
    expect(bank.domains.find((d) => d.key === "mat")!.retired).toEqual([]);
  });
});

describe("questions by level", () => {
  it("counts 3 to 6 questions per area for each level, and publishes a change of levels", async () => {
    const Q = await import("../src/domain/questions");
    // Playgroup has exactly 3 Chinese questions, so one of them cannot stop being asked at PG.
    await expect(Q.setQuestionLevels(req, admin, "chi_pg_1", ["N1"])).rejects.toMatchObject({ status: 400 });
    await expect(Q.setQuestionLevels(req, admin, "chi_pg_1", [])).rejects.toMatchObject({ status: 400 });
    // Asking a K1 question at K2 too is fine.
    await Q.setQuestionLevels(req, admin, "mat_k1_4", ["K1", "K2"]);
    const bank = await Q.questionBank();
    expect(bank.changes).toEqual([expect.objectContaining({ kind: "levels", key: "mat_k1_4", was: "K1", effect: "Asked at K1, K2." })]);
    // A new question just for K2: K2 has room, the others are untouched.
    const key = await Q.addQuestion(req, admin, "eng", "{name} writes {his/her/their} own name.", ["K2"]);
    expect((await Q.questionBank()).preview.areas[0].skills.find((s) => s.key === key)!.levels).toEqual(["K2"]);
    await Q.discardDraft(req, admin);
    expect((await Q.questionBank()).changes).toEqual([]);
  });
});

describe("frozen wording per review", () => {
  it("keeps the questions a review was opened with; later edits reach only reviews not opened yet", async () => {
    const Q = await import("../src/domain/questions");
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");

    const cls = await makeClass([teacher.id]);
    const openedId = await cls.add("Mia", "she");
    const laterId = await cls.add("Arjun", "he");
    const opened = await R.openReview((await R.getReviewRow(openedId))!);
    expect(opened.rubric.version).toBe(1);

    await Q.rewordQuestion(req, admin, "mat_k1_2", "{name} adds and takes away within ten, and knows the number bonds to ten.", true);
    await Q.rewordQuestion(req, admin, "mat_k1_3", "{name} explains how {he/she/they} solved a problem.", false);
    await Q.addQuestion(req, admin, "mat", "{name} uses counting to solve small problems.");
    await expect(Q.publishQuestions(req, admin)).resolves.toEqual({ version: 2, changes: 4 });
    const bank = await Q.questionBank();
    expect(bank.live.version).toBe(2);
    expect(bank.changes).toEqual([]);
    await expect(Q.publishQuestions(req, admin)).rejects.toMatchObject({ status: 400 });

    // Questions that were drafted and discarded never reached a review, so their IDs were free to use again.
    // The opened review still has v1 and its old mat_k1_3; the other picks up v2 when first opened.
    const stillV1 = (await R.getReviewRow(openedId))!;
    expect(stillV1.rubric.version).toBe(1);
    expect(stillV1.rubric.areas[2].skills.map((s) => s.key)).toEqual(["mat_k1_1", "mat_k1_2", "mat_k1_3", "mat_k1_4", "mat_k1_5"]);
    const later = await R.openReview((await R.getReviewRow(laterId))!);
    expect(later.rubric.version).toBe(2);
    expect(later.rubric.areas[2].skills.map((s) => s.key)).toEqual(["mat_k1_1", "mat_k1_2", "mat_6", "mat_k1_4", "mat_k1_5", "mat_7"]);
    expect(later.rubric.areas[2].skills[1].text).toBe("{name} adds and takes away within ten, and knows the number bonds to ten.");

    // Activity log: every change, with the question ID and never a name.
    const log = (await t.pool.query("SELECT action, detail FROM activity_log WHERE action LIKE 'questions.%' ORDER BY id")).rows;
    expect(log.map((r) => r.action)).toEqual(expect.arrayContaining(["questions.reworded", "questions.replaced", "questions.added", "questions.published"]));
    expect(log.filter((r) => r.action === "questions.replaced").at(-1)!.detail).toBe("mat_k1_3 → mat_6");
  });

  it("compares a reworded question with last semester, but not a different skill", async () => {
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");
    // From June, so the next semester is the same year and the same level.
    await W.setReportPeriod("June", (await W.getReportPeriod()).year);
    const mia = (await W.listChildren(teacher)).find((c) => c.name === "Mia")!;
    const s1 = (await R.getReviewRow(mia.reviewId))!;
    await rateAll(s1.id, s1.rubric, 2);
    expect((await R.writeDraft(teacher, s1.id)).ok).toBe(true);

    await W.startNextSemester(admin);
    const next = (await W.listChildren(teacher)).find((c) => c.name === "Mia")!;
    const s2 = await R.openReview((await R.getReviewRow(next.reviewId))!);
    expect(s2.rubric.version).toBe(2);
    await rateAll(s2.id, s2.rubric, 4);
    await R.writeDraft(teacher, s2.id);
    const data = await R.buildReportData((await R.getReviewRow(s2.id))!);
    const prev = Object.fromEntries(data.areas[2].skills.map((s) => [s.key, s.previous]));
    expect(prev).toEqual({ mat_k1_1: 2, mat_k1_2: 2, mat_6: null, mat_k1_4: 2, mat_k1_5: 2, mat_7: null });
    // The family report says "Mia adds and takes away…", in words.
    expect(data.areas[2].skills[1].text).toBe("Mia adds and takes away within ten, and knows the number bonds to ten");

    // In January Mia moves up to K2. A shared question may ask more of an older child, so nothing is compared.
    await W.startNextSemester(admin);
    const k2 = (await W.listChildren(teacher)).find((c) => c.name === "Mia")!;
    const s3 = await R.openReview((await R.getReviewRow(k2.reviewId))!);
    expect(s3.rubric.level).toBe("K2");
    await rateAll(s3.id, s3.rubric, 5);
    await R.writeDraft(teacher, s3.id);
    const d3 = await R.buildReportData((await R.getReviewRow(s3.id))!);
    expect(d3.previousSeason).toBeNull();
    expect(d3.areas.flatMap((a) => a.skills).every((sk) => sk.previous === null)).toBe(true);
  });
});
