// The whole teacher journey on a real Postgres: add a child, answer the questions, write the report,
// and prove that nothing identifying is stored in the clear.
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AreaAnswer, SessionUser } from "@peterhouse/shared";
import { makeClass, setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
let admin: SessionUser;
let teacher: SessionUser;
let otherTeacher: SessionUser;
let cls: Awaited<ReturnType<typeof makeClass>>;

const sessionUser = (id: number, role: "admin" | "teacher"): SessionUser => ({ id, email: `${role}${id}@x.sg`, name: `${role} ${id}`, role, mustChangePassword: false });

beforeAll(async () => {
  t = await setupTestDb();
  const U = await import("../src/domain/users");
  const W = await import("../src/domain/workspace");
  await W.workspace();
  admin = sessionUser(await U.createUser(null, null, { email: "admin@x.sg", name: "Ms Admin", role: "admin", password: "an admin passphrase" }), "admin");
  teacher = sessionUser(await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "a teacher passphrase" }), "teacher");
  otherTeacher = sessionUser(await U.createUser(null, null, { email: "tan@x.sg", name: "Ms Tan", role: "teacher", password: "another passphrase" }), "teacher");
  // Ms Lim teaches K1 Sunflower; Ms Tan teaches a different class.
  cls = await makeClass([teacher.id]);
  await makeClass([otherTeacher.id], "K1 Rainbow");
});
afterAll(async () => {
  await t.teardown();
});

describe("teacher journey", () => {
  it("goes from a new child to a written report", async () => {
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");
    const id = await cls.add("Mia 陈", "she", cls.birthday("03-04"));
    expect(await W.listChildren(teacher)).toMatchObject([{ name: "Mia 陈", answered: 0, hasReport: false }]);

    // Opening the review freezes the published questions (rule 2).
    const r0 = await R.openReview((await R.getReviewRow(id))!);
    expect(r0.status).toBe("draft");
    expect(r0.rubric_version_id).not.toBeNull();
    expect(r0.rubric.areas.map((a) => a.key)).toEqual(["eng", "chi", "mat", "sed", "enr"]);
    expect(r0.rubric.areas.reduce((n, a) => n + a.skills.length, 0)).toBe(19);

    // Writing before answering is refused.
    expect((await R.writeDraft(teacher, id)).ok).toBe(false);

    // Blank start: an untouched rating does not count, "Not seen yet" does.
    const eng = r0.rubric.areas[0];
    await R.saveArea(teacher, id, eng.key, { skills: { [eng.skills[0].key]: { level: 4, touched: true } }, note: "", visited: true });
    expect((await W.listChildren(teacher))[0]).toMatchObject({ answered: 1 });
    for (const a of r0.rubric.areas) {
      const ans: AreaAnswer = {
        skills: Object.fromEntries(a.skills.map((s, i) => [s.key, { level: a.key === "sed" && i === 0 ? 0 : 4, touched: true }])),
        note: a.key === "mat" ? "Counted 12 shells at the beach table." : "",
        visited: true,
        ...(a.love ? { love: "Loved the music corner", home: [a.homeIdeas![0], a.homeIdeas![1], a.homeIdeas![2], "not on the list"] } : {}),
      };
      expect((await R.saveArea(teacher, id, a.key, ans)).ok).toBe(true);
    }
    expect((await R.getReviewRow(id))!.status).toBe("ready");
    // Only two picks from the domain's own list are kept, and the comment is cut at 140 characters.
    const enr = (await R.loadAnswers(id, r0.rubric)).answers.enr;
    expect(enr.home).toEqual([r0.rubric.areas[4].homeIdeas![0], r0.rubric.areas[4].homeIdeas![1]]);
    await R.saveArea(teacher, id, "mat", { skills: Object.fromEntries(r0.rubric.areas[2].skills.map((s) => [s.key, { level: 4, touched: true }])), note: "x".repeat(300), visited: true });
    expect((await R.loadAnswers(id, r0.rubric)).answers.mat.note).toHaveLength(140);
    const [item] = await W.listChildren(teacher);
    expect(item.answered).toBe(item.total);

    const out = await R.writeDraft(teacher, id);
    expect(out).toMatchObject({ ok: true, provider: "sentence_bank" });
    const written = (await R.getReviewRow(id))!;
    expect(written.status).toBe("written");
    expect(written.draft!.paragraphs.length).toBe(r0.rubric.areas.length + 2);

    const data = await R.buildReportData(written);
    expect(data.childName).toBe("Mia 陈");
    expect(data.childInitial).toBe("M");
    expect(data.opening.length).toBeGreaterThan(20);
    // Families get the teacher's picks, statements with the name filled in, and never a number.
    expect(data.homeIdeas).toEqual(r0.rubric.areas[4].homeIdeas!.slice(0, 2));
    expect(data.areas[0].skills[0].text).toBe("Mia 陈 listens well and responds in a group");
    expect(data.areas[3].skills[2].text).toBe("Mia 陈 can say how she feels");
    expect(data.areas[4].love).toMatchObject({ answer: "Loved the music corner" });
    expect(JSON.stringify(data)).not.toMatch(/"score"|overallScore/);

    // Changing an answer marks that paragraph stale and never rewrites it silently.
    const area = r0.rubric.areas[0];
    await R.saveArea(teacher, id, area.key, { skills: Object.fromEntries(area.skills.map((s) => [s.key, { level: 2, touched: true }])), note: "", visited: true });
    const after = (await R.getReviewRow(id))!;
    expect(after.draft!.paragraphs.find((p) => p.key === `area:${area.key}`)!.stale).toBe(true);

    // The first draft is kept as a version when the report is written again.
    await R.writeDraft(teacher, id);
    expect((await t.pool.query("SELECT count(*)::int AS n FROM draft_versions WHERE review_id = $1", [id])).rows[0].n).toBe(1);
  });
});

describe("who can see which class", () => {
  it("hides a child from a teacher who is not in the class, and from the class list", async () => {
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");
    const [mine] = await W.listChildren(teacher);
    await expect(R.getReviewForUser(otherTeacher, mine.reviewId)).rejects.toMatchObject({ status: 404 });
    expect(await W.listChildren(otherTeacher)).toEqual([]);
    await expect(R.saveArea(otherTeacher, mine.reviewId, "eng", { skills: {}, note: "sneaky", visited: true })).rejects.toMatchObject({ status: 404 });
    // An administrator sees every class.
    expect((await W.listChildren(admin)).length).toBe(1);
  });
});

describe("encryption at rest", () => {
  it("stores no name, birthday, note or report text in the clear", async () => {
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");
    const dob = cls.birthday("02-27");
    const id = await cls.add("Zelda Quimby", "she", dob, "王美丽");
    await R.saveStaffNote(teacher, id, "Mother prefers phone calls");
    const rev = await R.openReview((await R.getReviewRow(id))!);
    const area = rev.rubric.areas[0];
    await R.saveArea(teacher, id, area.key, { skills: Object.fromEntries(area.skills.map((s) => [s.key, { level: 5, touched: true }])), note: "Built a tower of nine blocks", visited: true });
    await R.saveArea(teacher, id, "enr", { skills: {}, note: "", love: "Loved the purple dinosaur puzzle", home: [], visited: true });

    const dump = JSON.stringify(
      await Promise.all(["children", "reviews", "review_notes", "review_areas", "draft_versions", "activity_log"].map(async (tbl) => (await t.pool.query(`SELECT * FROM ${tbl}`)).rows)),
    );
    for (const secret of ["Zelda", "Quimby", "王美丽", dob, "purple dinosaur", "phone calls", "tower of nine"]) {
      expect(dump, `"${secret}" must not appear in the database`).not.toContain(secret);
    }
    // …but the app reads it all back.
    expect(rev.preferred_name).toBe("Zelda Quimby");
    expect(rev.chinese_name).toBe("王美丽");
    expect((await R.loadAnswers(id, rev.rubric)).answers.enr.love).toBe("Loved the purple dinosaur puzzle");
    expect((await R.loadAnswers(id, rev.rubric)).answers[area.key].note).toBe("Built a tower of nine blocks");
  });

  it("stores photos encrypted in the database and serves them back", async () => {
    const W = await import("../src/domain/workspace");
    const P = await import("../src/domain/photos");
    const id = await cls.add("Photo Child", "they");
    const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#c33" } }).jpeg().toBuffer();
    const { id: photoId } = await P.addPhoto(id, "eng", jpeg);
    const stored = (await t.pool.query("SELECT data FROM review_photos WHERE id = $1", [photoId])).rows[0].data as Buffer;
    expect(stored.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(false);
    expect(stored.includes(jpeg.subarray(0, 40))).toBe(false);
    const back = await P.readPhoto(photoId);
    expect(back!.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
    // Without consent the report may not show it.
    expect(await P.reportPhotoIds(id)).toEqual([]);
    await P.setPhotoConsent(id, true);
    expect(await P.reportPhotoIds(id)).toEqual([photoId]);
    // Three per learning area.
    await P.addPhoto(id, "eng", jpeg);
    await P.addPhoto(id, "eng", jpeg);
    await expect(P.addPhoto(id, "eng", jpeg)).rejects.toMatchObject({ status: 400 });
    await P.addPhoto(id, "mat", jpeg);
  });
});

describe("semesters", () => {
  it("keeps Semester 1 intact and shows it beside Semester 2", async () => {
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");
    const mia = (await W.listChildren(admin)).find((c) => c.name === "Mia 陈")!;
    expect(mia.hasReport).toBe(true);
    const s1Id = mia.reviewId;
    const s1Before = await R.loadAnswers(s1Id, (await R.getReviewRow(s1Id))!.rubric);
    const first = await W.getReportPeriod(); // whichever semester the clock says it is
    const second = first.season === "June" ? "December" : "June";

    // The teacher sends the report for review and the administrator approves it.
    const A = await import("../src/domain/approval");
    await A.submitForReview(teacher, s1Id);
    await A.approve(admin, s1Id);
    await expect(W.startNextSemester(teacher)).rejects.toMatchObject({ status: 403 });
    const next = await W.startNextSemester(admin);
    expect(next.semester).toBe(first.season === "June" ? 2 : 1);
    expect(await W.getReportPeriod()).toMatchObject({ season: second, year: first.season === "June" ? first.year : first.year + 1 });

    // Semester 1 is now the record: approved, closed, and its answers untouched.
    const s1 = (await R.getReviewRow(s1Id))!;
    expect(s1.status).toBe("approved");
    expect(s1.term_status).toBe("closed");
    expect(await R.loadAnswers(s1Id, s1.rubric)).toEqual(s1Before);

    // Every child starts Semester 2 with a blank review of their own.
    const s2 = (await W.listChildren(admin)).find((c) => c.name === "Mia 陈")!;
    expect(s2.reviewId).not.toBe(s1Id);
    expect(s2).toMatchObject({ answered: 0, hasReport: false });
    expect((await W.listChildren(teacher)).length).toBe((await W.listChildren(admin)).length);

    const r2 = await R.openReview((await R.getReviewRow(s2.reviewId))!);
    for (const a of r2.rubric.areas) {
      await R.saveArea(teacher, r2.id, a.key, { skills: Object.fromEntries(a.skills.map((sk) => [sk.key, { level: 5, touched: true }])), note: "", visited: true });
    }
    await R.writeDraft(teacher, r2.id);
    const data = await R.buildReportData((await R.getReviewRow(r2.id))!);
    expect(data.season).toBe(second);
    expect(data.previousSeason).toBe(first.season);
    // The earlier semester gave the first area 2 and every other area 4.
    expect(data.areas[0].skills.every((sk) => sk.level === 5 && sk.previous === 2)).toBe(true);
    expect(data.areas[1].skills.every((sk) => sk.level === 5 && sk.previous === 4)).toBe(true);

    // The same semester cannot be started twice.
    await t.pool.query("UPDATE terms SET status = 'open' WHERE id = $1", [s1.term_id]);
    await t.pool.query("UPDATE terms SET status = 'closed' WHERE id = $1", [r2.term_id]);
    await expect(W.startNextSemester(admin)).rejects.toMatchObject({ status: 409 });
  });
});

describe("migrations", () => {
  it("are recorded, checksummed, and not re-applied", async () => {
    const { migrate } = await import("../src/migrate");
    expect(await migrate(t.pool, () => {})).toEqual([]);
    const rows = (await t.pool.query("SELECT version, checksum FROM schema_migrations")).rows;
    expect(rows.map((r) => r.version)).toEqual(["0001_init.sql", "0002_teacher_questions.sql", "0003_classes.sql", "0004_review_workflow.sql"]);
    expect(rows[0].checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});
