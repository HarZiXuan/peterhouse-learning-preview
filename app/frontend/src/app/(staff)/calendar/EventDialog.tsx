"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CalendarAudience, CalendarEvent, CalendarEventInput, CalendarKind, CalendarView, ClassLevel } from "@peterhouse/shared";
import { CLASS_LEVELS } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { KIND_LABEL, forWhom, shortDate, whenText } from "@/lib/calendar";
import { AlignLeft, Clock, MapPin, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SELECT } from "../AddChild";

const KINDS: { key: CalendarKind; label: string; hint: string }[] = [
  { key: "event", label: "Event", hint: "A trip, a visit, Sports Day…" },
  { key: "closure", label: "School closed", hint: "A holiday or training day. Class hours are hidden that day." },
  { key: "deadline", label: "Report deadline", hint: "When reports are due for review. Teachers see the days left." },
];

/** An icon column and a content column, so the title, times, place and description all start on one line. */
const ROW = "grid grid-cols-[28px_minmax(0,1fr)] items-start gap-x-4";
const ICON = "mt-2 size-5 justify-self-center text-muted-foreground";

const CHOICE = "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5";

/** Adds or changes one calendar entry. Only the administrator sees this. */
export function EventDialog({ classes, today, event, onClose }: { classes: CalendarView["classes"]; today: string; event: CalendarEvent | null; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState<CalendarEventInput>(
    event ?? { kind: "event", title: "", startsOn: today, endsOn: today, startTime: null, endTime: null, place: "", note: "", audience: "school", levels: [], classIds: [] },
  );
  const set = (patch: Partial<CalendarEventInput>) => {
    setError("");
    setF((x) => ({ ...x, ...patch }));
  };
  const allDay = f.startTime === null;
  const audience: CalendarAudience = f.kind === "closure" ? "school" : f.audience;
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, audience, endsOn: f.endsOn < f.startsOn ? f.startsOn : f.endsOn };
    const err = event ? await adminSend("PUT", `/calendar/events/${event.id}`, body) : await adminSend("POST", "/calendar/events", body);
    setBusy(false);
    if (err) return setError(err);
    const whom = audience === "school" ? "the whole school" : audience === "levels" ? f.levels.join(" and ") : f.classIds.map((id) => classes.find((k) => k.id === id)?.name).join(", ");
    toast.success(event ? `“${f.title.trim()}” saved.` : `“${f.title.trim()}” added for ${whom} on ${shortDate(body.startsOn)}.`);
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!event) return;
    const err = await adminSend("DELETE", `/calendar/events/${event.id}`);
    if (err) return void toast.error(err);
    toast.success(`“${event.title}” removed.`);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader className="sr-only">
            <DialogTitle>{event ? "Change this entry" : "Add to the calendar"}</DialogTitle>
            <DialogDescription>Staff see it in the app and in their own calendar.</DialogDescription>
          </DialogHeader>

          {/* Title first and largest, like a calendar app; every row below lines up with it. */}
          <div className={ROW}>
            <span aria-hidden />
            <div className="grid gap-3">
              <input
                id="ev-title"
                aria-label="Title"
                value={f.title}
                onChange={(e) => set({ title: e.target.value })}
                maxLength={120}
                required
                autoFocus={!event}
                placeholder="Add title"
                className="w-full border-0 border-b-2 border-border bg-transparent pb-1.5 font-heading text-2xl font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-primary"
              />
              <div role="radiogroup" aria-label="What is it?" className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    role="radio"
                    aria-checked={f.kind === k.key}
                    title={k.hint}
                    onClick={() => set({ kind: k.key })}
                    className={cn("rounded-md px-3 py-1.5 text-sm font-semibold transition-colors", f.kind === k.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{KINDS.find((k) => k.key === f.kind)?.hint}</p>
            </div>
          </div>

          <div className={ROW}>
            <Clock className={ICON} aria-hidden />
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Label className="grid gap-1 text-xs font-normal text-muted-foreground">
                  {f.startsOn === f.endsOn ? "Date" : "From"}
                  <Input type="date" value={f.startsOn} required onChange={(e) => set({ startsOn: e.target.value, endsOn: f.endsOn < e.target.value || f.endsOn === f.startsOn ? e.target.value : f.endsOn })} />
                </Label>
                <Label className="grid gap-1 text-xs font-normal text-muted-foreground">
                  Until
                  <Input type="date" value={f.endsOn} min={f.startsOn} required onChange={(e) => set({ endsOn: e.target.value })} />
                </Label>
              </div>
              {!allDay && (
                <div className="grid grid-cols-2 gap-2">
                  <Label className="grid gap-1 text-xs font-normal text-muted-foreground">
                    Starts
                    <Input type="time" value={f.startTime ?? ""} required onChange={(e) => set({ startTime: e.target.value })} />
                  </Label>
                  <Label className="grid gap-1 text-xs font-normal text-muted-foreground">
                    Ends
                    <Input type="time" value={f.endTime ?? ""} required onChange={(e) => set({ endTime: e.target.value })} />
                  </Label>
                </div>
              )}
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox checked={allDay} onCheckedChange={(v) => set(v === true ? { startTime: null, endTime: null } : { startTime: "09:00", endTime: "10:00" })} />
                All day
              </Label>
            </div>
          </div>

          <div className={ROW}>
            <Users className={ICON} aria-hidden />
            <div className="grid gap-2">
              {f.kind === "closure" ? (
                <p className="pt-1.5 text-sm text-muted-foreground">The whole school. On these days no class shows its usual hours.</p>
              ) : (
                <>
                  <select aria-label="Who is it for?" className={SELECT} value={f.audience} onChange={(e) => set({ audience: e.target.value as CalendarAudience })}>
                    <option value="school">Whole school</option>
                    <option value="levels">Some levels</option>
                    <option value="classes">Some classes</option>
                  </select>
                  {f.audience === "levels" && (
                    <div className="flex flex-wrap gap-2">
                      {CLASS_LEVELS.map((l) => (
                        <Label key={l.key} className={cn(CHOICE, "items-center py-1.5")}>
                          <Checkbox checked={f.levels.includes(l.key)} onCheckedChange={(v) => set({ levels: toggle<ClassLevel>(f.levels, l.key, v === true) })} />
                          {l.key}
                        </Label>
                      ))}
                    </div>
                  )}
                  {f.audience === "classes" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {classes.length === 0 && <p className="text-sm text-muted-foreground">There are no classes yet.</p>}
                      {classes.map((k) => (
                        <Label key={k.id} className={cn(CHOICE, "items-center py-1.5")}>
                          <Checkbox checked={f.classIds.includes(k.id)} onCheckedChange={(v) => set({ classIds: toggle(f.classIds, k.id, v === true) })} />
                          {k.name}
                        </Label>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={ROW}>
            <MapPin className={ICON} aria-hidden />
            <Input aria-label="Place" value={f.place} maxLength={120} onChange={(e) => set({ place: e.target.value })} placeholder="Add place" />
          </div>

          <div className={ROW}>
            <AlignLeft className={ICON} aria-hidden />
            <div className="grid gap-1">
              <Textarea aria-label="Description" rows={3} value={f.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="Add description, e.g. Bring a hat and water bottle." />
              <p className="text-xs text-muted-foreground">Teachers see this in the app and in their own calendar. Please don’t put a child’s name here.</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {event ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-muted-foreground hover:text-destructive">
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove “{event.title}”?</AlertDialogTitle>
                    <AlertDialogDescription>It disappears from the app and from everyone’s linked calendar the next time it refreshes.</AlertDialogDescription>
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
              <Button disabled={busy}>{event ? "Save" : "Add"}</Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** What a teacher sees on clicking a calendar entry: the same rows as the administrator's form, read only. */
export function EventDetails({ event, classes, onClose }: { event: CalendarEvent; classes: CalendarView["classes"]; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <div className="grid gap-4">
          <div className={ROW}>
            <span className={cn("mt-2.5 size-3.5 justify-self-center rounded", event.kind === "event" ? "bg-primary" : event.kind === "deadline" ? "bg-warn" : "bg-muted-foreground")} aria-hidden />
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-2xl font-semibold leading-tight">{event.title}</DialogTitle>
              <DialogDescription>{KIND_LABEL[event.kind]}</DialogDescription>
            </DialogHeader>
          </div>
          <div className={ROW}>
            <Clock className={ICON} aria-hidden />
            <p className="pt-0.5">{whenText(event)}{event.startTime ? "" : " · all day"}</p>
          </div>
          <div className={ROW}>
            <Users className={ICON} aria-hidden />
            <p className="pt-0.5">{forWhom(event, classes)}</p>
          </div>
          {event.place && (
            <div className={ROW}>
              <MapPin className={ICON} aria-hidden />
              <p className="pt-0.5">{event.place}</p>
            </div>
          )}
          {event.note && (
            <div className={ROW}>
              <AlignLeft className={ICON} aria-hidden />
              <p className="whitespace-pre-line pt-0.5">{event.note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
