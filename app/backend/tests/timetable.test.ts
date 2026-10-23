// Subject timetable (BUILT.md changes 7 and 12): subjects, fixed weekly lessons, and subject teachers who are
// added on the class, see it, rate only their subject, and manage only their own lessons.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AreaAnswer, SessionUser, Subject } from "@peterhouse/shared";
import { makeClass, setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
let admin: SessionUser;
let lim: SessionUser; // K1 Sunflower's class teacher
let wong: SessionUser; // the Chinese teacher
let tan: SessionUser; // another class's teacher
let k1: Awaited<ReturnType<typeof makeClass>>;
let k1b: Awaited<ReturnType<typeof makeClass>>;
let subjects: Subject[];
const sub = (name: string) => subjects.find((s) => s.name.startsWith(name))!;

const sessionUser = (id: number, role: "admin" | "teacher"): SessionUser => ({ id, email: `${role}${id}@x.sg`, name: `${role} ${id}`, role, mustChangePassword: false });

beforeAll(async () => {
  t = await setupTestDb();
  const U = await import("../src/domain/users");
  const W = await import("../src/domain/workspace");
  const T = await import("../src/domain/timetable");
  await W.workspace();
  admin = sessionUser(await U.createUser(null, null, { email: "admin@x.sg", name: "Ms Admin", role: "admin", password: "an admin passphrase" }), "admin");
  lim = sessionUser(await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "a teacher passphrase" }), "teacher");
  wong = sessionUser(await U.createUser(null, null, { email: "wong@x.sg", name: "Ms Wong", role: "teacher", password: "a chinese passphrase" }), "teacher");
  tan = sessionUser(await U.createUser(null, null, { email: "tan@x.sg", name: "Ms Tan", role: "teacher", password: "another passphrase" }), "teacher");
  k1 = await makeClass([lim.id], "K1 Sunflower", "K1");
  k1b = await makeClass([tan.id], "K1 Rainbow", "K1");
  subjects = await T.listSubjects();
  // Ms Wong teaches Chinese in both K1 classes; the class page says so, not the timetable.
  const C = await import("../src/domain/classes");
  await C.setSubjectTeacher(k1.id, wong.id, [sub("Chinese").id]);
  await C.setSubjectTeacher(k1b.id, wong.id, [sub("Chinese").id]);
});
afterAll(async () => {
  await t.teardown();
});

describe("subjects", () => {
  it("start with English, Chinese, Maths and Happy Hour, and the school manages the list", async () => {
    const T = await import("../src/domain/timetable");
    expect(subjects.map((s) => s.name)).toEqual(["English", "Chinese 华文", "Maths", "Happy Hour"]);
    const art = await T.createSubject({ name: "Art", color: "peach" });
    await expect(T.createSubject({ name: "Art", color: "sky" })).rejects.toMatchObject({ status: 409 });
    // Each subject has its own colour.
    await expect(T.createSubject({ name: "Drama", color: "peach" })).rejects.toMatchObject({ status: 409, message: /colour/ });
    await T.updateSubject(art, { name: "Art and craft", color: "lilac", active: true });
    expect((await T.listSubjects()).find((s) => s.id === art)).toMatchObject({ name: "Art and craft", color: "lilac" });
    await T.deleteSubject(art);
  });
});

describe("a class's weekly lessons", () => {
  it("refuses overlaps in a class and warns when a teacher is double-booked", async () => {
    const T = await import("../src/domain/timetable");
    const lesson = { classId: k1.id, subjectId: sub("Chinese").id, weekday: 1, start: "09:00", end: "09:45", teacherId: wong.id, room: "Room 2" };
    expect((await T.saveLesson(admin, lesson)).warnings).toEqual([]);
    await expect(T.saveLesson(admin, { ...lesson, subjectId: sub("English").id, start: "09:30", end: "10:00", teacherId: null })).rejects.toMatchObject({ status: 409 });
    await expect(T.saveLesson(admin, { ...lesson, start: "09:02" })).rejects.toMatchObject({ status: 400 });
    await expect(T.saveLesson(admin, { ...lesson, start: "10:00", end: "09:30" })).rejects.toMatchObject({ status: 400 });
    // Ms Wong teaches K1 Rainbow at the same time: allowed, with a warning.
    const other = await T.saveLesson(admin, { ...lesson, classId: k1b.id });
    expect(other.warnings[0]).toMatch(/also teaching K1 Sunflower/);
    await T.saveLesson(admin, { ...lesson, subjectId: sub("English").id, start: "10:00", end: "10:45", teacherId: lim.id });
    // Only the class's teachers can be named: not Ms Tan (another class), not Ms Wong for a subject she does not teach here.
    await expect(T.saveLesson(admin, { ...lesson, subjectId: sub("Maths").id, start: "13:00", end: "13:30", teacherId: tan.id })).rejects.toMatchObject({ status: 400 });
    await expect(T.saveLesson(admin, { ...lesson, subjectId: sub("Maths").id, start: "13:00", end: "13:30", teacherId: wong.id })).rejects.toMatchObject({ status: 400 });
    const offered = ((await T.timetableView(admin, k1.id)) as import("@peterhouse/shared").TimetableView).teachers;
    expect(offered).toEqual([
      { id: lim.id, name: "Ms Lim", subjectIds: null },
      { id: wong.id, name: "Ms Wong", subjectIds: [sub("Chinese").id] },
    ]);
    await T.saveLesson(admin, { ...lesson, subjectId: sub("Happy Hour").id, start: "11:00", end: "11:30", teacherId: null });
    // Deleting a subject takes its lessons off the timetable with it.
    const music = await T.createSubject({ name: "Music", color: "teal" });
    await T.saveLesson(admin, { ...lesson, subjectId: music, start: "12:00", end: "12:30", teacherId: null });
    await T.deleteSubject(music);
    expect(((await T.timetableView(admin, k1.id)) as { lessons: { subjectId: number }[] }).lessons.some((l) => l.subjectId === music)).toBe(false);
    expect((await T.timetableView(admin, k1.id)) as { lessons: unknown[] }).toMatchObject({ className: "K1 Sunflower", editable: "all" });
  });

  it("lets a subject teacher manage only their own lessons", async () => {
    const T = await import("../src/domain/timetable");
    const view = (await T.timetableView(wong, k1.id)) as import("@peterhouse/shared").TimetableView;
    expect(view.editable).toEqual({ subjectIds: [sub("Chinese").id] });
    const mine = view.lessons.find((l) => l.subjectId === sub("Chinese").id)!;
    // Moving and adding their own Chinese lessons is fine.
    await T.saveLesson(wong, { classId: k1.id, subjectId: sub("Chinese").id, weekday: 1, start: "08:30", end: "09:00", teacherId: wong.id, room: "Room 2" }, mine.id);
    const added = await T.saveLesson(wong, { classId: k1.id, subjectId: sub("Chinese").id, weekday: 3, start: "09:00", end: "09:45", teacherId: wong.id, room: "" });
    // Not another subject, not someone else's lesson, not naming another teacher, not a class they do not teach.
    const english = view.lessons.find((l) => l.subjectId === sub("English").id)!;
    await expect(T.saveLesson(wong, { classId: k1.id, subjectId: sub("English").id, weekday: 2, start: "09:00", end: "09:45", teacherId: wong.id, room: "" })).rejects.toMatchObject({ status: 403 });
    await expect(T.deleteLesson(wong, english.id)).rejects.toMatchObject({ status: 403 });
    await expect(T.saveLesson(wong, { classId: k1.id, subjectId: sub("Chinese").id, weekday: 4, start: "09:00", end: "09:45", teacherId: lim.id, room: "" })).rejects.toMatchObject({ status: 403 });
    const k2 = await makeClass([], "K2 Star", "K2");
    await expect(T.saveLesson(wong, { classId: k2.id, subjectId: sub("Chinese").id, weekday: 1, start: "09:00", end: "09:45", teacherId: wong.id, room: "" })).rejects.toMatchObject({ status: 403 });
    // Ms Tan cannot touch K1 Sunflower's timetable at all.
    expect(((await T.timetableView(tan, k1.id)) as { classId: number }).classId).toBe(k1b.id);
    await T.deleteLesson(wong, added.id);
  });

  it("copies a timetable to other classes, without teachers who do not teach there", async () => {
    const T = await import("../src/domain/timetable");
    await expect(T.copyTimetable(k1.id, [k1.id])).rejects.toMatchObject({ status: 400 });
    expect(await T.copyTimetable(k1.id, [k1b.id])).toBe(1);
    const a = (await T.lessonsOf([k1.id])).map((l) => [l.weekday, l.start, l.subjectId]);
    const b = await T.lessonsOf([k1b.id]);
    expect(b.map((l) => [l.weekday, l.start, l.subjectId])).toEqual(a);
    // Ms Wong teaches Chinese in K1 Rainbow too, so she stays on it; Ms Lim does not, so English there has no teacher.
    expect(b.find((l) => l.subjectId === sub("Chinese").id)?.teacherId).toBe(wong.id);
    expect(b.find((l) => l.subjectId === sub("English").id)?.teacherId).toBeNull();
  });
});

describe("subject teachers and the children", () => {
  it("rate their own area, send their part to the lead, and the lead finishes the report", async () => {
    const W = await import("../src/domain/workspace");
    const R = await import("../src/domain/reviews");
    const A = await import("../src/domain/approval");
    const C = await import("../src/domain/classes");
    const mia = await k1.add("Mia", "she");
    // Ms Wong teaches Chinese in both K1 classes, so she sees both classes' children; Ms Tan only her own.
    expect((await W.listChildren(wong)).map((c) => c.name)).toEqual(["Mia"]);
    const r = await R.openReview((await R.getReviewRow(mia))!);
    const ans = (key: string, level = 4): AreaAnswer => ({ skills: Object.fromEntries(r.rubric.areas.find((a) => a.key === key)!.skills.map((s) => [s.key, { level: level as 4, touched: true }])), note: "", visited: true });
    // She is tagged with Chinese in this class, so the Chinese area is hers; areas nobody teaches stay with the lead.
    const areaTeachers = (await C.classDetail(k1.id)).areaTeachers;
    expect(areaTeachers.find((a) => a.key === "chi")).toMatchObject({ teacher: { id: wong.id }, source: "subject" });
    expect(areaTeachers.find((a) => a.key === "sed")).toMatchObject({ teacher: { id: lim.id }, source: "lead" });
    // The class page can set another teacher, and setting none goes back to whoever teaches it.
    await C.setAreaTeacher(k1.id, "chi", lim.id);
    expect((await C.classDetail(k1.id)).areaTeachers.find((a) => a.key === "chi")).toMatchObject({ teacher: { id: lim.id }, source: "set" });
    await expect(R.saveArea(wong, mia, "chi", ans("chi"))).rejects.toMatchObject({ status: 403 });
    await C.setAreaTeacher(k1.id, "chi", null);
    expect((await R.saveArea(wong, mia, "chi", ans("chi"))).ok).toBe(true);
    await expect(R.saveArea(wong, mia, "eng", ans("eng"))).rejects.toMatchObject({ status: 403 });
    expect((await W.listChildren(wong))[0]).toMatchObject({ iAmLead: false, myParts: [{ area: "Chinese", done: false }] });
    // She has her paragraph written, checks it, and sends it; then it is the lead's to change.
    await expect(R.sendPart(wong, mia, "chi")).rejects.toMatchObject({ status: 409 });
    const part = await R.writePart(wong, mia, "chi");
    expect(part.ok && part.text).toBeTruthy();
    await R.savePartText(wong, mia, "chi", "Mia 在华文课上很投入。");
    // The lead rates the rest, but cannot write the report until Ms Wong's part is in, nor change her area meanwhile.
    for (const a of r.rubric.areas) if (a.key !== "chi") await R.saveArea(lim, mia, a.key, ans(a.key));
    await expect(R.saveArea(lim, mia, "chi", ans("chi", 3))).rejects.toMatchObject({ status: 403, message: expect.stringContaining("Ms Wong is still working") });
    expect((await W.listChildren(lim)).find((c) => c.name === "Mia")).toMatchObject({ iAmLead: true, waitingFor: [{ area: "Chinese", teacher: "Ms Wong" }] });
    expect(await R.writeDraft(lim, mia)).toMatchObject({ ok: false, error: expect.stringContaining("Ms Wong (Chinese)") });
    await R.sendPart(wong, mia, "chi");
    await expect(R.saveArea(wong, mia, "chi", ans("chi", 3))).rejects.toMatchObject({ status: 409 });
    // The lead may still change her ratings; the report uses the paragraph she checked.
    expect((await R.saveArea(lim, mia, "chi", ans("chi", 4))).ok).toBe(true);
    await expect(R.writeDraft(wong, mia)).rejects.toMatchObject({ status: 403 });
    expect((await R.writeDraft(lim, mia)).ok).toBe(true);
    expect((await R.getReviewRow(mia))!.draft!.paragraphs.find((p) => p.key === "area:chi")!.text).toBe("Mia 在华文课上很投入。");
    await expect(A.submitForReview(wong, mia)).rejects.toMatchObject({ status: 403 });
    expect((await A.workflowFor(wong, (await R.getReviewRow(mia))!)).canSubmit).toBe(false);
    expect((await A.workflowFor(lim, (await R.getReviewRow(mia))!)).canSubmit).toBe(true);
    // She can take her part back to change it while the report is still with the teachers.
    await R.reopenPart(wong, mia, "chi");
    expect((await R.saveArea(wong, mia, "chi", ans("chi", 3))).ok).toBe(true);
  });

  it("lose the class, and its lessons, when the administrator takes them off it", async () => {
    const W = await import("../src/domain/workspace");
    const T = await import("../src/domain/timetable");
    const C = await import("../src/domain/classes");
    await C.setSubjectTeacher(k1.id, wong.id, []);
    await C.setSubjectTeacher(k1b.id, wong.id, []);
    expect(await W.listChildren(wong)).toEqual([]);
    // The lessons stay, with no teacher named.
    const chinese = (await T.lessonsOf([k1.id, k1b.id])).filter((l) => l.subjectId === sub("Chinese").id);
    expect(chinese.length).toBeGreaterThan(0);
    expect(chinese.every((l) => l.teacherId === null)).toBe(true);
    // A lesson alone never gives a class: being named needs the class page first.
    await expect(T.saveLesson(admin, { classId: k1.id, subjectId: sub("Chinese").id, weekday: 5, start: "09:00", end: "09:30", teacherId: wong.id, room: "" })).rejects.toMatchObject({ status: 400 });
  });

  it("a lead or co-teacher can be given subjects, and teaches every subject when given none", async () => {
    const C = await import("../src/domain/classes");
    const T = await import("../src/domain/timetable");
    const maths = sub("Maths").id;
    const english = sub("English").id;
    const lessonFor = (teacherId: number, subjectId: number) => ({ classId: k1.id, subjectId, weekday: 4, start: "13:00", end: "13:30", teacherId, room: "" });
    await T.saveLesson(admin, lessonFor(lim.id, english));
    await C.setSubjectTeacher(k1.id, lim.id, [maths]);
    const d = await C.classDetail(k1.id);
    expect(d.teacherSubjects[lim.id]).toEqual([maths]);
    expect(d.subjectTeachers.map((t) => t.name)).toEqual([]);
    // English is no longer one of Ms Lim's subjects, so she comes off that lesson.
    expect((await T.lessonsOf([k1.id])).find((l) => l.subjectId === english)?.teacherId).toBeNull();
    await C.setSubjectTeacher(k1.id, lim.id, []);
    expect((await C.classDetail(k1.id)).teacherSubjects[lim.id]).toBeUndefined();
    // A separate subject teacher is listed apart from the class's own teachers.
    await C.setSubjectTeacher(k1.id, tan.id, [maths]);
    expect((await C.classDetail(k1.id)).subjectTeachers.map((t) => t.name)).toEqual(["Ms Tan"]);
    await C.setSubjectTeacher(k1.id, tan.id, []);
  });
});
