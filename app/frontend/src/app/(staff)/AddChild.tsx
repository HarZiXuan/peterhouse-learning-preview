"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ClassSummary } from "@peterhouse/shared";
import { LEVEL_PROBLEM_TEXT, classLevel, levelForBirthday } from "@peterhouse/shared";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export const SELECT = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

/**
 * The administrator's "Add a child" dialog. The level comes from the birthday (the age the child turns this year),
 * and only that level's classes can be chosen: a child is never placed in a class of another age group.
 */
export function AddChild({
  classes,
  year,
  classId: fixedClass,
  label = "Add a child",
  className,
  variant = "default",
  icon = false,
  dialog,
}: {
  classes: ClassSummary[];
  year: number;
  /** Add straight into this class (from the class's own page). */
  classId?: number;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  icon?: boolean;
  /** Open and close it from outside (a menu item) instead of its own button. */
  dialog?: { open: boolean; onOpenChange: (open: boolean) => void };
}) {
  const router = useRouter();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = dialog ? dialog.open : ownOpen;
  const setOpen = dialog ? dialog.onOpenChange : setOwnOpen;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dob, setDob] = useState("");
  const [picked, setPicked] = useState<number | null>(fixedClass ?? null);

  const found = levelForBirthday(dob, year);
  const level = "level" in found ? found.level : null;
  const ofLevel = classes.filter((k) => k.level === level);
  // The class this dialog was opened from, when the child's level fits it; else the first class of their level.
  const chosen = ofLevel.find((k) => k.id === picked) ?? ofLevel[0] ?? null;
  const fixed = classes.find((k) => k.id === fixedClass) ?? null;

  function reset(o: boolean) {
    setOpen(o);
    setError("");
    if (!o) {
      setDob("");
      setPicked(fixedClass ?? null);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return setError("Please type the child’s name.");
    if (!dob) return setError("Please enter their birthday: it sets their level.");
    if (!level) return setError("This child does not fit any level this year.");
    if (!chosen) return setError(`There is no ${level} class yet. Create one on the Classes page first.`);
    setBusy(true);
    const res = await fetch("/api/admin/children", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, chineseName: String(f.get("chineseName") ?? "").trim(), pronoun: String(f.get("pronoun") ?? "she"), dateOfBirth: dob, classId: chosen.id }),
    });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work.");
    toast.success(`${name} is in ${chosen.name}.`);
    reset(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      {!dialog && (
        <DialogTrigger asChild>
          <Button variant={variant} className={className} disabled={classes.length === 0} title={classes.length === 0 ? "Create a class first" : undefined}>
            {icon && <Icon name="plus" size={16} stroke={2} />}
            {label}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Add a child</DialogTitle>
            <DialogDescription>Their level comes from their birthday: the age they turn in {year}.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="child-name">First name</Label>
            <Input id="child-name" name="name" placeholder="e.g. Mia" autoComplete="off" maxLength={80} onChange={() => setError("")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="child-zh">
              Chinese name <span className="font-normal text-muted-foreground">optional</span>
            </Label>
            <Input id="child-zh" name="chineseName" autoComplete="off" maxLength={40} lang="zh" placeholder="e.g. 陈美雅" />
          </div>

          <div className="grid gap-2">
            <Label>Pronouns <span className="font-normal text-muted-foreground">used when writing the report</span></Label>
            <RadioGroup name="pronoun" defaultValue="she" className="grid grid-cols-3 gap-2">
              {[
                ["she", "she / her"],
                ["he", "he / him"],
                ["they", "they / them"],
              ].map(([v, l]) => (
                <Label key={v} htmlFor={`pn-${v}`} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5")}>
                  <RadioGroupItem id={`pn-${v}`} value={v} />
                  {l}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="child-dob">Birthday</Label>
            <Input
              id="child-dob"
              type="date"
              value={dob}
              required
              onChange={(e) => {
                setDob(e.target.value);
                setError("");
              }}
            />
            <p className={cn("text-xs", dob && !level ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
              {level
                ? `Turns ${classLevel(level).turns} in ${year}, so ${level} (${classLevel(level).name}).`
                : "problem" in found && dob
                  ? `${LEVEL_PROBLEM_TEXT[found.problem]}, so they cannot join a class.`
                  : "Sets their level. A child can only join a class of their own level."}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="child-class">Class</Label>
            {!level ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">Enter the birthday to see the classes for their level.</p>
            ) : ofLevel.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">There is no {level} class yet. Create one on the Classes page first.</p>
            ) : (
              <select id="child-class" className={SELECT} value={chosen?.id ?? ""} onChange={(e) => setPicked(Number(e.target.value))}>
                {ofLevel.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
            {fixed && level && fixed.level !== level && (
              <p className="text-xs text-destructive">
                By birthday this child is {level}, so they cannot join {fixed.name} ({fixed.level}).
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button disabled={busy}>{busy ? "Adding…" : "Add child"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
