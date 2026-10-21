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
    expect(bank.domains.map((d) => [d.key, d.questions.length])).toEqual([["eng", 4], ["chi", 4], ["mat", 4], ["sed", 4], ["enr", 3]]);
    expect(bank.scale.map((s) => s.label)).toEqual(["Still learning", "Sometimes", "Regularly", "Confidently", "Really shines"]);
  });

  it("keeps IDs on rewording, gives a new ID to a different skill, and never reuses one", async () => {
    const Q = await import("../src/domain/questions");
    expect(await Q.rewordQuestion(req, admin, "mat_2", "{name} compares groups and says which has more or fewer.", true)).toBe("mat_2");
    expect(await Q.addQuestion(req, admin, "mat", "{name} uses counting to solve small problems")).toBe("mat_5");
    const replaced = await Q.rewordQuestion(req, admin, "mat_3", "{name} builds with shapes and describes them.", false);
    expect(replaced).toBe("mat_6");

    const bank = await Q.questionBank();
    const mat = bank.domains.find((d) => d.key === "mat")!;
    // The replacement takes the old question's place; the old one is retired, kept for history.
    expect(mat.questions.map((q) => q.key)).toEqual(["mat_1", "mat_2", "mat_6", "mat_4", "mat_5"]);
    expect(mat.questions.find((q) => q.key === "mat_5")!.text).toBe("{name} uses counting to solve small problems.");
    expect(mat.retired.map((q) => q.key)).toEqual(["mat_3"]);
    expect(Object.fromEntries(bank.changes.map((c) => [c.key, c.kind]))).toMatchObject({ mat_2: "reworded", mat_5: "added", mat_6: "added", mat_3: "retired" });
    expect(bank.changes.find((c) => c.key === "mat_2")!.was).toContain("compares size and amount");
  });

  it("holds every domain between 3 and 6 questions, and needs {name}", async () => {
    const Q = await import("../src/domain/questions");
    await Q.addQuestion(req, admin, "mat", "{name} spots patterns in songs.");
    await expect(Q.addQuestion(req, admin, "mat", "{name} counts backwards.")).rejects.toMatchObject({ status: 400 });
    await expect(Q.retireQuestion(req, admin, "enr_3")).rejects.toMatchObject({ status: 400 });
    await expect(Q.addQuestion(req, admin, "eng", "Counts to ten.")).rejects.toMatchObject({ status: 400 });
    // A question that was never published leaves no trace when removed.
    await Q.retireQuestion(req, admin, "mat_7");
    expect((await Q.questionBank()).domains.find((d) => d.key === "mat")!.retired.map((q) => q.key)).toEqual(["mat_3"]);
  });

  it("reorders, edits the enrichment prompts, and can discard everything", async () => {
    const Q = await import("../src/domain/questions");
    await Q.moveQuestion(req, admin, "eng_4", "up");
    await Q.updateDomainExtras(req, admin, "enr", { loveText: "What made {name} smile most this semester?", homeIdeas: ["Bake together", "Bake together", "Dance in the kitchen"] });
    let bank = await Q.questionBank();
    expect(bank.domains[0].questions.map((q) => q.key)).toEqual(["eng_1", "eng_2", "eng_4", "eng_3"]);
    expect(bank.domains[4].homeIdeas).toEqual(["Bake together", "Dance in the kitchen"]);
    expect(bank.changes.map((c) => c.kind)).toEqual(expect.arrayContaining(["reordered", "prompt", "home"]));
    await Q.discardDraft(req, admin);
    bank = await Q.questionBank();
    expect(bank.changes).toEqual([]);
    expect(bank.domains.find((d) => d.key === "mat")!.retired).toEqual([]);
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

    await Q.rewordQuestion(req, admin, "mat_2", "{name} compares groups and says which has more or fewer.", true);
    await Q.rewordQuestion(req, admin, "mat_3", "{name} builds with shapes and describes them.", false);
    await Q.addQuestion(req, admin, "mat", "{name} uses counting to solve small problems.");
    await expect(Q.publishQuestions(req, admin)).resolves.toEqual({ version: 2, changes: 4 });
    const bank = await Q.questionBank();
    expect(bank.live.version).toBe(2);
    expect(bank.changes).toEqual([]);
    await expect(Q.publishQuestions(req, admin)).rejects.toMatchObject({ status: 400 });

    // Questions that were drafted and discarded never reached a review, so their IDs were free to use again.
    // The opened review still has v1 and its old mat_3; the other picks up v2 when first opened.
    const stillV1 = (await R.getReviewRow(openedId))!;
    expect(stillV1.rubric.version).toBe(1);
    expect(stillV1.rubric.areas[2].skills.map((s) => s.key)).toEqual(["mat_1", "mat_2", "mat_3", "mat_4"]);
    const later = await R.openReview((await R.getReviewRow(laterId))!);
    expect(later.rubric.version).toBe(2);
    expect(later.rubric.areas[2].skills.map((s) => s.key)).toEqual(["mat_1", "mat_2", "mat_5", "mat_4", "mat_6"]);
    expect(later.rubric.areas[2].skills[1].text).toBe("{name} compares groups and says which has more or fewer.");

    // Activity log: every change, with the question ID and never a name.
    const log = (await t.pool.query("SELECT action, detail FROM activity_log WHERE action LIKE 'questions.%' ORDER BY id")).rows;
    expect(log.map((r) => r.action)).toEqual(expect.arrayContaining(["questions.reworded", "questions.replaced", "questions.added", "questions.published"]));
    expect(log.filter((r) => r.action === "questions.replaced").at(-1)!.detail).toBe("mat_3 → mat_5");
  });

  it("compares a reworded question with last semester, but not a different skill", async () => {
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");
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
    expect(prev).toEqual({ mat_1: 2, mat_2: 2, mat_5: null, mat_4: 2, mat_6: null });
    // The family report says "Mia compares groups…", in words.
    expect(data.areas[2].skills[1].text).toBe("Mia compares groups and says which has more or fewer");
  });
});
