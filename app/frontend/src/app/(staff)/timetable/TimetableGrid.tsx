"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Lesson, LessonInput, Subject, TimetableView } from "@peterhouse/shared";
import { CLASS_LEVELS } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { SUBJECT_TINT, WEEKDAY_NAMES, addDays, mondayOf, minutes, shortDate, time, weekday as weekdayOf } from "@/lib/calendar";
import { Icon } from "@/components/icons";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SELECT } from "../AddChild";

const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Pixels for one hour of the week grid. */
const HOUR = 72;
/** Lessons move and stretch by half an hour; an empty stretch of the grid is picked by the whole hour. */
const SNAP = 30;

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const span = (a: number, b: number) => `${time(hm(a))}–${time(hm(b))}`;
const hoursText = (m: number) => `${+(m / 60).toFixed(1)} h`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snapTo = (m: number, to: number) => Math.round(m / to) * to;

/** "09:00" plus 45 minutes is "09:45" (never past 23:55). */
const later = (t: string, add: number) => hm(Math.min(23 * 60 + 55, minutes(t) + add));

/** The delete calls name the changed week a lesson belongs to. */
const weekQuery = (tt: TimetableView) => (tt.weekOf ? `?week=${tt.weekOf}` : "");

/** Lessons go through /api/timetable, which teachers may call too; the server checks what each person may change. */
async function send(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<{ error: string | null; warnings: string[]; id: number | null }> {
  const res = await fetch(`/api${path}`, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const json = (await res.json().catch(() => ({}))) as { error?: string; warnings?: string[]; id?: number };
  return res.ok ? { error: null, warnings: json.warnings ?? [], id: json.id ?? null } : { error: json.error ?? "That did not work.", warnings: [], id: null };
}

function LessonDialog({ tt, lesson, slot, subjectId, meId, onClose }: { tt: TimetableView; lesson: Lesson | null; slot: { weekday: number; start: string } | null; subjectId?: number; meId: number; onClose: () => void }) {
  const router = useRouter();
  const admin = tt.editable === "all";
  const allowed = tt.editable === "all" ? tt.subjects.filter((s) => s.active || s.id === lesson?.subjectId) : tt.subjects.filter((s) => (tt.editable as { subjectIds: number[] }).subjectIds.includes(s.id));
  const startAt = lesson?.start ?? slot?.start ?? "09:00";
  const [f, setF] = useState<LessonInput>(
    lesson ?? { classId: tt.classId, subjectId: subjectId ?? allowed[0]?.id ?? 0, weekday: slot?.weekday ?? 1, start: startAt, end: later(startAt, 60), teacherId: admin ? null : meId, room: "", weekOf: tt.weekOf },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<LessonInput>) => {
    setError("");
    setF((x) => ({ ...x, ...p }));
  };
  const subject = tt.subjects.find((s) => s.id === f.subjectId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const out = lesson ? await send("PUT", `/timetable/lessons/${lesson.id}`, f) : await send("POST", "/timetable/lessons", f);
    setBusy(false);
    if (out.error) return setError(out.error);
    toast.success(`${subject?.name ?? "Lesson"} ${lesson ? "saved" : "added"}: ${WEEKDAY_NAMES[f.weekday - 1]}, ${time(f.start)}–${time(f.end)}.`);
    for (const w of out.warnings) toast.warning(w);
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!lesson) return;
    const out = await send("DELETE", `/timetable/lessons/${lesson.id}${weekQuery(tt)}`);
    if (out.error) return void toast.error(out.error);
    toast.success(`${subject?.name ?? "Lesson"} on ${WEEKDAY_NAMES[lesson.weekday - 1]} removed.`);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{lesson ? "Change this lesson" : `Add a lesson to ${tt.className}`}</DialogTitle>
            <DialogDescription>It repeats every week of the semester.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="ls-subject">Subject</Label>
            <select id="ls-subject" className={SELECT} value={f.subjectId} onChange={(e) => set(withSubject(tt, f.teacherId, Number(e.target.value)))}>
              {allowed.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ls-day">Day</Label>
              <select id="ls-day" className={SELECT} value={f.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })}>
                {WEEKDAY_NAMES.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {SHORT[i]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ls-start">Starts</Label>
              <Input id="ls-start" type="time" step={300} value={f.start} required onChange={(e) => set({ start: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ls-end">Ends</Label>
              <Input id="ls-end" type="time" step={300} value={f.end} required onChange={(e) => set({ end: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ls-teacher">Teacher</Label>
            {admin ? (
              <select id="ls-teacher" className={SELECT} value={f.teacherId ?? ""} onChange={(e) => set({ teacherId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">The class teachers</option>
                {teachersFor(tt, f.subjectId).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">You</p>
            )}
            {admin && <p className="text-xs text-muted-foreground">Only {tt.className}’s teachers are listed. Add a subject teacher on the class’s page in Classes.</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ls-room">
              Room <span className="font-normal text-muted-foreground">optional</span>
            </Label>
            <Input id="ls-room" value={f.room} maxLength={60} onChange={(e) => set({ room: e.target.value })} placeholder="e.g. Room 2" />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {lesson ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-muted-foreground hover:text-destructive">
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this {subject?.name} lesson?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {WEEKDAY_NAMES[lesson.weekday - 1]}, {time(lesson.start)}–{time(lesson.end)}, every week.
                      {!admin && " If it is your last lesson in this class, you stop seeing its children."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy || allowed.length === 0}>{lesson ? "Save" : "Add"}</Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The administrator copies this class's week to other classes (often the same for a level). */
function CopyTimetable({ tt }: { tt: TimetableView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<number[]>([]);
  const others = tt.classes.filter((k) => k.id !== tt.classId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={tt.lessons.length === 0 || others.length === 0}>
          Copy to other classes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy {tt.className}’s timetable</DialogTitle>
          <DialogDescription>The classes you tick get the same lessons, teachers and rooms. Their own timetable is replaced.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {others.map((k) => (
            <Label key={k.id} className="flex items-center gap-2 rounded-md border px-3 py-2 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <Checkbox checked={to.includes(k.id)} onCheckedChange={(v) => setTo((x) => (v === true ? [...x, k.id] : x.filter((y) => y !== k.id)))} />
              {k.name}
            </Label>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={to.length === 0}
            onClick={async () => {
              const err = await adminSend("POST", `/classes/${tt.classId}/timetable/copy`, { toClassIds: to });
              if (err) return void toast.error(err);
              toast.success(`Copied to ${to.map((id) => others.find((k) => k.id === id)?.name).join(", ")}.`);
              setOpen(false);
              setTo([]);
              router.refresh();
            }}
          >
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Draft = { weekday: number; start: number; end: number };

/** The class's teachers who may be named on a lesson of this subject (change 12). */
const teachersFor = (tt: TimetableView, subjectId: number) => tt.teachers.filter((t) => !t.subjectIds || t.subjectIds.includes(subjectId));
/** A new subject keeps the teacher only if they teach it here. */
const withSubject = (tt: TimetableView, teacherId: number | null, subjectId: number) => ({ subjectId, ...(teacherId && !teachersFor(tt, subjectId).some((t) => t.id === teacherId) ? { teacherId: null } : {}) });

const toInput = (l: Lesson): LessonInput => ({ classId: l.classId, subjectId: l.subjectId, weekday: l.weekday, start: l.start, end: l.end, teacherId: l.teacherId, room: l.room, weekOf: l.weekOf ?? null });

type Gesture =
  | { kind: "create"; weekday: number; a: number; b: number }
  | { kind: "move"; lesson: Lesson; weekday: number; start: number; end: number; grab: number; x0: number; y0: number; moved: boolean }
  | { kind: "resize"; lesson: Lesson; end: number };

type PaletteDrag = { subject: Subject; x: number; y: number; x0: number; y0: number; target: { weekday: number; start: number } | null };

function SubjectChips({ subjects, value, onPick }: { subjects: Subject[]; value: number | null; onPick: (id: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Subject" className="grid grid-cols-2 gap-1.5">
      {subjects.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={s.id === value}
          onClick={() => onPick(s.id)}
          className={cn("flex min-h-10 items-center rounded-[10px] border px-2.5 text-left text-[13.5px] font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", SUBJECT_TINT[s.color], s.id === value && "border-foreground ring-1 ring-foreground")}
        >
          <span className="truncate">{s.name}</span>
        </button>
      ))}
    </div>
  );
}

function NewLessonPanel({ d, subjects, value, onPick, onAdd, onCancel }: { d: Draft; subjects: Subject[]; value: number | null; onPick: (id: number) => void; onAdd: () => void; onCancel: () => void }) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="font-heading text-lg font-semibold leading-tight">Add a lesson</p>
        <p className="text-[13px] text-muted-foreground">
          {WEEKDAY_NAMES[d.weekday - 1]} · {span(d.start, d.end)}
          {d.end - d.start > 60 && ` · ${hoursText(d.end - d.start)}`}
        </p>
      </div>
      <SubjectChips subjects={subjects} value={value} onPick={onPick} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onAdd} disabled={value === null}>
          Add lesson
        </Button>
      </div>
    </div>
  );
}

/** A tapped lesson: change its subject, teacher or room right here. Each change is saved as it is made. */
function LessonPanel({ lesson, tt, subjects, editable, onChange, onRemove }: { lesson: Lesson; tt: TimetableView; subjects: Subject[]; editable: boolean; onChange: (patch: Partial<LessonInput>) => void; onRemove: () => void }) {
  const admin = tt.editable === "all";
  const subject = tt.subjects.find((s) => s.id === lesson.subjectId);
  const [room, setRoom] = useState(lesson.room);
  const latest = useRef({ room, saved: lesson.room, onChange });
  useEffect(() => {
    latest.current = { room, saved: lesson.room, onChange };
  });
  // Typing in Room saves after a short pause, and once more if the panel is closed first.
  useEffect(() => {
    if (room === lesson.room) return;
    const t = setTimeout(() => latest.current.onChange({ room }), 600);
    return () => clearTimeout(t);
  }, [room, lesson.room]);
  useEffect(
    () => () => {
      if (latest.current.room !== latest.current.saved) latest.current.onChange({ room: latest.current.room });
    },
    [],
  );
  const teacher = lesson.teacherId ? (tt.teachers.find((t) => t.id === lesson.teacherId)?.name ?? "A teacher") : "Class teachers";
  const head = (
    <div>
      <p className="font-heading text-lg font-semibold leading-tight">{subject?.name ?? "Lesson"}</p>
      <p className="text-[13px] text-muted-foreground">
        {WEEKDAY_NAMES[lesson.weekday - 1]} · {span(minutes(lesson.start), minutes(lesson.end))} · every week
      </p>
    </div>
  );
  if (!editable)
    return (
      <div className="grid gap-2">
        {head}
        <p className="text-sm">
          {teacher}
          {lesson.room && ` · ${lesson.room}`}
        </p>
      </div>
    );
  return (
    <div className="grid gap-3">
      {head}
      <SubjectChips subjects={subjects} value={lesson.subjectId} onPick={(id) => onChange(withSubject(tt, lesson.teacherId, id))} />
      <div className={cn("grid gap-2.5", admin && "grid-cols-2")}>
        {admin && (
          <div className="grid gap-1.5">
            <Label htmlFor="lp-teacher" className="text-xs font-bold">
              Teacher
            </Label>
            <select id="lp-teacher" className={SELECT} value={lesson.teacherId ?? ""} onChange={(e) => onChange({ teacherId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Class teachers</option>
              {teachersFor(tt, lesson.subjectId).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="lp-room" className="text-xs font-bold">
            Room
          </Label>
          <Input id="lp-room" value={room} maxLength={60} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 2" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 /> Remove lesson
        </Button>
        <span className="text-xs font-semibold text-success">Saved as you go</span>
      </div>
    </div>
  );
}

/** One class's fixed week: drag across empty hours to add, drag a subject onto the week, drag a lesson to move or stretch it. */
export function TimetableGrid({ tt: served0, today, meId }: { tt: TimetableView; /** Today in Singapore, YYYY-MM-DD, to mark the day. */ today: string; meId: number }) {
  const router = useRouter();
  const path = usePathname();
  // A changed week has to be started before it can be edited; until then it only shows the normal week.
  const tt: TimetableView = served0.weekOf && !served0.weekChanged ? { ...served0, editable: null } : served0;
  const admin = tt.editable === "all";
  const isAdmin = served0.editable === "all";
  const [weekBusy, setWeekBusy] = useState(false);
  const href = (over: { classId?: number; week?: string | null }) => {
    const p = new URLSearchParams({ view: "timetable", class: String(over.classId ?? tt.classId) });
    const week = over.week === undefined ? tt.weekOf : over.week;
    if (week) p.set("week", week);
    return `${path}?${p}`;
  };
  // This week and the next fifteen, plus any changed week outside that.
  const weekChoices = [...new Set([...Array.from({ length: 16 }, (_, n) => addDays(mondayOf(today), n * 7)), ...tt.changedWeeks, ...(tt.weekOf ? [tt.weekOf] : [])])].sort();
  async function changeWeek(start: boolean) {
    if (!tt.weekOf) return;
    setWeekBusy(true);
    const err = start ? await adminSend("POST", "/timetable/weeks", { classId: tt.classId, weekOf: tt.weekOf }) : await adminSend("DELETE", `/timetable/weeks?classId=${tt.classId}&weekOf=${tt.weekOf}`);
    setWeekBusy(false);
    if (err) return void toast.error(err);
    toast.success(start ? "Go ahead: only this week will change." : "This week uses the usual timetable again.");
    router.refresh();
  }
  const [lessons, setLessons] = useState<Lesson[]>(tt.lessons);
  // A fresh timetable from the server replaces what is shown (changes show at once and are confirmed by this).
  const [served, setServed] = useState(tt.lessons);
  if (served !== tt.lessons) {
    setServed(tt.lessons);
    setLessons(tt.lessons);
  }
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [palette, setPalette] = useState<PaletteDrag | null>(null);
  const dragged = useRef(false);
  const [pick, setPick] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ lesson: Lesson | null; slot: { weekday: number; start: string } | null; subjectId?: number } | null>(null);
  const [phoneDay, setPhoneDay] = useState(Math.min(5, weekdayOf(today)));
  const cols = useRef<HTMLDivElement>(null);
  const byKeyboard = useRef(false);

  const allowed = tt.editable === "all" ? tt.subjects.filter((s) => s.active) : tt.editable ? tt.subjects.filter((s) => (tt.editable as { subjectIds: number[] }).subjectIds.includes(s.id)) : [];
  const canAdd = allowed.length > 0;
  const canEdit = (l: Lesson) => admin || (!!tt.editable && (tt.editable as { subjectIds: number[] }).subjectIds.includes(l.subjectId) && l.teacherId === meId);
  const subjectOf = (l: Lesson) => tt.subjects.find((s) => s.id === l.subjectId);
  const chosen = pick !== null && allowed.some((s) => s.id === pick) ? pick : (allowed[0]?.id ?? null);

  // Shown hours: 8:00 to 13:00 at least, widened to fit the lessons plus one free hour to add into.
  const starts = lessons.map((l) => minutes(l.start));
  const ends = lessons.map((l) => minutes(l.end));
  const startMin = Math.max(6 * 60, Math.min(8 * 60, starts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 8 * 60));
  const endMin = Math.min(20 * 60, Math.max(13 * 60, ends.length ? Math.ceil(Math.max(...ends) / 60) * 60 + 60 : 13 * 60));
  const weekdays = [1, 2, 3, 4, 5, ...[6, 7].filter((d) => lessons.some((l) => l.weekday === d))];
  const height = ((endMin - startMin) / 60) * HOUR;
  const todayWd = weekdayOf(today);
  const perSubject = tt.subjects.map((s) => ({ s, mins: lessons.filter((l) => l.subjectId === s.id).reduce((n, l) => n + minutes(l.end) - minutes(l.start), 0) }));

  const clashWith = (weekday: number, start: number, end: number, ignore?: number) => lessons.find((l) => l.id !== ignore && l.weekday === weekday && minutes(l.start) < end && start < minutes(l.end));
  const clashText = (l: Lesson) => `Overlaps ${subjectOf(l)?.name ?? "another lesson"} ${span(minutes(l.start), minutes(l.end))}`;

  // ── saving: every change shows at once, then goes to the server; a refusal puts it back ──────────────────────────
  async function add(input: LessonInput, name: string) {
    const clash = clashWith(input.weekday, minutes(input.start), minutes(input.end));
    if (clash) return void toast.error(clashText(clash));
    const temp = -Date.now();
    setLessons((ls) => [...ls, { ...input, id: temp }]);
    const out = await send("POST", "/timetable/lessons", input);
    if (out.error || out.id === null) {
      setLessons((ls) => ls.filter((x) => x.id !== temp));
      return void toast.error(out.error ?? "That did not work.");
    }
    const id = out.id;
    setLessons((ls) => ls.map((x) => (x.id === temp ? { ...x, id } : x)));
    toast.success(`${name} added: ${WEEKDAY_NAMES[input.weekday - 1]}, ${span(minutes(input.start), minutes(input.end))}.`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const e = await send("DELETE", `/timetable/lessons/${id}${weekQuery(tt)}`);
          if (e.error) toast.error(e.error);
          router.refresh();
        },
      },
    });
    for (const w of out.warnings) toast.warning(w);
    router.refresh();
  }

  async function update(l: Lesson, patch: Partial<LessonInput>, message?: string) {
    const next = { ...l, ...patch };
    const clash = clashWith(next.weekday, minutes(next.start), minutes(next.end), l.id);
    if (clash) return void toast.error(clashText(clash));
    setLessons((ls) => ls.map((x) => (x.id === l.id ? next : x)));
    const out = await send("PUT", `/timetable/lessons/${l.id}`, toInput(next));
    if (out.error) {
      setLessons((ls) => ls.map((x) => (x.id === l.id ? l : x)));
      return void toast.error(out.error);
    }
    if (message) {
      const before = toInput(l);
      toast.success(message, {
        action: {
          label: "Undo",
          onClick: async () => {
            const e = await send("PUT", `/timetable/lessons/${l.id}`, before);
            if (e.error) toast.error(e.error);
            router.refresh();
          },
        },
      });
    }
    for (const w of out.warnings) toast.warning(w);
    router.refresh();
  }

  async function remove(l: Lesson) {
    setSelectedId(null);
    setLessons((ls) => ls.filter((x) => x.id !== l.id));
    const out = await send("DELETE", `/timetable/lessons/${l.id}${weekQuery(tt)}`);
    if (out.error) {
      setLessons((ls) => [...ls, l]);
      return void toast.error(out.error);
    }
    const input = toInput(l);
    toast.success(`${subjectOf(l)?.name ?? "Lesson"} on ${WEEKDAY_NAMES[l.weekday - 1]} removed.`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const e = await send("POST", "/timetable/lessons", input);
          if (e.error) toast.error(e.error);
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  const newLesson = (weekday: number, start: number, end: number, subjectId: number): LessonInput => ({ classId: tt.classId, subjectId, weekday, start: hm(start), end: hm(end), teacherId: admin ? null : meId, room: "", weekOf: tt.weekOf });

  // ── dragging on the grid ───────────────────────────────────────────────────────────────────────────────────────
  const pointAt = (e: { clientX: number; clientY: number }) => {
    const r = cols.current!.getBoundingClientRect();
    const day = clamp(Math.floor(((e.clientX - r.left) / r.width) * weekdays.length), 0, weekdays.length - 1);
    return { weekday: weekdays[day], min: startMin + ((e.clientY - r.top) / HOUR) * 60, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  };
  /** How far a drag over empty hours can reach from hour `a` before it would run into another lesson. */
  const reach = (weekday: number, a: number, target: number) => {
    const step = target >= a ? 60 : -60;
    let b = a;
    while (b !== target && !clashWith(weekday, Math.min(a, b + step), Math.max(a, b + step) + 60)) b += step;
    return b;
  };
  const hourAt = (min: number) => clamp(Math.floor(min / 60) * 60, startMin, endMin - 60);
  const begin = (g: Gesture) => {
    gestureRef.current = g;
    setGesture(g);
  };

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !cols.current) return;
    byKeyboard.current = false;
    const el = e.target as HTMLElement;
    const lessonEl = el.closest<HTMLElement>("[data-lesson]");
    const p = pointAt(e);
    if (lessonEl) {
      const l = lessons.find((x) => x.id === Number(lessonEl.dataset.lesson));
      if (!l) return;
      setSelectedId(l.id);
      setDraft(null);
      if (!canEdit(l)) return;
      cols.current.setPointerCapture(e.pointerId);
      begin(el.closest("[data-resize]") ? { kind: "resize", lesson: l, end: minutes(l.end) } : { kind: "move", lesson: l, weekday: l.weekday, start: minutes(l.start), end: minutes(l.end), grab: p.min - minutes(l.start), x0: e.clientX, y0: e.clientY, moved: false });
      return;
    }
    if (!canAdd) return;
    setSelectedId(null);
    setDraft(null);
    cols.current.setPointerCapture(e.pointerId);
    const a = hourAt(p.min);
    begin({ kind: "create", weekday: p.weekday, a, b: a });
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g) return;
    const p = pointAt(e);
    let next: Gesture = g;
    if (g.kind === "create") next = { ...g, b: reach(g.weekday, g.a, hourAt(p.min)) };
    else if (g.kind === "resize") next = { ...g, end: clamp(snapTo(p.min, SNAP), minutes(g.lesson.start) + SNAP, endMin) };
    else {
      const moved = g.moved || Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 4;
      if (!moved) return;
      const dur = minutes(g.lesson.end) - minutes(g.lesson.start);
      const start = clamp(snapTo(p.min - g.grab, SNAP), startMin, endMin - dur);
      next = { ...g, moved, weekday: p.weekday, start, end: start + dur };
    }
    gestureRef.current = next;
    setGesture(next);
  }

  function onUp() {
    const g = gestureRef.current;
    gestureRef.current = null;
    setGesture(null);
    if (!g) return;
    if (g.kind === "create") {
      const d = { weekday: g.weekday, start: Math.min(g.a, g.b), end: Math.max(g.a, g.b) + 60 };
      const clash = clashWith(d.weekday, d.start, d.end);
      if (clash) return void toast.error(clashText(clash));
      setDraft(d);
    } else if (g.kind === "move") {
      if (g.moved && (g.weekday !== g.lesson.weekday || g.start !== minutes(g.lesson.start))) {
        update(g.lesson, { weekday: g.weekday, start: hm(g.start), end: hm(g.end) }, `${subjectOf(g.lesson)?.name ?? "Lesson"} moved to ${WEEKDAY_NAMES[g.weekday - 1]}, ${span(g.start, g.end)}.`);
      }
    } else if (g.end !== minutes(g.lesson.end)) {
      update(g.lesson, { end: hm(g.end) }, `${subjectOf(g.lesson)?.name ?? "Lesson"} now ${span(minutes(g.lesson.start), g.end)}.`);
    }
  }

  function onKey(e: React.KeyboardEvent, l: Lesson) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      byKeyboard.current = true;
      setDraft(null);
      setSelectedId(l.id);
      return;
    }
    if (!canEdit(l)) return;
    const s = minutes(l.start);
    const en = minutes(l.end);
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      void remove(l);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const d = e.key === "ArrowUp" ? -SNAP : SNAP;
      if (e.shiftKey) {
        const end = clamp(en + d, s + SNAP, endMin);
        if (end !== en) void update(l, { end: hm(end) });
      } else {
        const start = clamp(s + d, startMin, endMin - (en - s));
        if (start !== s) void update(l, { start: hm(start), end: hm(start + en - s) });
      }
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.shiftKey) {
      e.preventDefault();
      const next = weekdays[weekdays.indexOf(l.weekday) + (e.key === "ArrowLeft" ? -1 : 1)];
      if (next) void update(l, { weekday: next });
    }
  }

  // ── dragging a subject from the list onto the week ─────────────────────────────────────────────────────────────
  // The drag lives in a ref as well as in state: a pointer move that arrives after the drop (with an older render's
  // state) must not bring the drag back, or the subject is left floating on the page.
  const paletteRef = useRef<PaletteDrag | null>(null);
  const setPaletteDrag = (d: PaletteDrag | null) => {
    paletteRef.current = d;
    setPalette(d);
  };
  function paletteMove(e: React.PointerEvent<HTMLButtonElement>) {
    const cur = paletteRef.current;
    if (!cur) return;
    if (Math.hypot(e.clientX - cur.x0, e.clientY - cur.y0) > 4) dragged.current = true;
    const p = pointAt(e);
    setPaletteDrag({ ...cur, x: e.clientX, y: e.clientY, target: p.inside && dragged.current ? { weekday: p.weekday, start: hourAt(p.min) } : null });
  }
  /** The drop: on release, or when the browser stops sending this pointer to us (the drag must still end). */
  function paletteUp() {
    const p = paletteRef.current;
    if (!p) return;
    setPaletteDrag(null);
    if (p.target && dragged.current) void add(newLesson(p.target.weekday, p.target.start, p.target.start + 60, p.subject.id), p.subject.name);
  }

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const live = gesture?.kind === "create" ? { weekday: gesture.weekday, start: Math.min(gesture.a, gesture.b), end: Math.max(gesture.a, gesture.b) + 60 } : draft;
  const rect = (weekday: number, start: number, end: number) => {
    const i = weekdays.indexOf(weekday);
    return { top: ((start - startMin) / 60) * HOUR, height: ((end - start) / 60) * HOUR, left: `calc(${i} * (100% / ${weekdays.length}) + 3px)`, width: `calc(100% / ${weekdays.length} - 6px)` };
  };
  const panelOpen = (!!draft || !!selected) && !gesture;

  const lessonBlock = (l: Lesson) => {
    const g = gesture;
    let weekday = l.weekday;
    let s = minutes(l.start);
    let e = minutes(l.end);
    let moving = false;
    if (g?.kind === "move" && g.moved && g.lesson.id === l.id) [weekday, s, e, moving] = [g.weekday, g.start, g.end, true];
    if (g?.kind === "resize" && g.lesson.id === l.id) [e, moving] = [g.end, true];
    const sub = subjectOf(l);
    const editable = canEdit(l);
    const r = rect(weekday, s, e);
    const bad = moving && !!clashWith(weekday, s, e, l.id);
    const isSel = selected?.id === l.id;
    const el = (
      <div
        key={l.id}
        data-lesson={l.id}
        role="button"
        tabIndex={0}
        aria-label={`${sub?.name ?? "Lesson"}, ${WEEKDAY_NAMES[l.weekday - 1]} ${span(minutes(l.start), minutes(l.end))}.${editable ? " Arrow keys move it, Shift with Up or Down makes it shorter or longer, Delete removes it." : ""}`}
        onKeyDown={(ev) => onKey(ev, l)}
        style={{ top: r.top + 1, height: r.height - 2, left: r.left, width: r.width }}
        className={cn(
          "group absolute select-none overflow-hidden rounded-[10px] border px-2.5 py-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          SUBJECT_TINT[sub?.color ?? "stone"],
          editable && "cursor-grab touch-none",
          moving && "z-20 cursor-grabbing shadow-lg",
          bad && "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive",
          isSel && !moving && "ring-2 ring-foreground/50",
          l.id < 0 && "opacity-70",
        )}
      >
        <span className="block truncate text-sm font-bold leading-tight">{sub?.name ?? "Lesson"}</span>
        <span className="block truncate text-xs opacity-80">{span(s, e)}</span>
        {l.room && r.height >= 90 && <span className="block truncate text-xs opacity-80">{l.room}</span>}
        {moving && (
          <span className={cn("pointer-events-none absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold text-white", bad ? "bg-destructive" : "bg-foreground")}>
            {bad ? clashText(clashWith(weekday, s, e, l.id)!) : `${SHORT[weekday - 1]} ${span(s, e)}`}
          </span>
        )}
        {editable && (
          <span data-resize aria-hidden className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-end justify-center pb-0.5">
            <span className={cn("h-1 w-7 rounded-full bg-current transition-opacity", isSel || moving ? "opacity-40" : "opacity-0 group-hover:opacity-40")} />
          </span>
        )}
      </div>
    );
    return isSel && !moving ? (
      <PopoverAnchor asChild key={l.id}>
        {el}
      </PopoverAnchor>
    ) : (
      el
    );
  };

  const draftRect = live ? rect(live.weekday, live.start, live.end) : null;
  const hint = admin ? "Drag across empty hours to add a lesson, or drag a subject onto the week. Drag a lesson to move it." : tt.editable ? "You can add and change lessons of your own subject." : "";

  // ── phone: one day at a time, tap a free hour to add ───────────────────────────────────────────────────────────
  const phoneRows = (() => {
    const rows: ({ free: number } | { lesson: Lesson })[] = [];
    let cursor = startMin;
    for (const l of lessons.filter((x) => x.weekday === phoneDay).sort((a, b) => minutes(a.start) - minutes(b.start))) {
      for (; cursor + 60 <= minutes(l.start); cursor += 60) rows.push({ free: cursor });
      rows.push({ lesson: l });
      cursor = Math.max(cursor, Math.ceil(minutes(l.end) / 60) * 60);
    }
    for (; cursor + 60 <= endMin; cursor += 60) rows.push({ free: cursor });
    return rows;
  })();

  const level = tt.classes.find((k) => k.id === tt.classId)?.level;
  const levels = CLASS_LEVELS.filter((l) => tt.classes.some((k) => k.level === l.key));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {tt.classes.length > 1 && (
          <>
            {/* Level first, then the classes of that level, so the class list stays short. */}
            {levels.length > 1 && (
              <div className="grid gap-1.5">
                <label htmlFor="tt-level" className="text-sm font-semibold text-muted-foreground">
                  Level
                </label>
                <select
                  id="tt-level"
                  className={cn(SELECT, "w-auto min-w-44")}
                  value={level}
                  onChange={(e) => {
                    const first = tt.classes.find((k) => k.level === e.target.value);
                    if (first) router.push(href({ classId: first.id }));
                  }}
                >
                  {levels.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.key} · {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-1.5">
              <label htmlFor="tt-class" className="text-sm font-semibold text-muted-foreground">
                Class
              </label>
              <select id="tt-class" className={cn(SELECT, "w-auto min-w-52")} value={tt.classId} onChange={(e) => router.push(href({ classId: Number(e.target.value) }))}>
                {tt.classes
                  .filter((k) => k.level === level)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <label htmlFor="tt-week" className="text-sm font-semibold text-muted-foreground">
            Showing
          </label>
          <select id="tt-week" className={cn(SELECT, "w-auto min-w-72")} value={tt.weekOf ?? ""} onChange={(e) => router.push(href({ week: e.target.value || null }))}>
            <optgroup label="The same every week">
              <option value="">Usual timetable</option>
            </optgroup>
            <optgroup label="One week only (a sports day, a trip…)">
              {weekChoices.map((w) => (
                <option key={w} value={w}>
                  {shortDate(w)} – {shortDate(addDays(w, 4))}
                  {w === mondayOf(today) ? " (this week)" : ""}
                  {tt.changedWeeks.includes(w) ? " · different" : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {!tt.weekOf ? (
        <p className="-mt-2 text-sm text-muted-foreground">Changes here apply to every week, except weeks you have changed individually.</p>
      ) : tt.weekChanged ? (
        <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            <b>
              {shortDate(tt.weekOf)} – {shortDate(addDays(tt.weekOf, 4))}
            </b>{" "}
            has its own lessons. Every other week keeps the usual timetable.
          </p>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={weekBusy}>
                  Use the usual timetable again
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Use the usual timetable for this week?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The lessons you changed for {shortDate(tt.weekOf)} – {shortDate(addDays(tt.weekOf, 4))} are removed. That week follows the usual timetable again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my changes</AlertDialogCancel>
                  <AlertDialogAction onClick={() => changeWeek(false)}>Use the usual timetable</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ) : (
        <div className="-mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-secondary/60 px-4 py-3">
          <p className="text-sm">
            <b>
              {shortDate(tt.weekOf)} – {shortDate(addDays(tt.weekOf, 4))}
            </b>{" "}
            uses the usual timetable.
            {isAdmin && " To make this week different, edit it on its own."}
          </p>
          {isAdmin && (
            <Button disabled={weekBusy} onClick={() => changeWeek(true)}>
              Edit just this week
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="min-w-60 flex-1 text-sm text-muted-foreground">
          <span className="hidden md:inline">{hint}</span>
        </p>
        <span className="flex flex-wrap gap-2.5">
          {admin && !tt.weekOf && <CopyTimetable tt={tt} />}
          {canAdd && (
            <Button variant="outline" className="h-11 font-semibold" onClick={() => setEditing({ lesson: null, slot: null })}>
              <Icon name="plus" size={16} stroke={2} /> Add a lesson
            </Button>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {canAdd && (
          <aside aria-labelledby="tt-subjects" className="hidden w-full gap-3 rounded-2xl border bg-card p-5 md:grid lg:w-64 lg:shrink-0">
            <div>
              <h2 id="tt-subjects" className="font-heading text-xl font-semibold">
                Subjects
              </h2>
              <p className="text-[13.5px] text-muted-foreground">Drag one onto the week. It lands as a one-hour lesson.</p>
            </div>
            <ul className="flex flex-wrap gap-2 lg:grid">
              {allowed.map((s) => {
                const mins = perSubject.find((x) => x.s.id === s.id)?.mins ?? 0;
                return (
                  <li key={s.id} className="lg:w-full">
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        dragged.current = false;
                        setPaletteDrag({ subject: s, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, target: null });
                      }}
                      onPointerMove={paletteMove}
                      onPointerUp={paletteUp}
                      onLostPointerCapture={paletteUp}
                      onPointerCancel={() => setPaletteDrag(null)}
                      onClick={() => {
                        if (dragged.current) {
                          dragged.current = false;
                          return;
                        }
                        setEditing({ lesson: null, slot: null, subjectId: s.id });
                      }}
                      className={cn("flex min-h-12 w-full cursor-grab touch-none items-center gap-2.5 rounded-xl border px-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", SUBJECT_TINT[s.color])}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0 opacity-55">
                        <circle cx="9" cy="6" r="1.8" />
                        <circle cx="15" cy="6" r="1.8" />
                        <circle cx="9" cy="12" r="1.8" />
                        <circle cx="15" cy="12" r="1.8" />
                        <circle cx="9" cy="18" r="1.8" />
                        <circle cx="15" cy="18" r="1.8" />
                      </svg>
                      <span className="flex-1 truncate text-[14.5px] font-bold">{s.name}</span>
                      <span className="text-[12.5px] font-semibold opacity-85">{hoursText(mins)} / week</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {admin && (
              <Link href="/settings/subjects" className="flex items-center justify-between border-t pt-3 text-[13.5px] font-bold text-primary">
                Manage subjects <Icon name="arrow" size={16} stroke={2.2} />
              </Link>
            )}
          </aside>
        )}

        {/* Larger screens: the week as a grid you can drag on. */}
        <section
          aria-label="Week"
          className={cn("hidden min-w-0 flex-1 overflow-hidden rounded-2xl border bg-card pb-2 md:block", served0.weekOf && !served0.weekChanged && "cursor-not-allowed")}
          onClickCapture={() => {
            if (served0.weekOf && !served0.weekChanged) toast(isAdmin ? "This week uses the usual timetable. Press “Edit just this week” first." : "This week uses the usual timetable.");
          }}
        >
          <div className="grid border-b" style={{ gridTemplateColumns: `64px repeat(${weekdays.length}, minmax(0, 1fr))` }}>
            <span />
            {weekdays.map((wd) => (
              <span key={wd} className={cn("px-2 py-3.5 text-center text-sm font-bold", wd === todayWd ? "text-primary" : "text-muted-foreground")}>
                {WEEKDAY_NAMES[wd - 1]}
              </span>
            ))}
          </div>
          <div className="flex">
            <div className="relative w-16 shrink-0" style={{ height }} aria-hidden>
              {Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => (
                <span key={i} className={cn("absolute right-2.5 text-xs font-semibold tabular-nums text-muted-foreground", i === 0 ? "translate-y-1" : "-translate-y-1/2")} style={{ top: i * HOUR }}>
                  {time(hm(startMin + i * 60))}
                </span>
              ))}
            </div>
            <Popover
              open={panelOpen}
              onOpenChange={(o) => {
                if (!o) {
                  setDraft(null);
                  setSelectedId(null);
                }
              }}
            >
              <div
                ref={cols}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={() => {
                  gestureRef.current = null;
                  setGesture(null);
                }}
                className={cn("relative min-w-0 flex-1 select-none border-l", canAdd && "cursor-crosshair")}
                style={{
                  height,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR / 2 - 1}px, #f3f1ec ${HOUR / 2 - 1}px, #f3f1ec ${HOUR / 2}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR - 1}px, #e3e0d9 ${HOUR - 1}px, #e3e0d9 ${HOUR}px)`,
                }}
              >
                {weekdays.map((wd, i) => (
                  <span key={wd} aria-hidden className={cn("pointer-events-none absolute inset-y-0 border-l first:border-l-0", wd === todayWd && "bg-primary/[0.03]")} style={{ left: `${(i / weekdays.length) * 100}%`, width: `${100 / weekdays.length}%` }} />
                ))}
                {lessons.map(lessonBlock)}

                {gesture?.kind === "move" && gesture.moved && draftRect === null && (
                  <span aria-hidden className="pointer-events-none absolute rounded-[10px] border-2 border-dashed border-foreground/25" style={{ ...rect(gesture.lesson.weekday, minutes(gesture.lesson.start), minutes(gesture.lesson.end)), top: rect(gesture.lesson.weekday, minutes(gesture.lesson.start), minutes(gesture.lesson.end)).top + 1 }} />
                )}
                {palette?.target && (
                  <span aria-hidden className={cn("pointer-events-none absolute flex flex-col rounded-[10px] border-2 border-dashed px-2.5 py-1.5 opacity-90", SUBJECT_TINT[palette.subject.color])} style={rect(palette.target.weekday, palette.target.start, palette.target.start + 60)}>
                    <span className="text-sm font-bold">{palette.subject.name}</span>
                    <span className="text-xs">{span(palette.target.start, palette.target.start + 60)}</span>
                  </span>
                )}
                {live && draftRect && (
                  <PopoverAnchor asChild>
                    <span
                      className={cn("pointer-events-none absolute flex flex-col rounded-[10px] border-2 px-2.5 py-1.5", gesture ? "border-[#2c5f80] bg-[#2c5f80]/10" : "border-dashed border-foreground bg-card/85")}
                      style={{ top: draftRect.top + 1, height: draftRect.height - 2, left: draftRect.left, width: draftRect.width }}
                    >
                      <span className="text-sm font-bold">{gesture ? hoursText(live.end - live.start) : "New lesson"}</span>
                      <span className="text-xs text-muted-foreground">{span(live.start, live.end)}</span>
                    </span>
                  </PopoverAnchor>
                )}
              </div>
              <PopoverContent
                side="right"
                align="start"
                collisionPadding={16}
                className="w-80 rounded-2xl p-4"
                onOpenAutoFocus={(e) => !byKeyboard.current && e.preventDefault()}
                onInteractOutside={(e) => {
                  // A press on the grid is handled by the grid itself (it may start a drag); only other presses dismiss.
                  if (cols.current?.contains(e.target as Node)) e.preventDefault();
                }}
              >
                {draft ? (
                  <NewLessonPanel
                    d={draft}
                    subjects={allowed}
                    value={chosen}
                    onPick={setPick}
                    onCancel={() => setDraft(null)}
                    onAdd={() => {
                      const s = allowed.find((x) => x.id === chosen);
                      if (!s) return;
                      setDraft(null);
                      void add(newLesson(draft.weekday, draft.start, draft.end, s.id), s.name);
                    }}
                  />
                ) : selected ? (
                  <LessonPanel
                    key={selected.id}
                    lesson={selected}
                    tt={tt}
                    subjects={tt.editable === "all" ? tt.subjects.filter((s) => s.active || s.id === selected.subjectId) : allowed}
                    editable={canEdit(selected)}
                    onChange={(patch) => update(selected, patch)}
                    onRemove={() => remove(selected)}
                  />
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
          {lessons.length === 0 && !canAdd && <p className="px-6 py-8 text-center text-sm text-muted-foreground">No lessons on this timetable yet.</p>}
        </section>

        {/* Phone: one day at a time. */}
        <section aria-label="Day" className="grid w-full gap-3 md:hidden">
          <div className="flex gap-1 rounded-2xl bg-secondary p-1" role="tablist" aria-label="Day">
            {weekdays.map((wd) => (
              <button key={wd} type="button" role="tab" aria-selected={phoneDay === wd} onClick={() => setPhoneDay(wd)} className="h-11 flex-1 rounded-xl text-sm font-bold text-muted-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-sm">
                {SHORT[wd - 1]}
              </button>
            ))}
          </div>
          <ul className="grid gap-2">
            {phoneRows.map((r) => {
              if ("free" in r)
                return (
                  <li key={`f${r.free}`} className="flex items-stretch gap-3">
                    <span className="w-11 shrink-0 pt-4 text-[12.5px] font-semibold tabular-nums text-muted-foreground">{time(hm(r.free))}</span>
                    {canAdd ? (
                      <button type="button" onClick={() => setEditing({ lesson: null, slot: { weekday: phoneDay, start: hm(r.free) } })} className="flex min-h-14 flex-1 items-center gap-2 rounded-xl border border-dashed px-3.5 text-sm font-semibold text-muted-foreground">
                        <Plus className="size-4" /> Add a lesson
                      </button>
                    ) : (
                      <span className="min-h-14 flex-1 border-b border-dashed" />
                    )}
                  </li>
                );
              const l = r.lesson;
              const sub = subjectOf(l);
              return (
                <li key={l.id} className="flex items-stretch gap-3">
                  <span className="w-11 shrink-0 pt-4 text-[12.5px] font-semibold tabular-nums text-muted-foreground">{time(l.start)}</span>
                  <button type="button" disabled={!canEdit(l)} onClick={() => setEditing({ lesson: l, slot: null })} className={cn("flex min-h-14 flex-1 flex-col justify-center rounded-xl border px-3.5 text-left disabled:opacity-100", SUBJECT_TINT[sub?.color ?? "stone"])}>
                    <span className="font-bold">{sub?.name}</span>
                    <span className="text-[12.5px] opacity-85">
                      {span(minutes(l.start), minutes(l.end))}
                      {l.room && ` · ${l.room}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {palette && dragged.current && (
        <div aria-hidden className={cn("pointer-events-none fixed z-50 w-36 -rotate-3 rounded-[10px] border px-3 py-2 text-sm font-bold shadow-xl", SUBJECT_TINT[palette.subject.color])} style={{ left: palette.x + 12, top: palette.y + 12 }}>
          {palette.subject.name}
        </div>
      )}

      {editing && <LessonDialog tt={tt} lesson={editing.lesson} slot={editing.slot} subjectId={editing.subjectId} meId={meId} onClose={() => setEditing(null)} />}
    </div>
  );
}
