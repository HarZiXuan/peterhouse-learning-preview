import Link from "next/link";
import type { CalendarView } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Icon } from "@/components/icons";
import { KIND_LABEL, lessonsOn, SUBJECT_TINT, addDays, appliesTo, daysBetween, minutes, onDay, relativeDay, time } from "@/lib/calendar";
import { cn } from "@/lib/utils";

/** The next seven days for a teacher's class, at the top of their Class page: "Tomorrow: Library visit, 10:00". */
export async function UpcomingStrip({ classId }: { classId?: number }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
  const data = await apiGet<CalendarView>(`/calendar?from=${today}&to=${addDays(today, 6)}`);
  const events = data.events.filter((e) => appliesTo(e, classId ?? null, data.classes) && e.endsOn >= today);
  // Today's lessons for one class: "Now: Chinese until 10:30 · Next: Happy Hour, 11:00".
  const one = classId ?? (data.classes.length === 1 ? data.classes[0].id : null);
  const closed = data.events.some((e) => e.kind === "closure" && onDay(e, today));
  const now = minutes(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()));
  const todays = one === null || closed ? [] : lessonsOn(data, one, today);
  const current = todays.find((l) => minutes(l.start) <= now && now < minutes(l.end));
  const next = todays.find((l) => minutes(l.start) > now);
  const subject = (id: number) => data.subjects.find((x) => x.id === id);
  return (
    <section aria-labelledby="coming-up" className="rounded-[20px] border bg-card px-[22px] py-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="coming-up" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Icon name="calendar" size={18} /> Today and this week
        </h2>
        <Link href="/calendar" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Calendar
        </Link>
      </div>
      {(current || next) && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {current && (
            <span className={`rounded-md border px-2 py-0.5 ${SUBJECT_TINT[subject(current.subjectId)?.color ?? "stone"]}`}>
              Now: <b>{subject(current.subjectId)?.name}</b> until {time(current.end)}
            </span>
          )}
          {next && (
            <span className="text-muted-foreground">
              Next: <b className="text-foreground">{subject(next.subjectId)?.name}</b>, {time(next.start)}
              {next.room && ` · ${next.room}`}
            </span>
          )}
        </p>
      )}
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing special in the next seven days.</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {events.map((e) => {
            const day = e.startsOn < today ? today : e.startsOn;
            const left = daysBetween(today, e.startsOn);
            return (
              <li key={e.id} className={cn("flex flex-wrap gap-x-2", e.kind === "deadline" && "font-semibold")}>
                <span className="w-24 shrink-0 text-muted-foreground">{relativeDay(day, today)}</span>
                <span>
                  {e.kind !== "event" && `${KIND_LABEL[e.kind]}: `}
                  {e.title}
                  {e.startTime && `, ${time(e.startTime)}`}
                  {e.place && <span className="text-muted-foreground"> · {e.place}</span>}
                  {e.kind === "deadline" && left >= 0 && <span className="text-primary"> · {left === 0 ? "due today" : `${left} ${left === 1 ? "day" : "days"} left`}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
