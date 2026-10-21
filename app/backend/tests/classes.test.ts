// Classes by level (CHANGES-TO-MAKE change 4): the level comes from the birth year with no exceptions, the administrator
// places children, teachers see only their own classes, and a new year moves every class up a level.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@peterhouse/shared";
import { classCapacity, levelForBirthday, nameForNextLevel, nextLevel } from "@peterhouse/shared";
import { setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
let admin: SessionUser;
let lim: SessionUser;
let tan: SessionUser;
let year: number;

const sessionUser = (id: number, role: "admin" | "teacher"): SessionUser => ({ id, email: `${role}${id}@x.sg`, name: `${role} ${id}`, role, mustChangePassword: false });
const born = (turns: number, md = "06-15") => `${year - turns}-${md}`;

beforeAll(async () => {
  t = await setupTestDb();
  const U = await import("../src/domain/users");
  const W = await import("../src/domain/workspace");
  await W.workspace();
  year = (await W.getReportPeriod()).year;
  admin = sessionUser(await U.createUser(null, null, { email: "admin@x.sg", name: "Ms Admin", role: "admin", password: "an admin passphrase" }), "admin");
  lim = sessionUser(await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "a teacher passphrase" }), "teacher");
  tan = sessionUser(await U.createUser(null, null, { email: "tan@x.sg", name: "Ms Tan", role: "teacher", password: "another passphrase" }), "teacher");
});
afterAll(async () => {
  await t.teardown();
});

describe("level from the birth year", () => {
  it("uses the age the child turns this calendar year", () => {
    expect(levelForBirthday("2024-01-10", 2026)).toEqual({ level: "PG" });
    expect(levelForBirthday("2023-12-31", 2026)).toEqual({ level: "N1" });
    // Turning 4 in January and in December: both N2.
    expect(levelForBirthday("2022-01-01", 2026)).toEqual({ level: "N2" });
    expect(levelForBirthday("2022-12-31", 2026)).toEqual({ level: "N2" });
    expect(levelForBirthday("2021-05-06", 2026)).toEqual({ level: "K1" });
    expect(levelForBirthday("2020-02-29", 2026)).toEqual({ level: "K2" });
    expect(levelForBirthday("2025-03-01", 2026)).toEqual({ problem: "too_young" });
    expect(levelForBirthday("2019-03-01", 2026)).toEqual({ problem: "too_old" });
    expect(levelForBirthday("", 2026)).toEqual({ problem: "no_birthday" });
  });

  it("knows the teacher ratios and the next level", () => {
    expect(classCapacity("K1", 1)).toBe(12);
    expect(classCapacity("K1", 2)).toBe(24);
    expect(classCapacity("PG", 0)).toBe(6);
    expect(nextLevel("N2")).toBe("K1");
    expect(nextLevel("K2")).toBeNull();
    expect(nameForNextLevel("K1 Sunflower", "K1", "K2")).toBe("K2 Sunflower");
    expect(nameForNextLevel("Sunflower", "K1", "K2")).toBe("Sunflower");
  });
});

describe("the administrator manages classes", () => {
  it("places a child only in a class of their own level", async () => {
    const C = await import("../src/domain/classes");
    const W = await import("../src/domain/workspace");
    const k1 = await C.createClass("K1 Sunflower", "K1");
    const n2 = await C.createClass("N2 Rainbow", "N2");
    const pg = await C.createClass("PG Little Stars", "PG");
    await expect(C.createClass("K1 Sunflower", "K1")).rejects.toMatchObject({ status: 409 });
    await C.setClassStaff(k1, lim.id, []);
    await C.setClassStaff(n2, tan.id, []);
    // Only teachers can be placed, and an administrator cannot be.
    await expect(C.setClassStaff(k1, admin.id, [])).rejects.toMatchObject({ status: 400 });

    const child = { chineseName: "", pronoun: "she" as const };
    const mia = (await C.addChild({ ...child, name: "Mia", dateOfBirth: born(5), classId: k1 })).reviewId;
    // No exceptions: a four-year-old cannot join K1, a six-year-old cannot join Playgroup, and a birthday is required.
    await expect(C.addChild({ ...child, name: "Ava", dateOfBirth: born(4), classId: k1 })).rejects.toMatchObject({ status: 409, code: "wrong_level" });
    await expect(C.addChild({ ...child, name: "Sam", dateOfBirth: born(6), classId: pg })).rejects.toMatchObject({ status: 409, code: "wrong_level" });
    await expect(C.addChild({ ...child, name: "Kit", dateOfBirth: born(1), classId: pg })).rejects.toMatchObject({ status: 409 });
    await expect(C.addChild({ ...child, name: "Nob", dateOfBirth: "", classId: k1 })).rejects.toMatchObject({ status: 409 });
    const ava = (await C.addChild({ ...child, name: "Ava", dateOfBirth: born(4), classId: n2 })).reviewId;
    const ben = (await C.addChild({ ...child, name: "Ben", dateOfBirth: born(4, "01-01"), classId: n2 })).reviewId;

    // Teachers see only their own class.
    expect((await W.listChildren(lim)).map((c) => c.name)).toEqual(["Mia"]);
    expect((await W.listChildren(tan)).map((c) => c.name)).toEqual(["Ava", "Ben"]);
    expect((await C.classesFor(tan)).map((k) => k.name)).toEqual(["N2 Rainbow"]);
    expect((await C.classesFor(admin)).map((k) => k.name)).toEqual(["PG Little Stars", "N2 Rainbow", "K1 Sunflower"]);

    const detail = await C.classDetail(k1);
    expect(detail).toMatchObject({ level: "K1", birthYear: year - 5, lead: { id: lim.id }, children: 1, capacity: 12 });

    // Moving works only between classes of the same level.
    await expect(C.moveChild(ava, k1)).rejects.toMatchObject({ status: 409, code: "wrong_level" });
    const n2b = await C.createClass("N2 Ocean", "N2");
    await C.moveChild(ava, n2b);
    expect((await C.classDetail(n2b)).pupils.map((p) => p.name)).toEqual(["Ava"]);
    await C.moveChild(ava, n2);

    // A child who leaves drops out of the class but keeps their review.
    await C.setChildLeft(ben, true);
    expect((await W.listChildren(tan)).map((c) => c.name)).toEqual(["Ava"]);
    expect((await C.classDetail(n2)).pupils.find((p) => p.name === "Ben")).toMatchObject({ left: true });
    await C.setChildLeft(ben, false);

    // A corrected birthday must fit the class, or move the child to a class of the new level at the same time.
    const mias = { name: "Mia", chineseName: "", pronoun: "she" as const, dateOfBirth: born(4) };
    await expect(C.updateChild(mia, mias)).rejects.toMatchObject({ status: 409, code: "wrong_level" });
    await C.updateChild(mia, mias, n2);
    expect((await C.classDetail(n2)).pupils.find((p) => p.name === "Mia")).toMatchObject({ level: "N2" });
    await C.updateChild(mia, { ...mias, dateOfBirth: born(5) }, k1);
    expect((await C.classesView()).flagged).toEqual([]);

    // A class with children cannot change level or be removed.
    await expect(C.updateClass(n2, { level: "K1" })).rejects.toMatchObject({ status: 409 });
    await expect(C.deleteClass(n2)).rejects.toMatchObject({ status: 409 });
    await C.deleteClass(pg);
    await C.deleteClass(n2b);
  });

  it("allows one lead teacher and any number of co-teachers", async () => {
    const C = await import("../src/domain/classes");
    const [k1] = (await C.classesView()).classes.filter((k) => k.name === "K1 Sunflower");
    await C.setClassStaff(k1.id, tan.id, [lim.id, tan.id]);
    const d = await C.classDetail(k1.id);
    expect(d.lead).toMatchObject({ id: tan.id });
    expect(d.co.map((c) => c.id)).toEqual([lim.id]);
    expect(d.capacity).toBe(24);
    await C.setClassStaff(k1.id, lim.id, []);
  });
});

describe("a new semester", () => {
  it("keeps classes as they are within the year, and moves everyone up a level in January", async () => {
    const C = await import("../src/domain/classes");
    const W = await import("../src/domain/workspace");
    const k2 = await C.createClass("K2 Star", "K2");
    await C.addChild({ name: "Zoe", chineseName: "", pronoun: "she", dateOfBirth: born(6), classId: k2 });

    const sem = (await W.getReportPeriod()).season;
    // Get to Semester 2 first, so the next start is a new year.
    if (sem === "June") {
      await W.startNextSemester(admin);
      expect((await C.classesFor(admin)).map((k) => `${k.name}:${k.children}`)).toEqual(["N2 Rainbow:2", "K1 Sunflower:1", "K2 Star:1"]);
    }
    const out = await W.startNextSemester(admin);
    expect(out.semester).toBe(1);
    expect(out.graduated).toBe(1);
    year = out.year;
    const now = await C.classesFor(admin);
    expect(now.map((k) => `${k.name}:${k.level}:${k.children}`)).toEqual(["K1 Rainbow:K1:2", "K2 Sunflower:K2:1"]);
    // Teachers move up with their class, and every child still fits their level by birth year.
    expect(now.find((k) => k.level === "K2")!.lead).toMatchObject({ id: lim.id });
    expect((await C.classesView()).flagged).toEqual([]);
    // The K2 child has gone on to primary school.
    expect((await W.listChildren(admin)).map((c) => c.name).sort()).toEqual(["Ava", "Ben", "Mia"]);
  });
});
