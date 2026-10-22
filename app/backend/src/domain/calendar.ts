// The class calendar (CHANGES-TO-MAKE change 5): weekly timetables, events, closures and report deadlines.
// The administrator manages it; everyone else sees the entries for their own classes plus the school-wide ones,
// in the app and through a private calendar link that Google Calendar or Outlook keep up to date.
import crypto from "node:crypto";
import type { CalendarEvent, CalendarEventInput, CalendarLink, CalendarView, ClassLevel, Lesson, SessionUser, Timetable } from "@peterhouse/shared";
import { many, one, run, tx } from "../db";
import { HttpError, notFound } from "../http";
import { openText, sealText } from "./records";
import { TAUGHT_BY } from "./staff";
import { toSessionUser } from "./users";
import { changedWeeksOf, lessonsOf, listSubjects } from "./timetable";
import { workspace } from "./workspace";

/** Peterhouse is in Singapore (UTC+8 all year), so "today" is Singapore's today wherever the server runs. */
export const todayInSingapore = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(d);

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Row = {
  id: number;
  kind: CalendarEvent["kind"];
  title: string;
  starts_on: string;
  ends_on: string;
  start_time: string | null;
  end_time: string | null;
  place: string;
  note: string;
  audience: CalendarEvent["audience"];
  levels: ClassLevel[];
  class_ids: number[];
};

const SELECT = `
  SELECT e.id, e.kind, e.title, e.starts_on::text, e.ends_on::text, to_char(e.start_time, 'HH24:MI') AS start_time, to_char(e.end_time, 'HH24:MI') AS end_time,
         e.place, e.note, e.audience, e.levels,
         coalesce((SELECT array_agg(c.class_id ORDER BY c.class_id) FROM calendar_event_classes c WHERE c.event_id = e.id), '{}') AS class_ids
    FROM calendar_events e`;

const toEvent = (r: Row): CalendarEvent => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  startTime: r.start_time,
  endTime: r.end_time,
  place: r.place,
  note: r.note,
  audience: r.audience,
  levels: r.levels,
  classIds: r.class_ids.map(Number),
});

/** This semester's classes this person can see. */
async function visibleClasses(user: SessionUser) {
  const { termId } = await workspace();
  return many<{ id: number; name: string; level: ClassLevel }>(
    `SELECT k.id, k.name, k.level FROM classes k
      WHERE k.term_id = $1 AND ($2 OR k.id IN ${TAUGHT_BY(3)})
      ORDER BY k.name`,
    [termId, user.role === "admin", user.id],
  );
}

/** The events between two dates that this person can see: everything for an administrator. */
async function eventsFor(user: SessionUser, from: string, to: string, classes: { id: number; level: ClassLevel }[]): Promise<CalendarEvent[]> {
  const rows = await many<Row>(
    `${SELECT}
      WHERE e.ends_on >= $1::date AND e.starts_on <= $2::date
        AND ($3 OR e.audience = 'school'
             OR (e.audience = 'levels' AND e.levels && $4::text[])
             OR (e.audience = 'classes' AND EXISTS (SELECT 1 FROM calendar_event_classes c WHERE c.event_id = e.id AND c.class_id = ANY($5::bigint[]))))
      ORDER BY e.starts_on, e.start_time NULLS FIRST, e.id`,
    [from, to, user.role === "admin", [...new Set(classes.map((k) => k.level))], classes.map((k) => k.id)],
  );
  return rows.map(toEvent);
}

/** Each class's hours: its first lesson to its last, day by day. */
function timetablesFor(classIds: number[], lessons: Lesson[]): Timetable[] {
  return classIds.map((id) => {
    const byDay = new Map<number, { start: string; end: string }>();
    for (const l of lessons.filter((x) => x.classId === id)) {
      const d = byDay.get(l.weekday);
      byDay.set(l.weekday, d ? { start: l.start < d.start ? l.start : d.start, end: l.end > d.end ? l.end : d.end } : { start: l.start, end: l.end });
    }
    return { classId: id, days: [...byDay].sort(([x], [y]) => x - y).map(([weekday, d]) => ({ weekday, ...d })) };
  });
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A teacher's calendar shows only their own lessons: those that name them, and those that name nobody yet in a class
 * they teach, for a subject they teach there (a lead or co-teacher with no subjects tagged teaches every subject).
 * The administrator sees every lesson.
 */
async function mineOnly(user: SessionUser): Promise<(lessons: Lesson[]) => Lesson[]> {
  if (user.role === "admin") return (lessons) => lessons;
  const staff = new Set((await many<{ class_id: number }>("SELECT class_id FROM class_staff WHERE user_id = $1", [user.id])).map((r) => Number(r.class_id)));
  const tags = await many<{ class_id: number; subject_id: number }>("SELECT class_id, subject_id FROM class_subject_teachers WHERE user_id = $1", [user.id]);
  const tagged = (classId: number) => tags.filter((t) => Number(t.class_id) === classId).map((t) => Number(t.subject_id));
  const teaches = (l: Lesson) => {
    const mine = tagged(l.classId);
    return mine.length ? mine.includes(l.subjectId) : staff.has(l.classId);
  };
  return (lessons) => lessons.filter((l) => l.teacherId === user.id || (l.teacherId === null && teaches(l)));
}

export async function calendarView(user: SessionUser, from: string, to: string): Promise<CalendarView> {
  if (!ISO.test(from) || !ISO.test(to) || from > to) throw new HttpError(400, "Choose a valid date range.");
  if (new Date(to).getTime() - new Date(from).getTime() > 400 * 86_400_000) throw new HttpError(400, "Choose a shorter date range.");
  const classes = await visibleClasses(user);
  const ids = classes.map((k) => k.id);
  const normal = await lessonsOf(ids);
  // Weeks that differ from the normal one, for the Mondays that touch this range.
  const monday = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const changed = await changedWeeksOf(ids, monday(from), to);
  const lessons = (await mineOnly(user))([...normal, ...changed.lessons]);
  const teacherIds = [...new Set(lessons.map((l) => l.teacherId).filter((x): x is number => x !== null))];
  const teachers = (await many<{ id: number; name: string }>("SELECT id, name FROM users WHERE id = ANY($1::bigint[]) ORDER BY name", [teacherIds])).map((u) => ({ id: Number(u.id), name: u.name }));
  return { events: await eventsFor(user, from, to, classes), timetables: timetablesFor(ids, normal), lessons, changedWeeks: changed.weeks, subjects: await listSubjects(), teachers, classes, today: todayInSingapore() };
}

// ─── The administrator's changes ─────────────────────────────────────────

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function checked(input: CalendarEventInput) {
  const title = input.title.trim().slice(0, 120);
  if (!title) throw new HttpError(400, "Give the entry a title.");
  if (!ISO.test(input.startsOn) || !ISO.test(input.endsOn)) throw new HttpError(400, "Choose the dates.");
  if (input.endsOn < input.startsOn) throw new HttpError(400, "The end date is before the start date.");
  if (!!input.startTime !== !!input.endTime) throw new HttpError(400, "Give both a start and an end time, or neither for all day.");
  if (input.startTime && (!TIME.test(input.startTime) || !TIME.test(input.endTime!))) throw new HttpError(400, "Times look like 08:30.");
  if (input.startTime && input.startsOn === input.endsOn && input.endTime! <= input.startTime) throw new HttpError(400, "The end time is before the start time.");
  // A closure is for the whole school, so nobody sees a normal day when the school is shut.
  const audience = input.kind === "closure" ? "school" : input.audience;
  const levels = audience === "levels" ? [...new Set(input.levels)] : [];
  if (audience === "levels" && levels.length === 0) throw new HttpError(400, "Choose at least one level.");
  let classIds: number[] = [];
  if (audience === "classes") {
    const { termId } = await workspace();
    classIds = (await many<{ id: number }>("SELECT id FROM classes WHERE id = ANY($1::bigint[]) AND term_id = $2", [[...new Set(input.classIds)], termId])).map((r) => Number(r.id));
    if (classIds.length === 0) throw new HttpError(400, "Choose at least one class.");
  }
  return { ...input, title, audience, levels, classIds, place: input.place.trim().slice(0, 120), note: input.note.trim().slice(0, 500), startTime: input.startTime || null, endTime: input.endTime || null };
}

export async function saveEvent(user: SessionUser, input: CalendarEventInput, id?: number): Promise<number> {
  const e = await checked(input);
  return tx(async (c) => {
    const params = [e.kind, e.title, e.startsOn, e.endsOn, e.startTime, e.endTime, e.place, e.note, e.audience, e.levels];
    let eventId = id;
    if (id) {
      const n = await run(
        `UPDATE calendar_events SET kind = $1, title = $2, starts_on = $3, ends_on = $4, start_time = $5, end_time = $6, place = $7, note = $8,
                audience = $9, levels = $10, updated_at = now() WHERE id = $11`,
        [...params, id],
        c,
      );
      if (!n) throw notFound("That entry");
      await run("DELETE FROM calendar_event_classes WHERE event_id = $1", [id], c);
    } else {
      eventId = (await one<{ id: number }>(
        `INSERT INTO calendar_events (kind, title, starts_on, ends_on, start_time, end_time, place, note, audience, levels, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [...params, user.id],
        c,
      ))!.id;
    }
    for (const k of e.classIds) await run("INSERT INTO calendar_event_classes (event_id, class_id) VALUES ($1, $2)", [eventId, k], c);
    return eventId!;
  });
}

export async function deleteEvent(id: number) {
  if (!(await run("DELETE FROM calendar_events WHERE id = $1", [id]))) throw notFound("That entry");
}

// ─── Each person's private calendar link ─────────────────────────────────

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const feedPath = (token: string) => `/api/feed/${token}.ics`;

async function newToken(userId: number) {
  const token = crypto.randomBytes(24).toString("base64url");
  await run("UPDATE users SET calendar_token = $1, calendar_token_hash = $2 WHERE id = $3", [sealText(token, "users.calendar_token"), hash(token), userId]);
  return token;
}

export async function calendarLink(user: SessionUser): Promise<CalendarLink> {
  const row = await one<{ calendar_token: string | null }>("SELECT calendar_token FROM users WHERE id = $1", [user.id]);
  const token = row?.calendar_token ? openText(row.calendar_token, "users.calendar_token") : await newToken(user.id);
  return { path: feedPath(token) };
}

/** The old link stops working at once. */
export async function resetCalendarLink(user: SessionUser): Promise<CalendarLink> {
  return { path: feedPath(await newToken(user.id)) };
}

// ─── The calendar file Google Calendar and Outlook read ──────────────────

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const day = (iso: string) => iso.replace(/-/g, "");
/** Singapore time to UTC (no daylight saving there). */
const utc = (iso: string, hm: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, min] = hm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 8, min)).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};
/** Lines longer than 75 characters are folded, as the calendar format asks. */
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

const KIND_PREFIX: Record<CalendarEvent["kind"], string> = { event: "", closure: "School closed: ", deadline: "Reports due: " };

export function buildIcs(events: CalendarEvent[], classNames: Map<number, string>, stamp = new Date()): string {
  const now = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Peterhouse Preschool//Learning Review//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Peterhouse", "X-WR-TIMEZONE:Asia/Singapore", "REFRESH-INTERVAL;VALUE=DURATION:PT6H"];
  for (const e of events) {
    const forWhom =
      e.audience === "school" ? "Whole school" : e.audience === "levels" ? `Levels: ${e.levels.join(", ")}` : `Classes: ${e.classIds.map((k) => classNames.get(k) ?? "").filter(Boolean).join(", ")}`;
    lines.push("BEGIN:VEVENT", `UID:event-${e.id}@peterhouse-learning-review`, `DTSTAMP:${now}`);
    if (e.startTime && e.endTime) lines.push(`DTSTART:${utc(e.startsOn, e.startTime)}`, `DTEND:${utc(e.endsOn, e.endTime)}`);
    else lines.push(`DTSTART;VALUE=DATE:${day(e.startsOn)}`, `DTEND;VALUE=DATE:${day(addDays(e.endsOn, 1))}`);
    lines.push(`SUMMARY:${esc(KIND_PREFIX[e.kind] + e.title)}`);
    if (e.place) lines.push(`LOCATION:${esc(e.place)}`);
    lines.push(`DESCRIPTION:${esc([forWhom, e.note].filter(Boolean).join("\n"))}`);
    if (e.kind !== "event") lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** The calendar for the person whose link this is, from two months back to a year ahead. Null for an unknown link. */
export async function feedFor(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = await one<{ id: number; email: string; name: string; role: "admin" | "teacher"; must_change_password: boolean }>(
    "SELECT id, email, name, role, must_change_password FROM users WHERE calendar_token_hash = $1 AND active",
    [hash(token)],
  );
  if (!row) return null;
  const user = toSessionUser(row);
  const today = todayInSingapore();
  const classes = await visibleClasses(user);
  const events = await eventsFor(user, addDays(today, -60), addDays(today, 400), classes);
  const { termId } = await workspace();
  const names = new Map((await many<{ id: number; name: string }>("SELECT id, name FROM classes WHERE term_id = $1", [termId])).map((k) => [Number(k.id), k.name]));
  return buildIcs(events, names);
}
