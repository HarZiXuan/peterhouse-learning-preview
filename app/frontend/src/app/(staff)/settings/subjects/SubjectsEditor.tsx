"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Subject, SubjectColor, SubjectsView } from "@peterhouse/shared";
import { SUBJECT_COLORS } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { SUBJECT_SWATCH, SUBJECT_TINT } from "@/lib/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** One colour button; it opens the colours no other subject has, so a used colour is never offered. */
function ColourPicker({ value, taken, onChange }: { value: SubjectColor; taken: Set<string>; onChange: (c: SubjectColor) => void }) {
  const [open, setOpen] = useState(false);
  const free = SUBJECT_COLORS.filter((c) => c === value || !taken.has(c));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-2 justify-self-start rounded-md border bg-background px-2.5 py-1.5 text-sm font-semibold hover:bg-secondary" aria-label="Colour">
          <span className="size-5 rounded-full" style={{ background: SUBJECT_SWATCH[value] }} aria-hidden />
          Colour
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Colour">
          {free.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={value === c}
              aria-label={c}
              title={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={cn("size-7 rounded-full ring-offset-2 ring-offset-background", value === c && "ring-2 ring-foreground")}
              style={{ background: SUBJECT_SWATCH[c] }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SubjectRow({ s, uses, taken }: { s: Subject; uses: number; taken: Set<string> }) {
  const router = useRouter();
  const [f, setF] = useState({ name: s.name, color: s.color });
  const [busy, setBusy] = useState(false);
  const dirty = f.name !== s.name || f.color !== s.color;
  const save = async (patch: Partial<Subject> = {}, ok = `${f.name.trim()} saved.`) => {
    setBusy(true);
    const err = await adminSend("PUT", `/subjects/${s.id}`, { ...f, active: s.active, ...patch });
    setBusy(false);
    if (err) return void toast.error(err);
    toast.success(ok);
    router.refresh();
  };
  return (
    <li>
      <Card className="gap-3 px-5 py-4 shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-md border px-2.5 py-1 text-sm font-semibold", SUBJECT_TINT[f.color])}>{f.name || "Subject"}</span>
          <span className="text-sm text-muted-foreground">{uses ? `${uses} ${uses === 1 ? "lesson" : "lessons"} on timetables` : "Not on a timetable"}</span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`sn-${s.id}`}>Name</Label>
          <Input id={`sn-${s.id}`} value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <ColourPicker value={f.color} taken={taken} onChange={(c) => setF({ ...f, color: c })} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || !dirty || !f.name.trim()} onClick={() => save()}>
            Save
          </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {s.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {uses
                      ? `Its ${uses} ${uses === 1 ? "lesson is" : "lessons are"} taken off every class’s timetable, and teachers are no longer tagged with it. This cannot be undone.`
                      : "It is on no timetable. Teachers tagged with it are no longer tagged. This cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={async () => {
                      const err = await adminSend("DELETE", `/subjects/${s.id}`);
                      if (err) return void toast.error(err);
                      toast.success(`${s.name} deleted.`);
                      router.refresh();
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </Card>
    </li>
  );
}

/** The "Add subject" button at the top of the page, and the dialog it opens. */
export function AddSubject({ view }: { view: SubjectsView }) {
  const router = useRouter();
  const taken = new Set(view.subjects.map((s) => s.color));
  const firstFree = () => SUBJECT_COLORS.find((c) => !taken.has(c)) ?? SUBJECT_COLORS[0];
  const allTaken = SUBJECT_COLORS.every((c) => taken.has(c));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<{ name: string; color: SubjectColor }>({ name: "", color: firstFree() });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setF({ name: "", color: firstFree() });
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Add subject
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const err = await adminSend("POST", "/subjects", f);
            setBusy(false);
            if (err) return void toast.error(err);
            toast.success(`${f.name.trim()} added. Add it to a class on the Timetable page.`);
            setOpen(false);
            router.refresh();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a subject</DialogTitle>
            <DialogDescription>Give it a name and its own colour. Lessons are set on each class’s week in Timetable.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="ns-name">Name</Label>
            <Input id="ns-name" value={f.name} maxLength={60} required autoFocus placeholder="e.g. Music" onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          {allTaken ? (
            <p className="text-sm text-muted-foreground">Every colour is in use. Delete a subject or change one first.</p>
          ) : (
            <div className="flex items-center gap-3">
              <ColourPicker value={f.color} taken={taken} onChange={(c) => setF({ ...f, color: c })} />
              {f.name.trim() && <span className={cn("rounded-md border px-2.5 py-1 text-sm font-semibold", SUBJECT_TINT[f.color])}>{f.name.trim()}</span>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !f.name.trim() || allTaken}>Add subject</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SubjectsEditor({ view }: { view: SubjectsView }) {
  const taken = new Set(view.subjects.map((s) => s.color));
  return (
    <div className="grid max-w-3xl gap-6">
      <ul className="grid gap-3">
        {view.subjects.map((s) => (
          <SubjectRow key={s.id} s={s} uses={view.inUse[s.id] ?? 0} taken={taken} />
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Lessons are set on each class’s week in{" "}
        <Link href="/timetable" className="underline underline-offset-4">
          Timetable
        </Link>
        .
      </p>
    </div>
  );
}
