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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function Swatches({ value, onChange }: { value: SubjectColor; onChange: (c: SubjectColor) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
      {SUBJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn("size-7 rounded-full border-2 border-transparent", value === c && "border-foreground")}
          style={{ background: SUBJECT_SWATCH[c] }}
        />
      ))}
    </div>
  );
}

function SubjectRow({ s, uses }: { s: Subject; uses: number }) {
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
      <Card className={cn("gap-3 px-5 py-4 shadow-none", !s.active && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-md border px-2.5 py-1 text-sm font-semibold", SUBJECT_TINT[f.color])}>{f.name || "Subject"}</span>
          {!s.active && <Badge variant="secondary">Hidden</Badge>}
          <span className="text-sm text-muted-foreground">{uses ? `${uses} ${uses === 1 ? "lesson" : "lessons"} on timetables` : "Not on a timetable"}</span>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`sn-${s.id}`}>Name</Label>
          <Input id={`sn-${s.id}`} value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <Swatches value={f.color} onChange={(c) => setF({ ...f, color: c })} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || !dirty || !f.name.trim()} onClick={() => save()}>
            Save
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ active: !s.active }, s.active ? `${s.name} is hidden. It stays on today’s timetables but cannot be added to new lessons.` : `${s.name} can be added to lessons again.`)}>
            {s.active ? "Hide" : "Show again"}
          </Button>
          {uses === 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {s.name}?</AlertDialogTitle>
                  <AlertDialogDescription>It is on no timetable, so nothing else changes.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={async () => {
                      const err = await adminSend("DELETE", `/subjects/${s.id}`);
                      if (err) return void toast.error(err);
                      toast.success(`${s.name} removed.`);
                      router.refresh();
                    }}
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </Card>
    </li>
  );
}

export function SubjectsEditor({ view }: { view: SubjectsView }) {
  const router = useRouter();
  const [f, setF] = useState<{ name: string; color: SubjectColor }>({ name: "", color: "lilac" });
  return (
    <div className="grid max-w-3xl gap-6">
      <ul className="grid gap-3">
        {view.subjects.map((s) => (
          <SubjectRow key={s.id} s={s} uses={view.inUse[s.id] ?? 0} />
        ))}
      </ul>
      <Card className="gap-3 px-5 py-4 shadow-none">
        <p className="font-heading text-lg font-semibold">Add a subject</p>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const err = await adminSend("POST", "/subjects", f);
            if (err) return void toast.error(err);
            toast.success(`${f.name.trim()} added. Add it to a class on the Timetable page.`);
            setF({ name: "", color: "lilac" });
            router.refresh();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="ns-name">Name</Label>
            <Input id="ns-name" value={f.name} maxLength={60} required placeholder="e.g. Music" onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <Swatches value={f.color} onChange={(c) => setF({ ...f, color: c })} />
          <Button className="justify-self-start" disabled={!f.name.trim()}>
            Add subject
          </Button>
        </form>
      </Card>
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
