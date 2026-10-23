// Teachers own the report; the administrator reviews it (BUILT.md changes 1 and 3).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AreaAnswer, SessionUser } from "@peterhouse/shared";
import { makeClass, setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
let admin: SessionUser;
let lim: SessionUser;
let tan: SessionUser;
let id: number;

const sessionUser = (uid: number, role: "admin" | "teacher"): SessionUser => ({ id: uid, email: `${role}${uid}@x.sg`, name: `${role} ${uid}`, role, mustChangePassword: false });

beforeAll(async () => {
  t = await setupTestDb();
  const U = await import("../src/domain/users");
  const W = await import("../src/domain/workspace");
  const R = await import("../src/domain/reviews");
  await W.workspace();
  admin = sessionUser(await U.createUser(null, null, { email: "admin@x.sg", name: "Ms Admin", role: "admin", password: "an admin passphrase" }), "admin");
  lim = sessionUser(await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "a teacher passphrase" }), "teacher");
  tan = sessionUser(await U.createUser(null, null, { email: "tan@x.sg", name: "Ms Tan", role: "teacher", password: "another passphrase" }), "teacher");
  // Ms Lim leads the class, Ms Tan co-teaches it.
  const cls = await makeClass([lim.id, tan.id]);
  id = await cls.add("Mia", "she");
  const r = await R.openReview((await R.getReviewRow(id))!);
  for (const a of r.rubric.areas) {
    const ans: AreaAnswer = { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level: 4, touched: true }])), note: a.key === "mat" ? "Counted shells." : "", visited: true };
    await R.saveArea(lim, id, a.key, ans);
  }
});
afterAll(async () => {
  await t.teardown();
});

describe("teachers write, the administrator approves", () => {
  it("submits a written report, freezes it, and locks it while it waits", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    await expect(A.submitForReview(lim, id)).rejects.toMatchObject({ status: 409 });
    expect((await R.writeDraft(lim, id)).ok).toBe(true);
    // Before approval nobody gets the PDF for families, and an administrator cannot just edit it.
    let wf = await A.workflowFor(lim, (await R.getReviewRow(id))!);
    expect(wf).toMatchObject({ status: "written", canSubmit: true, canDownload: false, locked: null });
    await expect(R.editParagraph(admin, id, "opening", "Admin wording")).rejects.toMatchObject({ status: 409, code: "locked" });
    await expect(A.submitForReview(admin, id)).rejects.toMatchObject({ status: 403 });

    // Only the lead teacher sends it; the co-teacher sends their own parts to the lead.
    await expect(A.submitForReview(tan, id)).rejects.toMatchObject({ status: 403 });
    expect(await A.submitForReview(lim, id)).toMatchObject({ version: 1 });
    wf = await A.workflowFor(lim, (await R.getReviewRow(id))!);
    expect(wf).toMatchObject({ status: "submitted", versions: 1, canTakeBack: true, canSubmit: false });
    expect(wf.locked).toMatch(/waiting for review/);
    await expect(R.saveArea(lim, id, "eng", { skills: {}, note: "", visited: true })).rejects.toMatchObject({ code: "locked" });
    expect(await A.waitingCount()).toBe(1);
    expect((await A.approvalsView({})).items.map((i) => i.childName)).toEqual(["Mia"]);
  });

  it("lets the teacher take it back, change it and send it again", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    await A.takeBack(lim, id);
    await R.editParagraph(lim, id, "opening", "Mia has had a wonderful semester with us.");
    expect(await A.submitForReview(lim, id)).toMatchObject({ version: 2 });
    const extras = await A.approvalExtras(id);
    // Only the paragraph the teacher changed is marked.
    expect(extras.changedSinceLast).toHaveLength(1);
    expect(extras.versions.map((v) => [v.version, v.decision])).toEqual([
      [2, null],
      [1, "taken_back"],
    ]);
    // The teacher's comment and ratings sit beside the report.
    expect(extras.areas.find((a) => a.key === "mat")).toMatchObject({ note: "Counted shells." });
    expect(extras.areas[0].ratings[0].word).toBe("Confidently");
  });

  it("sends it back with a note, and the teacher sees it", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    await expect(A.requestChanges(admin, id, "  ")).rejects.toMatchObject({ status: 400 });
    await A.requestChanges(admin, id, "Please soften the maths paragraph.");
    const wf = await A.workflowFor(lim, (await R.getReviewRow(id))!);
    expect(wf).toMatchObject({ status: "changes_requested", canSubmit: true, locked: null });
    expect(wf.changeNote).toMatchObject({ text: "Please soften the maths paragraph.", by: "Ms Admin" });
    // Writing again keeps it "Changes requested" until it is sent again.
    await R.writeDraft(lim, id);
    expect((await R.getReviewRow(id))!.status).toBe("changes_requested");
    expect(await A.submitForReview(lim, id)).toMatchObject({ version: 3 });
    expect((await A.approvalExtras(id)).versions[1]).toMatchObject({ version: 2, decision: "changes_requested", note: "Please soften the maths paragraph." });
  });

  it("approves it: the PDF is allowed and nobody can change it", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    await expect(A.approve(lim, id)).rejects.toMatchObject({ status: 403 });
    await A.approve(admin, id);
    const r = (await R.getReviewRow(id))!;
    expect(r.status).toBe("approved");
    const wf = await A.workflowFor(lim, r);
    expect(wf).toMatchObject({ canDownload: true, canSubmit: false, changeNote: null });
    expect(wf.approved).not.toBeNull();
    await expect(R.editParagraph(lim, id, "opening", "x")).rejects.toMatchObject({ code: "locked" });
    await expect(A.takeOver(admin, id)).rejects.toMatchObject({ status: 409 });
    // Something wrong after approval: the administrator sends it back.
    await A.requestChanges(admin, id, "The name is spelled wrong.");
    expect((await R.getReviewRow(id))!.status).toBe("changes_requested");
  });

  it("lets the administrator take it over for the last-minute case", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    await A.takeOver(admin, id);
    const r = (await R.getReviewRow(id))!;
    expect((await A.workflowFor(lim, r)).locked).toMatch(/taken this report over/);
    await expect(R.editParagraph(lim, id, "opening", "x")).rejects.toMatchObject({ code: "locked" });
    await R.editParagraph(admin, id, "opening", "Mia has grown in confidence this semester.");
    expect((await R.getReviewRow(id))!.admin_edited).toBe(true);
    await A.approve(admin, id);
    const done = (await R.getReviewRow(id))!;
    expect(done).toMatchObject({ status: "approved", taken_over_by: null });
    // The administrator's version is kept as the one that was approved.
    expect((await A.approvalExtras(id)).versions[0]).toMatchObject({ version: 4, decision: "approved", submittedBy: "Ms Admin" });
    expect((await A.approvalsView({ status: "approved" })).items[0]).toMatchObject({ childName: "Mia", adminEdited: true });
  });

  it("records the administrator's edit as its own version when taking over a submitted report", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    await A.requestChanges(admin, id, "One more look, please.");
    expect(await A.submitForReview(lim, id)).toMatchObject({ version: 5 });
    await A.takeOver(admin, id);
    await R.editParagraph(admin, id, "opening", "Final wording from the office.");
    await A.approve(admin, id);
    const [approved, teachers] = (await A.approvalExtras(id)).versions;
    expect(approved).toMatchObject({ version: 6, decision: "approved", submittedBy: "Ms Admin" });
    expect(teachers).toMatchObject({ version: 5, decision: "changes_requested", note: "Taken over and changed by an administrator." });
    expect((await A.approvalExtras(id)).changedSinceLast).toHaveLength(1);
  });

  it("lists every report period, and the queue can open a past one", async () => {
    const A = await import("../src/domain/approval");
    const W = await import("../src/domain/workspace");
    const before = await A.periodsView();
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({ current: true, total: 1, counts: { approved: 1 } });
    await W.startNextSemester(admin);
    const [now, past] = await A.periodsView();
    expect(now).toMatchObject({ current: true, total: 1, counts: { approved: 0, not_submitted: 1 } });
    expect(past).toMatchObject({ current: false, termId: before[0].termId, total: 1, counts: { approved: 1 } });
    expect((await A.approvalsView({ status: "approved", termId: past.termId })).items.map((i) => i.childName)).toEqual(["Mia"]);
    expect((await A.approvalsView({ status: "approved" })).items).toEqual([]);
    await expect(A.approvalsView({ termId: 999999 })).rejects.toMatchObject({ status: 404 });
    // A teacher's own Reports page: both semesters of their class, nothing for someone who teaches no class.
    expect((await A.periodsView(lim.id)).map((p) => p.total)).toEqual([1, 1]);
    expect((await A.approvalsView({ status: "approved", termId: past.termId, forUser: lim.id })).items.map((i) => i.childName)).toEqual(["Mia"]);
    expect((await A.approvalsView({ status: "approved", termId: past.termId, forUser: 987654 })).items).toEqual([]);
    expect((await A.periodsView(987654)).map((p) => p.total)).toEqual([0]);
  });
});
