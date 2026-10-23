// The class calendar (BUILT.md change 5): who sees which entries, timetables, and the private calendar link.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CalendarEventInput, SessionUser } from "@peterhouse/shared";
import { makeClass, setupTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof setupTestDb>>;
let server: Server;
let base: string;
let admin: SessionUser;
let lim: SessionUser;
let tan: SessionUser;
let k1: number;
let n2: number;
let today: string;

const sessionUser = (id: number, role: "admin" | "teacher"): SessionUser => ({ id, email: `${role}${id}@x.sg`, name: `${role} ${id}`, role, mustChangePassword: false });
const plus = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const entry = (over: Partial<CalendarEventInput>): CalendarEventInput => ({
  kind: "event",
  title: "Library visit",
  startsOn: today,
  endsOn: today,
  startTime: null,
  endTime: null,
  place: "",
  note: "",
  audience: "school",
  levels: [],
  classIds: [],
  ...over,
});

beforeAll(async () => {
  t = await setupTestDb();
  const U = await import("../src/domain/users");
  const W = await import("../src/domain/workspace");
  const C = await import("../src/domain/calendar");
  await W.workspace();
  today = C.todayInSingapore();
  admin = sessionUser(await U.createUser(null, null, { email: "admin@x.sg", name: "Ms Admin", role: "admin", password: "an admin passphrase" }), "admin");
  lim = sessionUser(await U.createUser(null, null, { email: "lim@x.sg", name: "Ms Lim", role: "teacher", password: "a teacher passphrase" }), "teacher");
  tan = sessionUser(await U.createUser(null, null, { email: "tan@x.sg", name: "Ms Tan", role: "teacher", password: "another passphrase" }), "teacher");
  k1 = (await makeClass([lim.id], "K1 Sunflower", "K1")).id;
  n2 = (await makeClass([tan.id], "N2 Rainbow", "N2")).id;
  const { createApp } = await import("../src/app");
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await t.teardown();
});

describe("the class calendar", () => {
  it("shows each teacher their own classes and the school-wide entries", async () => {
    const C = await import("../src/domain/calendar");
    await C.saveEvent(admin, entry({ title: "Sports Day" }));
    await C.saveEvent(admin, entry({ title: "K1 and K2 assembly", audience: "levels", levels: ["K1", "K2"] }));
    await C.saveEvent(admin, entry({ title: "Science Centre trip", audience: "classes", classIds: [n2], startTime: "09:00", endTime: "11:30" }));
    // A closure is always for the whole school.
    await C.saveEvent(admin, entry({ kind: "closure", title: "Staff training day", startsOn: plus(today, 3), endsOn: plus(today, 4), audience: "levels", levels: ["PG"] }));
    await C.saveEvent(admin, entry({ kind: "deadline", title: "December reports", startsOn: plus(today, 10), endsOn: plus(today, 10) }));

    const range = [today, plus(today, 30)] as const;
    const titles = async (u: SessionUser) => (await C.calendarView(u, ...range)).events.map((e) => e.title).sort();
    expect(await titles(lim)).toEqual(["December reports", "K1 and K2 assembly", "Sports Day", "Staff training day"]);
    expect(await titles(tan)).toEqual(["December reports", "Science Centre trip", "Sports Day", "Staff training day"]);
    expect((await titles(admin)).length).toBe(5);
    const closure = (await C.calendarView(admin, ...range)).events.find((e) => e.kind === "closure")!;
    expect(closure).toMatchObject({ audience: "school", levels: [], startTime: null });
    expect((await C.calendarView(tan, ...range)).events.find((e) => e.title === "Science Centre trip")).toMatchObject({ startTime: "09:00", endTime: "11:30", classIds: [n2] });
  });

  it("refuses entries that do not make sense", async () => {
    const C = await import("../src/domain/calendar");
    await expect(C.saveEvent(admin, entry({ title: " " }))).rejects.toMatchObject({ status: 400 });
    await expect(C.saveEvent(admin, entry({ endsOn: plus(today, -1) }))).rejects.toMatchObject({ status: 400 });
    await expect(C.saveEvent(admin, entry({ startTime: "10:00", endTime: null }))).rejects.toMatchObject({ status: 400 });
    await expect(C.saveEvent(admin, entry({ startTime: "10:00", endTime: "09:00" }))).rejects.toMatchObject({ status: 400 });
    await expect(C.saveEvent(admin, entry({ audience: "levels", levels: [] }))).rejects.toMatchObject({ status: 400 });
    await expect(C.saveEvent(admin, entry({ audience: "classes", classIds: [999999] }))).rejects.toMatchObject({ status: 400 });
  });

  it("edits and removes an entry", async () => {
    const C = await import("../src/domain/calendar");
    const id = await C.saveEvent(admin, entry({ title: "Concert" }));
    await C.saveEvent(admin, entry({ title: "Year-end concert", place: "Hall", audience: "classes", classIds: [k1] }), id);
    const now = async (u: SessionUser) => (await C.calendarView(u, today, today)).events.find((e) => e.id === id);
    expect(await now(lim)).toMatchObject({ title: "Year-end concert", place: "Hall" });
    expect(await now(tan)).toBeUndefined();
    await C.deleteEvent(id);
    expect(await now(admin)).toBeUndefined();
    await expect(C.deleteEvent(id)).rejects.toMatchObject({ status: 404 });
  });

  it("takes each class's hours from its lessons", async () => {
    const C = await import("../src/domain/calendar");
    const T = await import("../src/domain/timetable");
    const english = (await T.listSubjects()).find((x) => x.name === "English")!;
    for (const weekday of [1, 2, 3, 4, 5]) {
      await T.saveLesson(admin, { classId: k1, subjectId: english.id, weekday, start: "08:30", end: "09:15", teacherId: null, room: "" });
      await T.saveLesson(admin, { classId: k1, subjectId: english.id, weekday, start: "11:45", end: "12:30", teacherId: null, room: "" });
    }
    const view = await C.calendarView(lim, today, today);
    expect(view.classes.map((k) => k.name)).toEqual(["K1 Sunflower"]);
    expect(view.timetables).toEqual([{ classId: k1, days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "08:30", end: "12:30" })) }]);
    expect(view.lessons).toHaveLength(10);
  });

  it("lets one week differ from the normal timetable without touching the others", async () => {
    const C = await import("../src/domain/calendar");
    const T = await import("../src/domain/timetable");
    const english = (await T.listSubjects()).find((x) => x.name === "English")!;
    const monday = "2031-03-03"; // a Monday
    const normalCount = (await T.timetableView(admin, k1) as { lessons: unknown[] }).lessons.length;
    await expect(T.startWeek(k1, "2031-03-04")).rejects.toMatchObject({ status: 400 });
    await expect(T.saveLesson(admin, { classId: k1, subjectId: english.id, weekday: 1, start: "14:00", end: "15:00", teacherId: null, room: "", weekOf: monday })).rejects.toMatchObject({ status: 409 });
    await T.startWeek(k1, monday);
    const copy = (await T.timetableView(admin, k1, monday)) as { lessons: { id: number; weekOf?: string | null }[]; weekChanged: boolean; changedWeeks: string[] };
    expect(copy.weekChanged).toBe(true);
    expect(copy.changedWeeks).toEqual([monday]);
    expect(copy.lessons).toHaveLength(normalCount);
    // Add to the changed week, remove one lesson: only that week changes.
    await T.saveLesson(admin, { classId: k1, subjectId: english.id, weekday: 1, start: "14:00", end: "15:00", teacherId: null, room: "", weekOf: monday });
    await T.deleteLesson(admin, copy.lessons[0].id, monday);
    const changed = (await T.timetableView(admin, k1, monday)) as { lessons: unknown[] };
    expect(changed.lessons).toHaveLength(normalCount);
    const other = (await T.timetableView(admin, k1, "2031-03-10")) as { lessons: unknown[]; weekChanged: boolean };
    expect(other.weekChanged).toBe(false);
    expect(other.lessons).toHaveLength(normalCount);
    const view = await C.calendarView(admin, monday, "2031-03-09");
    expect(view.changedWeeks).toEqual([{ classId: k1, weekOf: monday }]);
    expect(view.lessons.filter((l) => l.weekOf === monday)).toHaveLength(normalCount);
    await T.resetWeek(k1, monday);
    expect((await C.calendarView(admin, monday, "2031-03-09")).changedWeeks).toEqual([]);
  });

  it("gives each person a private calendar link that works without signing in", async () => {
    const C = await import("../src/domain/calendar");
    const U = await import("../src/domain/users");
    const link = await C.calendarLink(lim);
    expect(await C.calendarLink(lim)).toEqual(link);
    const res = await fetch(base + link.path);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/calendar/);
    const ics = await res.text();
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("SUMMARY:Sports Day");
    expect(ics).toContain("SUMMARY:School closed: Staff training day");
    expect(ics).toContain("SUMMARY:Reports due: December reports");
    // Ms Lim's link has only what Ms Lim can see.
    expect(ics).not.toContain("Science Centre trip");
    // A timed entry is in UTC: 09:00 in Singapore is 01:00 UTC.
    const tanIcs = await (await fetch(base + (await C.calendarLink(tan)).path)).text();
    expect(tanIcs).toContain(`DTSTART:${today.replace(/-/g, "")}T010000Z`);

    // Resetting stops the old link at once.
    const fresh = await C.resetCalendarLink(lim);
    expect(fresh.path).not.toBe(link.path);
    expect((await fetch(base + link.path)).status).toBe(404);
    expect((await fetch(base + fresh.path)).status).toBe(200);

    // Deactivating stops it too, and does not bring it back on reactivation.
    await U.updateUser({ headers: {}, socket: {} } as never, admin, lim.id, { active: false });
    expect((await fetch(base + fresh.path)).status).toBe(404);
    await U.updateUser({ headers: {}, socket: {} } as never, admin, lim.id, { active: true });
    expect((await fetch(base + fresh.path)).status).toBe(404);
    expect((await fetch(base + "/api/feed/not-a-real-link-at-all-123.ics")).status).toBe(404);
  });

  it("carries the lessons and the class entries into the next semester", async () => {
    const C = await import("../src/domain/calendar");
    const W = await import("../src/domain/workspace");
    await C.saveEvent(admin, entry({ title: "Class photo", audience: "classes", classIds: [k1], startsOn: plus(today, 200), endsOn: plus(today, 200) }));
    await W.startNextSemester(admin);
    const view = await C.calendarView(admin, today, plus(today, 300));
    const photo = view.events.find((e) => e.title === "Class photo")!;
    expect(photo.classIds).toHaveLength(2);
    const newK1 = view.classes.find((k) => k.name.endsWith("Sunflower"))!;
    expect(view.timetables.find((x) => x.classId === newK1.id)!.days).toHaveLength(5);
    expect(view.lessons.filter((l) => l.classId === newK1.id)).toHaveLength(10);
  });
});
