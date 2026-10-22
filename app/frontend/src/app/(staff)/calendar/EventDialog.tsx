"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CalendarAudience, CalendarEvent, CalendarEventInput, CalendarKind, CalendarView, ClassLevel } from "@peterhouse/shared";
import { CLASS_LEVELS } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { shortDate } from "@/lib/calendar";
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{event ? "Change this entry" : "Add to the calendar"}</DialogTitle>
            <DialogDescription>Staff see it in the app and in their own calendar. Please don’t put a child’s name here.</DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">What is it?</legend>
            {KINDS.map((k) => (
              <Label key={k.key} className={CHOICE}>
                <input type="radio" name="kind" className="mt-1 accent-[var(--primary)]" checked={f.kind === k.key} onChange={() => set({ kind: k.key })} data-state={f.kind === k.key ? "checked" : "unchecked"} />
                <span>
                  <span className="font-semibold">{k.label}</span>
                  <span className="block text-xs text-muted-foreground">{k.hint}</span>
                </span>
              </Label>
            ))}
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor="ev-title">Title</Label>
            <Input id="ev-title" value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} required placeholder={f.kind === "closure" ? "e.g. Deepavali" : f.kind === "deadline" ? "e.g. December reports" : "e.g. Science Centre trip"} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ev-from">{f.startsOn === f.endsOn ? "Date" : "From"}</Label>
              <Input id="ev-from" type="date" value={f.startsOn} required onChange={(e) => set({ startsOn: e.target.value, endsOn: f.endsOn < e.target.value || f.endsOn === f.startsOn ? e.target.value : f.endsOn })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-to">Until</Label>
              <Input id="ev-to" type="date" value={f.endsOn} min={f.startsOn} required onChange={(e) => set({ endsOn: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked={allDay} onCheckedChange={(v) => set(v === true ? { startTime: null, endTime: null } : { startTime: "09:00", endTime: "10:00" })} />
              All day
            </Label>
            {!allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="ev-start">Starts</Label>
                  <Input id="ev-start" type="time" value={f.startTime ?? ""} required onChange={(e) => set({ startTime: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ev-end">Ends</Label>
                  <Input id="ev-end" type="time" value={f.endTime ?? ""} required onChange={(e) => set({ endTime: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ev-for">Who is it for?</Label>
            {f.kind === "closure" ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">The whole school. On these days no class shows its usual hours.</p>
            ) : (
              <>
                <select id="ev-for" className={SELECT} value={f.audience} onChange={(e) => set({ audience: e.target.value as CalendarAudience })}>
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

          <div className="grid gap-2">
            <Label htmlFor="ev-place">
              Place <span className="font-normal text-muted-foreground">optional</span>
            </Label>
            <Input id="ev-place" value={f.place} maxLength={120} onChange={(e) => set({ place: e.target.value })} placeholder="e.g. School hall" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ev-note">
              Note <span className="font-normal text-muted-foreground">optional</span>
            </Label>
            <Textarea id="ev-note" rows={2} value={f.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Bring a hat and water bottle." />
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
