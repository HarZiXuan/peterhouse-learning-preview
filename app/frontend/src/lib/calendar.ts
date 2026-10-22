// Date helpers for the class calendar. Dates are plain "YYYY-MM-DD" strings handled as UTC, so a day never shifts with
// the browser's or the server's time zone; "today" comes from the server in Singapore time.
import type { CalendarEvent, CalendarView, Lesson } from "@peterhouse/shared";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function addDays(iso: string, n: number) {
  const d = at(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 = Monday … 7 = Sunday. */
export const weekday = (iso: string) => ((at(iso).getUTCDay() + 6) % 7) + 1;

export const mondayOf = (iso: string) => addDays(iso, 1 - weekday(iso));

export const daysBetween = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / 86_400_000);

/** Every day from `from` to `to`, both included. */
export function days(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The Monday-to-Sunday weeks that cover the month of `iso`. */
export function monthWeeks(iso: string) {
  const first = `${iso.slice(0, 7)}-01`;
  const last = addDays(addDays(first, 32).slice(0, 8) + "01", -1);
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 6);
  const all = days(start, end);
  return Array.from({ length: all.length / 7 }, (_, i) => all.slice(i * 7, i * 7 + 7));
}

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => at(iso).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
export const dayLabel = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
export const longDay = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long" });
export const monthLabel = (iso: string) => fmt(iso, { month: "long", year: "numeric" });
export const shortDate = (iso: string) => fmt(iso, { day: "numeric", month: "short" });

/** "8:30" or "14:00", without a leading zero. */
export const time = (hm: string) => hm.replace(/^0/, "");

export function whenText(e: CalendarEvent) {
  const dates = e.startsOn === e.endsOn ? shortDate(e.startsOn) : `${shortDate(e.startsOn)} – ${shortDate(e.endsOn)}`;
  return e.startTime ? `${dates}, ${time(e.startTime)}–${time(e.endTime!)}` : dates;
}

/** "Today", "Tomorrow", "Thursday" (this week) or "Mon 17 Nov". */
export function relativeDay(iso: string, today: string) {
  const n = daysBetween(today, iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 1 && n < 7) return fmt(iso, { weekday: "long" });
  return dayLabel(iso);
}

type Classes = CalendarView["classes"];

/** Does this entry apply to this class? With no class chosen, everything this person can see applies. */
export function appliesTo(e: CalendarEvent, classId: number | null, classes: Classes) {
  if (classId === null || e.audience === "school") return true;
  const k = classes.find((c) => c.id === classId);
  if (!k) return false;
  return e.audience === "levels" ? e.levels.includes(k.level) : e.classIds.includes(classId);
}

export const onDay = (e: CalendarEvent, iso: string) => e.startsOn <= iso && iso <= e.endsOn;

/** Who an entry is for, in words. */
export function forWhom(e: CalendarEvent, classes: Classes) {
  if (e.audience === "school") return "Whole school";
  if (e.audience === "levels") return e.levels.join(", ");
  return e.classIds.map((id) => classes.find((k) => k.id === id)?.name).filter(Boolean).join(", ") || "A class";
}

/** A gentle colour per class, so a teacher with two classes can tell them apart. */
const CLASS_TINTS = ["bg-[#c7e9fa] text-[#0a3a57]", "bg-[#fde7a4] text-[#5a4300]", "bg-[#d8ead9] text-[#1f5236]", "bg-[#f5ccce] text-[#6e1118]", "bg-[#e6dcf5] text-[#3d2a6b]"];
export const classTint = (classId: number, classes: Classes) => CLASS_TINTS[Math.max(0, classes.findIndex((k) => k.id === classId)) % CLASS_TINTS.length];

export const KIND_STYLE: Record<CalendarEvent["kind"], string> = {
  event: "border-primary/30 bg-primary/5 text-foreground",
  closure: "border-transparent bg-secondary text-muted-foreground",
  deadline: "border-warn/60 bg-warn/15 text-foreground",
};

export const KIND_LABEL: Record<CalendarEvent["kind"], string> = { event: "Event", closure: "School closed", deadline: "Reports due" };

/** Each subject colour as a soft tint with dark text, so a lesson block stays readable. */
export const SUBJECT_TINT: Record<string, string> = {
  sky: "border-[#b9dcf0] bg-[#e3f2fb] text-[#0a3a57]",
  rose: "border-[#f1c2c5] bg-[#fbe6e7] text-[#6e1118]",
  sun: "border-[#f3dc8f] bg-[#fdf3cf] text-[#5a4300]",
  leaf: "border-[#bfdcc7] bg-[#e4f2e8] text-[#1f5236]",
  lilac: "border-[#d4c6ee] bg-[#efe9f9] text-[#3d2a6b]",
  peach: "border-[#f3cdb0] bg-[#fdece0] text-[#6b3412]",
  stone: "border-[#d6d2c8] bg-[#f1efea] text-[#3a3731]",
};
export const SUBJECT_SWATCH: Record<string, string> = { sky: "#9fd0ee", rose: "#eaa3a8", sun: "#f2d06b", leaf: "#9ccaa9", lilac: "#bba6e4", peach: "#efb48a", stone: "#c4bfb3" };

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Minutes since midnight, for "now" and "next". */
export const minutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** A class's lessons on one day: its own lessons for that week when the week was changed, otherwise the normal week. */
export function lessonsOn(data: Pick<CalendarView, "lessons" | "changedWeeks">, classId: number, iso: string): Lesson[] {
  const monday = mondayOf(iso);
  const changed = data.changedWeeks.some((w) => w.classId === classId && w.weekOf === monday);
  return data.lessons.filter((l) => l.classId === classId && l.weekday === weekday(iso) && (changed ? l.weekOf === monday : !l.weekOf));
}
