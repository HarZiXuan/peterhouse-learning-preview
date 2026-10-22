import type { CalendarLink, CalendarView, ClassLevel, TimetableView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { addDays, mondayOf, monthWeeks } from "@/lib/calendar";
import { TimetableGrid } from "../timetable/TimetableGrid";
import { CalendarBoard, type CalendarMode } from "./CalendarBoard";

export const dynamic = "force-dynamic";

const MODES: CalendarMode[] = ["upcoming", "week", "month", "timetable"];

/** The class calendar: what is coming up, by week or month. The administrator also edits entries. The Timetable tab holds each class’s fixed weekly lessons; the administrator edits them there. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; class?: string; level?: string; week?: string }> }) {
  const sp = await searchParams;
  const info = await apiGet<WorkspaceInfo>("/workspace");
  const admin = info.user.role === "admin";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
  const asked = (MODES.find((m) => m === sp.view) ?? "week") as CalendarMode;
  // The administrator has no Upcoming tab; an old link to it opens the week.
  const mode: CalendarMode = admin && asked === "upcoming" ? "week" : asked;
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const weeks = monthWeeks(anchor);
  const [from, to] =
    mode === "timetable" ? [today, today] : mode === "upcoming" ? [today, addDays(today, 27)] : mode === "month" ? [weeks[0][0], weeks[weeks.length - 1][6]] : [mondayOf(anchor), addDays(mondayOf(anchor), 6)];
  const [all, link] = await Promise.all([apiGet<CalendarView>(`/calendar?from=${from}&to=${to}`), apiGet<CalendarLink>("/calendar/link")]);
  // A level narrows the calendar to that level's classes: their lessons and hours, and the entries meant for them.
  const level = all.classes.some((k) => k.level === sp.level) ? (sp.level as ClassLevel) : null;
  const data: CalendarView = level ? inLevel(all, level) : all;
  // The timetable tab shows one class's week; without a class chosen it opens the first one this person can see.
  const tt = mode === "timetable" ? await apiGet<TimetableView | { classId: null }>(`/timetable?${new URLSearchParams({ ...(Number(sp.class) ? { classId: sp.class! } : {}), ...(/^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? "") ? { week: sp.week! } : {}) })}`) : null;
  const classId = data.classes.some((k) => k.id === Number(sp.class)) ? Number(sp.class) : null;
  return (
    <CalendarBoard
      mode={mode}
      anchor={anchor}
      data={data}
      allClasses={all.classes}
      level={level}
      admin={admin}
      classId={classId}
      linkPath={link.path}
      timetable={
        tt && (tt.classId !== null ? (
          <TimetableGrid tt={tt as TimetableView} today={today} meId={info.user.id} />
        ) : (
          <p className="text-muted-foreground">{admin ? "Create classes first. Each class’s weekly timetable is set here." : "You are not in a class yet, so there is no timetable."}</p>
        ))
      }
    />
  );
}

function inLevel(v: CalendarView, level: ClassLevel): CalendarView {
  const classes = v.classes.filter((k) => k.level === level);
  const ids = new Set(classes.map((k) => k.id));
  return {
    ...v,
    classes,
    timetables: v.timetables.filter((t) => ids.has(t.classId)),
    lessons: v.lessons.filter((l) => ids.has(l.classId)),
    changedWeeks: v.changedWeeks.filter((w) => ids.has(w.classId)),
    events: v.events.filter((e) => e.audience === "school" || (e.audience === "levels" ? e.levels.includes(level) : e.classIds.some((id) => ids.has(id)))),
  };
}
