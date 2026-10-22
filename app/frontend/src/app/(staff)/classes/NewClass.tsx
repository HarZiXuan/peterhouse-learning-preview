"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CLASS_LEVELS, classLevel, nextLevel, type ClassLevel } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { LEVEL_TINT } from "./shared";

/** Creates a class, or (with `existing`) renames one or changes its level. */
export function NewClass({
  existing,
  defaultLevel,
  placeholder,
  placeholderClass,
  placeholderLabel,
  year,
  dialog,
}: {
  existing?: { id: number; name: string; level: ClassLevel; empty: boolean };
  defaultLevel?: ClassLevel;
  /** A dashed tile for an empty level group instead of the toolbar button. */
  placeholder?: boolean;
  /** How the dashed tile looks and what it says, for a level's column on the Classes page. */
  placeholderClass?: string;
  placeholderLabel?: string;
  /** This semester's year, to say which birth year the level takes. */
  year?: number;
  /** Open and close it from outside (a menu item) instead of its own button. */
  dialog?: { open: boolean; onOpenChange: (open: boolean) => void };
}) {
  const router = useRouter();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = dialog ? dialog.open : ownOpen;
  const setOpen = dialog ? dialog.onOpenChange : setOwnOpen;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState<ClassLevel>(existing?.level ?? defaultLevel ?? "K1");
  const [name, setName] = useState(existing?.name ?? "");
  const locked = !!existing && !existing.empty;
  const lv = classLevel(level);
  const next = nextLevel(level);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = { name, level };
    const res = existing ? await adminSend("PATCH", `/classes/${existing.id}`, body) : await adminSend("POST", "/classes", body);
    setBusy(false);
    if (res) return setError(res);
    toast.success(existing ? "Saved." : `${name.trim()} is ready. Add its teachers and children next.`);
    setOpen(false);
    if (!existing) setName("");
    router.refresh();
  }

  function pick(v: string) {
    const nextKey = v as ClassLevel;
    // Keep the level at the front of the name in step with the level.
    if (name === level || name.startsWith(`${level} `)) setName(nextKey + name.slice(level.length));
    setLevel(nextKey);
  }

  const startsWithLevel = name.startsWith(`${level} `) && name.length > level.length + 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setError("");
      }}
    >
      {!dialog && (
        <DialogTrigger asChild>
          {existing ? (
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Icon name="edit" size={14} /> Rename class
            </Button>
          ) : placeholder ? (
            <button type="button" className={cn("flex min-h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-semibold text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-card hover:text-foreground", placeholderClass)}>
              <Icon name="plus" size={16} stroke={2} /> {placeholderLabel ?? `Add a ${defaultLevel} class`}
            </button>
          ) : (
            <Button size="lg">
              <Icon name="plus" size={16} stroke={2} /> New class
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{existing ? "Rename class" : "New class"}</DialogTitle>
            <DialogDescription>{existing ? "The new name shows on every report from this class." : "Choose the level first. The name follows it, so the class moves up neatly each year."}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label id="class-level-label">Level</Label>
            <RadioGroup aria-labelledby="class-level-label" value={level} onValueChange={pick} disabled={locked} className="grid grid-cols-5 gap-2">
              {CLASS_LEVELS.map((l) => (
                <Label
                  key={l.key}
                  htmlFor={`lv-${l.key}`}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-xs font-normal text-muted-foreground transition-colors hover:bg-secondary/60",
                    "has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:font-semibold has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-foreground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                    locked && "cursor-not-allowed opacity-60",
                  )}
                >
                  <RadioGroupItem id={`lv-${l.key}`} value={l.key} className="sr-only" />
                  <span className={cn("grid size-10 place-items-center rounded-xl font-heading text-[15px] font-semibold", LEVEL_TINT[l.key])}>{l.key}</span>
                  turns {l.turns}
                </Label>
              ))}
            </RadioGroup>
            <p className="text-sm text-muted-foreground">
              {lv.name}
              {year ? ` · children born in ${year - lv.turns}` : ""}
            </p>
            {locked && <p className="text-xs text-muted-foreground">The level can only change while the class has no children.</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="class-name">Name</Label>
            <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${level} Sunflower`} maxLength={80} required autoComplete="off" className="h-11 text-base" />
            <p className="text-xs text-muted-foreground">
              {startsWithLevel && next ? `Next year ${name} becomes ${next}${name.slice(level.length)}.` : `Start it with the level, so “${level} Sunflower” becomes “${next ?? level} Sunflower” next year.`}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={busy}>{existing ? "Save" : "Create class"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
