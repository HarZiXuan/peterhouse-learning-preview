"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CalendarEvent, CalendarView } from "@peterhouse/shared";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SUBJECT_TINT,
  KIND_LABEL,
  KIND_STYLE,
  addDays,
  appliesTo,
  classTint,
  dayLabel,
  days,
  daysBetween,
  forWhom,
  longDay,
  lessonsOn,
  mondayOf,
  monthLabel,
  monthWeeks,
  onDay,
  relativeDay,
  shortDate,
  time,
  weekday,
  whenText,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { SELECT } from "../AddChild";
import { CalendarLinkCard } from "./CalendarLinkCard";
import { EventDialog } from "./EventDialog";

export type CalendarMode = "upcoming" | "week" | "month" | "timetable";

type Props = {
  mode: CalendarMode;
  anchor: string;
  data: CalendarView;
  admin: boolean;
  classId: number | null;
  linkPath: string;
  /** The editable weekly timetable, drawn by the page for the Timetable tab. */
  timetable?: ReactNode;
};

/** One entry as a small block. The administrator can open it to change it. */
function Entry({
  e,
  data,
  onOpen,
  compact = false,
}: {
  e: CalendarEvent;
  data: CalendarView;
  onOpen?: (e: CalendarEvent) => void;
  compact?: boolean;
}) {
  const body = (
    <>
      <span className="block truncate font-semibold">
        {e.kind !== "event" && (
          <span className="font-normal">{KIND_LABEL[e.kind]}: </span>
        )}
        {e.title}
      </span>
      {!compact && (
        <span className="block truncate text-xs opacity-80">
          {[
            e.startTime && `${time(e.startTime)}–${time(e.endTime!)}`,
            e.place,
            forWhom(e, data.classes),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </>
  );
  const cls = cn(
    "block w-full rounded-md border px-2 py-1 text-left text-sm",
    KIND_STYLE[e.kind],
    onOpen && "cursor-pointer hover:brightness-95",
  );
  return onOpen ? (
    <button
      type="button"
      className={cls}
      onClick={() => onOpen(e)}
      title={`Change “${e.title}”`}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * What a class does that day: its lessons in order when one class is in view, otherwise each class's hours. Nothing on
 * a closed day: the closure entry says so, and nobody sees a normal day.
 */
function DayHours({
  iso,
  data,
  classId,
  max,
}: {
  iso: string;
  data: CalendarView;
  classId: number | null;
  /** Show at most this many, then "+n more" (the month grid has little room). */ max?: number;
}) {
  if (data.events.some((e) => e.kind === "closure" && onDay(e, iso)))
    return null;
  const wd = weekday(iso);
  const one =
    classId ?? (data.classes.length === 1 ? data.classes[0].id : null);
  if (one !== null) {
    const all = lessonsOn(data, one, iso).sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    if (all.length === 0) return null;
    const lessons = max ? all.slice(0, max) : all;
    return (
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
        {lessons.map((l) => {
          const s = data.subjects.find((x) => x.id === l.subjectId);
          return (
            <li
              key={l.id}
              className={cn(
                "truncate rounded-md border px-2 py-0.5 text-xs",
                SUBJECT_TINT[s?.color ?? "stone"],
              )}
            >
              <span className="font-mono">{time(l.start)}</span>{" "}
              <span className="font-semibold">{s?.name}</span>
            </li>
          );
        })}
        {max && all.length > max && (
          <li className="px-1 text-xs text-muted-foreground">
            +{all.length - max} more lessons
          </li>
        )}
      </ul>
    );
  }
  // Each class's hours that day: its first lesson to its last.
  const rows = data.classes
    .filter((k) => classId === null || k.id === classId)
    .flatMap((k) => {
      const ls = lessonsOn(data, k.id, iso);
      if (ls.length === 0) return [];
      return [
        {
          lessons: ls.sort((a, b) => a.start.localeCompare(b.start)),
          classId: k.id,
          start: ls.map((l) => l.start).sort()[0],
          end: ls
            .map((l) => l.end)
            .sort()
            .reverse()[0],
        },
      ];
    });
  if (rows.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
        {(max ? rows.slice(0, max) : rows).map((r) => {
          const name = data.classes.find((k) => k.id === r.classId)?.name;
          return (
            <li key={r.classId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-full cursor-default text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      max
                        ? "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs hover:bg-secondary"
                        : cn(
                            "block truncate rounded-md px-2 py-0.5 text-xs font-semibold",
                            classTint(r.classId, data.classes),
                          ),
                    )}
                  >
                    {max ? (
                      <>
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            classTint(r.classId, data.classes),
                          )}
                          aria-hidden
                        />
                        {classId === null && data.classes.length > 1 && (
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {name}
                          </span>
                        )}
                        <span
                          className={cn(
                            "shrink-0 tabular-nums",
                            classId === null && data.classes.length > 1
                              ? "text-muted-foreground"
                              : "font-semibold",
                          )}
                        >
                          {time(r.start)}–{time(r.end)}
                        </span>
                      </>
                    ) : (
                      (classId === null && data.classes.length > 1
                        ? `${name} `
                        : "") + `${time(r.start)}–${time(r.end)}`
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  className="border bg-popover p-3 text-popover-foreground shadow-md [&>svg]:hidden"
                >
                  <p className="mb-1.5 font-heading text-sm font-bold">
                    {name} · {longDay(iso)}
                  </p>
                  <ul className="grid gap-1">
                    {r.lessons.map((l) => {
                      const sub = data.subjects.find(
                        (x) => x.id === l.subjectId,
                      );
                      return (
                        <li
                          key={l.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={cn(
                              "size-2.5 shrink-0 rounded-full border",
                              SUBJECT_TINT[sub?.color ?? "stone"],
                            )}
                            aria-hidden
                          />
                          <span className="w-24 shrink-0 font-mono tabular-nums">
                            {time(l.start)}–{time(l.end)}
                          </span>
                          <span className="font-semibold">{sub?.name}</span>
                          {l.room && (
                            <span className="text-muted-foreground">
                              · {l.room}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
        {max && rows.length > max && (
          <li className="px-1 text-xs text-muted-foreground">
            +{rows.length - max} more classes
          </li>
        )}
      </ul>
    </TooltipProvider>
  );
}

function Week({
  anchor,
  data,
  classId,
  open,
}: {
  anchor: string;
  data: CalendarView;
  classId: number | null;
  open?: (e: CalendarEvent) => void;
}) {
  const monday = mondayOf(anchor);
  const all = days(monday, addDays(monday, 6));
  const events = data.events.filter((e) => appliesTo(e, classId, data.classes));
  // Saturday and Sunday only appear when something is on.
  const shown = all.filter((d, i) => i < 5 || events.some((e) => onDay(e, d)));
  const rows = data.classes.filter((k) => classId === null || k.id === classId);
  const closed = (d: string) =>
    events.some((e) => e.kind === "closure" && onDay(e, d));
  return (
    <>
      {/* Larger screens: one table, a column per day and a row per class. */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className="w-36 p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <span className="sr-only">Class</span>
              </th>
              {shown.map((d) => (
                <th
                  key={d}
                  scope="col"
                  className={cn(
                    "border-l p-3 text-left text-sm font-bold",
                    d === data.today
                      ? "bg-primary/5 text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {dayLabel(d)}
                  {d === data.today && " · Today"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b align-top">
              <th scope="row" className="p-3 text-left text-sm font-bold">
                Events
              </th>
              {shown.map((d) => {
                const todays = events.filter((e) => onDay(e, d));
                return (
                  <td
                    key={d}
                    className={cn(
                      "border-l p-2",
                      d === data.today && "bg-primary/5",
                    )}
                  >
                    <div className="grid gap-1.5">
                      {todays.length === 0 ? (
                        <span
                          className="px-1 text-muted-foreground/60"
                          aria-label="Nothing on"
                        >
                          –
                        </span>
                      ) : (
                        todays.map((e) => (
                          <Entry key={e.id} e={e} data={data} onOpen={open} />
                        ))
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
            {rows.map((k) => (
              <tr key={k.id} className="border-b align-top last:border-b-0">
                <th scope="row" className="p-3 text-left text-sm font-bold">
                  <span
                    className={cn(
                      "inline-block rounded-md px-2 py-0.5",
                      classTint(k.id, data.classes),
                    )}
                  >
                    {k.name}
                  </span>
                </th>
                {shown.map((d) => {
                  const lessons = closed(d)
                    ? []
                    : lessonsOn(data, k.id, d).sort((a, b) =>
                        a.start.localeCompare(b.start),
                      );
                  return (
                    <td
                      key={d}
                      className={cn(
                        "border-l p-2",
                        d === data.today && "bg-primary/5",
                      )}
                    >
                      {lessons.length === 0 ? (
                        <span className="px-1 text-muted-foreground/60">
                          {closed(d) ? "Closed" : "–"}
                        </span>
                      ) : (
                        <ul className="grid gap-1">
                          {lessons.map((l) => {
                            const sub = data.subjects.find(
                              (x) => x.id === l.subjectId,
                            );
                            return (
                              <li
                                key={l.id}
                                className={cn(
                                  "rounded-md border px-2 py-1 text-xs",
                                  SUBJECT_TINT[sub?.color ?? "stone"],
                                )}
                              >
                                <span className="block font-semibold">
                                  {sub?.name}
                                </span>
                                <span className="block font-mono tabular-nums opacity-80">
                                  {time(l.start)}–{time(l.end)}
                                  {l.room && ` · ${l.room}`}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: a card per day. */}
      <div className="grid gap-3 md:hidden">
        {shown.map((d) => (
          <section
            key={d}
            className={cn(
              "grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2 rounded-xl border bg-card p-3",
              d === data.today && "border-primary ring-1 ring-primary/30",
            )}
            aria-label={longDay(d)}
          >
            <p
              className={cn(
                "text-sm font-bold",
                d === data.today ? "text-primary" : "text-muted-foreground",
              )}
            >
              {dayLabel(d)}
              {d === data.today && " · Today"}
            </p>
            <DayHours iso={d} data={data} classId={classId} />
            {events
              .filter((e) => onDay(e, d))
              .map((e) => (
                <Entry key={e.id} e={e} data={data} onOpen={open} />
              ))}
          </section>
        ))}
      </div>
    </>
  );
}

function Month({
  anchor,
  data,
  classId,
  open,
}: {
  anchor: string;
  data: CalendarView;
  classId: number | null;
  open?: (e: CalendarEvent) => void;
}) {
  const weeks = monthWeeks(anchor);
  const month = anchor.slice(0, 7);
  const events = data.events.filter((e) => appliesTo(e, classId, data.classes));
  const inMonth = events.filter(
    (e) => e.endsOn.slice(0, 7) >= month && e.startsOn.slice(0, 7) <= month,
  );
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm md:block">
        <div className="grid grid-cols-7 border-b bg-secondary/40 text-xs font-semibold text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
            <span
              key={d}
              className={cn("px-3 py-2.5", i > 4 && "text-muted-foreground/70")}
            >
              {d}
            </span>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w[0]} className="grid grid-cols-7 border-b last:border-b-0">
            {w.map((d, col) => {
              const todays = events.filter((e) => onDay(e, d));
              const out = d.slice(0, 7) !== month;
              const isToday = d === data.today;
              return (
                <div
                  key={d}
                  className={cn(
                    "min-h-28 min-w-0 border-r p-2 last:border-r-0",
                    col > 4 && "bg-secondary/25",
                    out && "bg-secondary/40",
                    isToday && "bg-primary/[0.04]",
                  )}
                >
                  <p className="mb-1.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[13px] font-bold tabular-nums",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : out
                            ? "text-muted-foreground/60"
                            : "text-foreground",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {Number(d.slice(8)) === 1 && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {shortDate(d).split(" ")[1]}
                      </span>
                    )}
                  </p>
                  <div
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)] gap-1",
                      out && "opacity-60",
                    )}
                  >
                    {todays.slice(0, 3).map((e) => (
                      <Entry
                        key={e.id}
                        e={e}
                        data={data}
                        onOpen={open}
                        compact
                      />
                    ))}
                    {todays.length > 3 && (
                      <p className="px-1 text-xs text-muted-foreground">
                        +{todays.length - 3} more
                      </p>
                    )}
                    <DayHours iso={d} data={data} classId={classId} max={4} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* Phone: the month as a list. */}
      <div className="md:hidden">
        <Agenda
          events={inMonth}
          data={data}
          open={open}
          empty={`Nothing on the calendar in ${monthLabel(anchor)}.`}
        />
      </div>
    </>
  );
}

/** Entries as a list by day, with how long until a report deadline. */
function Agenda({
  events,
  data,
  open,
  empty,
}: {
  events: CalendarEvent[];
  data: CalendarView;
  open?: (e: CalendarEvent) => void;
  empty: string;
}) {
  if (events.length === 0)
    return (
      <Card className="items-center gap-2 border-dashed px-6 py-10 text-center shadow-none">
        <p className="text-muted-foreground">{empty}</p>
      </Card>
    );
  const starts = [
    ...new Set(
      events.map((e) => (e.startsOn < data.today ? data.today : e.startsOn)),
    ),
  ].sort();
  return (
    <ol className="grid gap-4">
      {starts.map((d) => (
        <li key={d} className="grid gap-2">
          <p
            className={cn(
              "text-sm font-bold",
              d === data.today ? "text-primary" : "text-muted-foreground",
            )}
          >
            {relativeDay(d, data.today)}
            {daysBetween(data.today, d) >= 2 &&
              daysBetween(data.today, d) < 7 && (
                <span className="font-normal"> · {shortDate(d)}</span>
              )}
          </p>
          <div className="grid gap-2">
            {events
              .filter(
                (e) =>
                  (e.startsOn < data.today ? data.today : e.startsOn) === d,
              )
              .map((e) => (
                <div key={e.id}>
                  <Entry e={e} data={data} onOpen={open} />
                  <p className="mt-1 px-1 text-xs text-muted-foreground">
                    {whenText(e)}
                    {e.kind === "deadline" &&
                      daysBetween(data.today, e.startsOn) >= 0 &&
                      ` · ${daysBetween(data.today, e.startsOn) === 0 ? "due today" : `in ${daysBetween(data.today, e.startsOn)} days`}`}
                    {e.note && ` · ${e.note}`}
                  </p>
                </div>
              ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CalendarBoard({
  mode,
  anchor,
  data,
  admin,
  classId,
  linkPath,
  timetable,
}: Props) {
  const router = useRouter();
  const path = usePathname();
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const href = (over: {
    view?: string;
    date?: string;
    class?: string | null;
  }) => {
    const p = new URLSearchParams();
    p.set("view", over.view ?? mode);
    const date = over.date ?? anchor;
    if (date !== data.today) p.set("date", date);
    const cls =
      over.class === undefined
        ? classId
          ? String(classId)
          : null
        : over.class;
    if (cls) p.set("class", cls);
    return `${path}?${p}`;
  };
  const step = mode === "month" ? 31 : 7;
  const prev =
    mode === "month"
      ? addDays(`${anchor.slice(0, 7)}-01`, -1)
      : addDays(anchor, -step);
  const next =
    mode === "month"
      ? addDays(`${anchor.slice(0, 7)}-01`, 32)
      : addDays(anchor, step);
  const monday = mondayOf(anchor);
  const heading =
    mode === "timetable"
      ? ""
      : mode === "month"
        ? monthLabel(anchor)
        : mode === "upcoming"
          ? "The next four weeks"
          : `${shortDate(monday)} – ${shortDate(addDays(monday, 4))}`;
  const open = admin ? (e: CalendarEvent) => setEditing(e) : undefined;
  const tabs: { key: Exclude<CalendarMode, "timetable">; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
  ];

  const editingTimetable = mode === "timetable";
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      {editingTimetable && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2.5 mb-2 h-9 gap-1 px-2.5 font-semibold text-muted-foreground hover:text-foreground"
        >
          <Link href="/calendar?view=week">
            <Icon name="left" size={16} /> Back to calendar
          </Link>
        </Button>
      )}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {editingTimetable
              ? admin
                ? "Each class’s usual week of lessons. You can also change a single week."
                : "The weekly lessons of your classes"
              : admin
                ? "You manage it; staff see their own classes"
                : "Your classes and the whole school"}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
            {editingTimetable ? "Edit timetable" : "Calendar"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode !== "timetable" && data.classes.length > 1 && (
            <select
              aria-label="Class"
              className={cn(SELECT, "w-auto min-w-44")}
              value={classId ?? ""}
              onChange={(e) =>
                router.push(href({ class: e.target.value || null }))
              }
            >
              <option value="">
                {admin ? "All classes" : "All my classes"}
              </option>
              {data.classes.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          )}
          {!editingTimetable && (
            <Button asChild variant="outline">
              <Link
                href={`/calendar?view=timetable${classId ? `&class=${classId}` : ""}`}
              >
                <Icon name="timetable" size={16} />{" "}
                {admin ? "Edit timetable" : "Timetable"}
              </Link>
            </Button>
          )}
          {admin && !editingTimetable && (
            <Button onClick={() => setEditing("new")}>
              <Icon name="plus" size={16} stroke={2} /> Add an entry
            </Button>
          )}
        </div>
      </header>

      {!editingTimetable && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <nav className="flex gap-1" aria-label="View">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={href({ view: t.key })}
                aria-current={mode === t.key ? "page" : undefined}
                className="rounded-full px-3 py-1.5 text-sm font-bold text-muted-foreground hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <p className="font-heading text-lg font-semibold">{heading}</p>
            {(mode === "week" || mode === "month") && (
              <span className="flex gap-1">
                <Button
                  asChild
                  variant="outline"
                  size="icon-sm"
                  aria-label="Earlier"
                >
                  <Link href={href({ date: prev })}>
                    <Icon name="left" size={16} />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={href({ date: data.today })}>Today</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="icon-sm"
                  aria-label="Later"
                >
                  <Link href={href({ date: next })}>
                    <Icon name="right" size={16} />
                  </Link>
                </Button>
              </span>
            )}
          </div>
        </div>
      )}

      {data.classes.length === 0 && !admin && (
        <p className="mb-4 text-sm text-muted-foreground">
          You are not in a class yet, so you see only the whole-school entries.
        </p>
      )}

      {mode === "timetable" && timetable}
      {mode === "week" && (
        <Week anchor={anchor} data={data} classId={classId} open={open} />
      )}
      {mode === "month" && (
        <Month anchor={anchor} data={data} classId={classId} open={open} />
      )}
      {mode === "upcoming" && (
        <Agenda
          events={data.events.filter(
            (e) =>
              appliesTo(e, classId, data.classes) && e.endsOn >= data.today,
          )}
          data={data}
          open={open}
          empty={
            admin
              ? "Nothing in the next four weeks. Add sports days, trips, closures and report deadlines here."
              : "Nothing in the next four weeks."
          }
        />
      )}
      {!admin && mode !== "timetable" && (
        <p className="mt-4 text-sm text-muted-foreground">
          Something wrong or missing? Ask the administrator: only they can
          change the calendar.
        </p>
      )}

      {mode !== "timetable" && (
        <CalendarLinkCard path={linkPath} admin={admin} />
      )}

      {editing && (
        <EventDialog
          key={editing === "new" ? "new" : editing.id}
          classes={data.classes}
          today={anchor < data.today ? data.today : anchor}
          event={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
