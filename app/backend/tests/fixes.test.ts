// The review of 23 Oct 2026: photo consent, frozen approved reports, out-of-date paragraphs, hand back, reports left
// unapproved at the end of a semester, birthday corrections across levels, and when the questions are frozen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import type { AreaAnswer, Level, SessionUser } from "@peterhouse/shared";
import { makeClass, setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
let admin: SessionUser;
let lim: SessionUser;
let cls: Awaited<ReturnType<typeof makeClass>>;

const sessionUser = (uid: number, role: "admin" | "teacher"): SessionUser => ({ id: uid, email: `${role}${uid}@x.sg`, name: `${role} ${uid}`, role, mustChangePassword: false });

async function rateAll(id: number, level: Level = 4) {
  const R = await import("../src/domain/reviews");
  const r = await R.openReview((await R.getReviewRow(id))!);
  for (const a of r.rubric.areas) {
    const ans: AreaAnswer = { skills: Object.fromEntries(a.skills.map((s) => [s.key, { level, touched: true }])), note: "", visited: true };
    await R.saveArea(lim, id, a.key, ans);
  }
  return r;
}

async function approved(name: string) {
  const R = await import("../src/domain/reviews");
  const A = await import("../src/domain/approval");
  const id = await cls.add(name, "she");
  await rateAll(id);
  expect((await R.writeDraft(lim, id)).ok).toBe(true);
  await A.submitForReview(lim, id);
  await A.approve(admin, id);
  return id;
}

beforeAll(async () => {
  t = await setupTestDb();
  const U = await import("../src/domain/users");
  const W = await import("../src/domain/workspace");
  await W.workspace();
  admin = sessionUser(await U.createUser(null, null, { email: "admin@x.sg", name: "Ms Admin", role: "admin", password: "an admin passphrase" }), "admin");
  lim = sessionUser(await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "a teacher passphrase" }), "teacher");
  cls = await makeClass([lim.id]);
});
afterAll(async () => {
  await t.teardown();
});

describe("photo consent", () => {
  it("keeps photos off the report until the parents agree", async () => {
    const R = await import("../src/domain/reviews");
    const P = await import("../src/domain/photos");
    const C = await import("../src/domain/children");
    const id = await cls.add("Ava", "she");
    const r = await rateAll(id);
    const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#3c3" } }).jpeg().toBuffer();
    // A photo from before consent was recorded (or added some other way) never prints.
    const photo = await P.addPhoto(id, r.rubric.areas[0].key, jpeg);
    await P.setChildPhoto(r.child_id, jpeg);
    let data = await R.buildReportData((await R.getReviewRow(id))!);
    expect(data.photoIds).toEqual([]);
    expect(data.coverPhoto).toBeNull();
    // The administrator records consent on the profile; then they print.
    const profile = await C.childProfile(r.child_id);
    expect(profile.photoConsent).toBe(false);
    await C.updateChildInfo(r.child_id, { joinedOn: profile.joinedOn, guardians: [], notes: "", photoConsent: true });
    data = await R.buildReportData((await R.getReviewRow(id))!);
    expect(data.photoIds).toEqual([photo.id]);
    expect(data.coverPhoto).toMatch(/^\/api\/children\//);
  });

  it("lets the administrator record consent when adding a child", async () => {
    const R = await import("../src/domain/reviews");
    const C = await import("../src/domain/classes");
    const { reviewId } = await C.addChild({ firstName: "Ben", lastName: "", chineseName: "", pronoun: "he", dateOfBirth: cls.birthday(), classId: cls.id, photoConsent: true });
    expect((await R.getReviewRow(reviewId))!.photo_consent).toBe(true);
  });
});

describe("an approved report", () => {
  it("prints the same however the child, class or school change later", async () => {
    const R = await import("../src/domain/reviews");
    const S = await import("../src/domain/school");
    const id = await approved("Chloe");
    const before = await R.reportFor((await R.getReviewRow(id))!);
    expect(before.reportDate).toBeTruthy();
    const childId = (await R.getReviewRow(id))!.child_id;
    await t.pool.query("UPDATE children SET chinese_name = '' WHERE id = $1", [childId]);
    await S.setSchool({ ...(await S.getSchool()), name: "Another School" });
    const after = await R.reportFor((await R.getReviewRow(id))!);
    expect(after).toEqual(before);
    expect(after.school.name).not.toBe("Another School");
  });

  it("keeps the cover it was approved with when the profile photo changes", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    const P = await import("../src/domain/photos");
    const id = await cls.add("Lily", "she");
    const childId = (await R.getReviewRow(id))!.child_id;
    await t.pool.query("UPDATE children SET photo_consent = true WHERE id = $1", [childId]);
    const green = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#3c3" } }).jpeg().toBuffer();
    await P.setChildPhoto(childId, green);
    await rateAll(id);
    await R.writeDraft(lim, id);
    await A.submitForReview(lim, id);
    await A.approve(admin, id);
    const cover = (await R.reportFor((await R.getReviewRow(id))!)).data.coverPhoto!;
    expect(cover).toMatch(/^\/api\/photos\/\d+$/);
    const coverId = Number(cover.split("/").pop());
    const before = await P.readPhoto(coverId);
    await P.setChildPhoto(childId, await sharp({ create: { width: 64, height: 48, channels: 3, background: "#c33" } }).jpeg().toBuffer());
    expect((await R.reportFor((await R.getReviewRow(id))!)).data.coverPhoto).toBe(cover);
    expect((await P.readPhoto(coverId))!.equals(before!)).toBe(true);
  });

  it("refuses a Chinese name change from the teacher once approved", async () => {
    const R = await import("../src/domain/reviews");
    const id = await approved("Daisy");
    await expect(R.setChineseName(lim, id, "小花")).rejects.toMatchObject({ status: 409, code: "locked" });
  });

  it("is built fresh again once it is sent back", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    const id = await approved("Emma");
    await A.requestChanges(admin, id, "Please check the opening.");
    expect((await R.getReviewRow(id))!.approved_snapshot).toBeNull();
  });
});

describe("a paragraph whose ratings changed", () => {
  it("shows as out of date, and the teacher's own edit clears it", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    const id = await cls.add("Finn", "he");
    const r = await rateAll(id);
    await R.writeDraft(lim, id);
    const area = r.rubric.areas[0];
    await R.saveArea(lim, id, area.key, { skills: Object.fromEntries(area.skills.map((s) => [s.key, { level: 2, touched: true }])), note: "", visited: true });
    const para = (await R.getReviewRow(id))!.draft!.paragraphs.find((p) => p.key === `area:${area.key}`)!;
    expect(para.stale).toBe(true);
    await expect(A.submitForReview(lim, id)).rejects.toMatchObject({ status: 409 });
    await R.editParagraph(lim, id, `area:${area.key}`, `${para.text} He is still practising.`);
    expect(await A.submitForReview(lim, id)).toMatchObject({ version: 1 });
  });

  it("cannot be sent with a statement left unrated", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    const id = await cls.add("Gwen", "she");
    const r = await rateAll(id);
    await R.writeDraft(lim, id);
    const area = r.rubric.areas[0];
    await R.saveArea(lim, id, area.key, { skills: {}, note: "", visited: true });
    await R.editParagraph(lim, id, `area:${area.key}`, "Rewritten.");
    await expect(A.submitForReview(lim, id)).rejects.toMatchObject({ status: 409 });
  });
});

describe("taking over", () => {
  it("can be handed back to the teacher, even before anything is written", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    const id = await cls.add("Hana", "she");
    await A.takeOver(admin, id);
    expect((await A.workflowFor(admin, (await R.getReviewRow(id))!)).canHandBack).toBe(true);
    expect((await A.workflowFor(lim, (await R.getReviewRow(id))!)).locked).toMatch(/taken this report over/);
    await A.handBack(admin, id);
    const row = (await R.getReviewRow(id))!;
    expect(row.taken_over_by).toBeNull();
    expect(R.lockReason(lim, row)).toBeNull();
    await expect(A.handBack(admin, id)).rejects.toMatchObject({ status: 409 });
  });
});

describe("questions", () => {
  it("are not frozen by someone only looking at the review", async () => {
    const R = await import("../src/domain/reviews");
    const id = await cls.add("Ivy", "she");
    // The review page loads the row without opening it; the first saved rating freezes it.
    expect((await R.getReviewRow(id))!.opened).toBe(false);
    await rateAll(id);
    expect((await R.getReviewRow(id))!.opened).toBe(true);
  });

  it("follow a corrected birthday into another level", async () => {
    const R = await import("../src/domain/reviews");
    const C = await import("../src/domain/classes");
    const k2 = await makeClass([lim.id], "K2 Rainbow", "K2");
    const id = await cls.add("Jack", "he");
    await rateAll(id);
    await C.updateChild(id, { firstName: "Jack", lastName: "", chineseName: "", dateOfBirth: k2.birthday(), pronoun: "he" }, k2.id);
    const moved = (await R.getReviewRow(id))!;
    expect(moved.class_level).toBe("K2");
    const Q = await import("../src/domain/questions");
    const { rubricForLevel, normaliseRubric } = await import("@peterhouse/shared");
    expect(moved.rubric).toEqual(normaliseRubric(rubricForLevel((await Q.publishedRubric()).rubric, "K2")));
  });
});

describe("the end of a semester", () => {
  it("still lets a report it closed on be sent and approved", async () => {
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    const W = await import("../src/domain/workspace");
    const id = await cls.add("Kai", "he");
    await rateAll(id);
    await R.writeDraft(lim, id);
    await W.startNextSemester(admin);
    expect((await R.getReviewRow(id))!.term_status).toBe("closed");
    await A.submitForReview(lim, id);
    await A.approve(admin, id);
    expect((await R.getReviewRow(id))!.status).toBe("approved");
    // Once approved it is fixed, like any other.
    expect(R.lockReason(lim, (await R.getReviewRow(id))!)).toMatch(/approved/);
  });
});

describe("staff photos", () => {
  it("can be changed by the person or an administrator, shows in the people list, and is stored encrypted", async () => {
    const P = await import("../src/domain/photos");
    const U = await import("../src/domain/users");
    const other = sessionUser(await U.createUser(null, null, { email: "other@x.sg", name: "Ms Other", role: "teacher", password: "another passphrase" }), "teacher");
    expect(P.canChangeUserPhoto(lim, lim.id)).toBe(true);
    expect(P.canChangeUserPhoto(admin, lim.id)).toBe(true);
    expect(P.canChangeUserPhoto(other, lim.id)).toBe(false);

    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#c33" } }).png().toBuffer();
    expect(await P.readUserPhoto(lim.id)).toBeNull();
    await P.setUserPhoto(lim.id, png);
    expect((await P.readUserPhoto(lim.id))!.subarray(0, 2).toString("hex")).toBe("ffd8");
    const raw = await t.pool.query("SELECT data FROM user_photos WHERE user_id = $1", [lim.id]);
    expect(raw.rows[0].data.subarray(0, 2).toString("hex")).not.toBe("ffd8");
    expect((await U.listUsers()).find((u) => u.id === lim.id)!.photo).toMatch(new RegExp(`^/api/users/${lim.id}/photo\\?v=\\d+$`));

    await P.clearUserPhoto(lim.id);
    expect((await U.listUsers()).find((u) => u.id === lim.id)!.photo).toBeNull();
  });
});
