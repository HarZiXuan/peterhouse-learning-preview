import type { CalendarLink, CalendarView, TimetableView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { addDays, mondayOf, monthWeeks } from "@/lib/calendar";
import { TimetableGrid } from "../timetable/TimetableGrid";
import { CalendarBoard, type CalendarMode } from "./CalendarBoard";

export const dynamic = "force-dynamic";

const MODES: CalendarMode[] = ["upcoming", "week", "month", "timetable"];

/** The class calendar: what is coming up, by week or month. The administrator also edits entries. The Timetable tab holds each class’s fixed weekly lessons; the administrator edits them there. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; class?: string; week?: string }> }) {
  const sp = await searchParams;
  const info = await apiGet<WorkspaceInfo>("/workspace");
  const admin = info.user.role === "admin";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
  const mode = (MODES.find((m) => m === sp.view) ?? "week") as CalendarMode;
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const weeks = monthWeeks(anchor);
  const [from, to] =
    mode === "timetable" ? [today, today] : mode === "upcoming" ? [today, addDays(today, 27)] : mode === "month" ? [weeks[0][0], weeks[weeks.length - 1][6]] : [mondayOf(anchor), addDays(mondayOf(anchor), 6)];
  const [data, link] = await Promise.all([apiGet<CalendarView>(`/calendar?from=${from}&to=${to}`), apiGet<CalendarLink>("/calendar/link")]);
  // The timetable tab shows one class's week; without a class chosen it opens the first one this person can see.
  const tt = mode === "timetable" ? await apiGet<TimetableView | { classId: null }>(`/timetable?${new URLSearchParams({ ...(Number(sp.class) ? { classId: sp.class! } : {}), ...(/^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? "") ? { week: sp.week! } : {}) })}`) : null;
  const classId = data.classes.some((k) => k.id === Number(sp.class)) ? Number(sp.class) : null;
  return (
    <CalendarBoard
      mode={mode}
      anchor={anchor}
      data={data}
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
