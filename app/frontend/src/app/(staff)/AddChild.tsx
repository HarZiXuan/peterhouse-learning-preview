"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { ClassSummary, Guardian } from "@peterhouse/shared";
import { LEVEL_PROBLEM_TEXT, birthdayRange, classLevel, levelForBirthday } from "@peterhouse/shared";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { guardiansPhoneProblem } from "@/lib/phone";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const BLANK_GUARDIAN: Guardian = { name: "", relationship: "", phone: "", email: "" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());

/** A titled part of the form, laid out like the sections of a child's profile. */
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <legend className="float-left w-full">
        <span className="font-heading text-base font-semibold">{title}</span>
        {hint && <span className="ml-2 text-sm font-normal text-muted-foreground">{hint}</span>}
      </legend>
      <div className="clear-both grid gap-4">{children}</div>
    </fieldset>
  );
}

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
  const [joinedOn, setJoinedOn] = useState(today);
  const [guardians, setGuardians] = useState<Guardian[]>([BLANK_GUARDIAN]);
  const setGuardian = (i: number, patch: Partial<Guardian>) => setGuardians((gs) => gs.map((g, n) => (n === i ? { ...g, ...patch } : g)));

  const found = levelForBirthday(dob, year);
  const level = "level" in found ? found.level : null;
  const ofLevel = classes.filter((k) => k.level === level);
  // Only a class the administrator picked (or the one this dialog was opened from) counts, and only if it fits the level.
  const chosen = ofLevel.find((k) => k.id === picked) ?? null;
  const fixed = classes.find((k) => k.id === fixedClass) ?? null;
  // The picker only offers birthdays that fit a class: the one this was opened from, else any level that has a class.
  const range = birthdayRange(year, fixed ? [fixed.level] : [...new Set(classes.map((k) => k.level))]);

  function reset(o: boolean) {
    setOpen(o);
    setError("");
    if (!o) {
      setDob("");
      setPicked(fixedClass ?? null);
      setJoinedOn(today());
      setGuardians([BLANK_GUARDIAN]);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const firstName = String(f.get("firstName") ?? "").trim();
    const lastName = String(f.get("lastName") ?? "").trim();
    if (!firstName || !lastName) return setError("Please type the child’s first and last name.");
    if (!dob) return setError("Please enter their birthday: it sets their level.");
    if (!level) return setError("This child does not fit any level this year.");
    if (ofLevel.length === 0) return setError(`There is no ${level} class yet. Create one on the Classes page first.`);
    if (!chosen) return setError("Please choose which class this child joins.");
    const badPhone = guardiansPhoneProblem(guardians);
    if (badPhone) return setError(badPhone);
    setBusy(true);
    const res = await fetch("/api/admin/children", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        chineseName: String(f.get("chineseName") ?? "").trim(),
        pronoun: String(f.get("pronoun") ?? "she"),
        dateOfBirth: dob,
        classId: chosen.id,
        joinedOn: joinedOn || today(),
        guardians: guardians.filter((g) => g.name.trim() || g.phone.trim() || g.email.trim()),
        notes: String(f.get("notes") ?? "").trim(),
        photoConsent: f.get("photoConsent") === "on",
      }),
    });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work.");
    toast.success(`${firstName} ${lastName} is in ${chosen.name}.`);
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Add a child</DialogTitle>
            <DialogDescription>Their birthday sets their level ({year}); you choose which class of that level they join. Parents and notes are optional and can be added later on their profile.</DialogDescription>
          </DialogHeader>

          <Section title="About the child">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="child-first">First name</Label>
                <Input id="child-first" name="firstName" placeholder="e.g. Mia" autoComplete="off" maxLength={80} onChange={() => setError("")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="child-last">Last name</Label>
                <Input id="child-last" name="lastName" placeholder="e.g. Tan" autoComplete="off" maxLength={80} onChange={() => setError("")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="child-zh">
                  Chinese name <span className="font-normal text-muted-foreground">optional</span>
                </Label>
                <Input id="child-zh" name="chineseName" autoComplete="off" maxLength={40} lang="zh" placeholder="e.g. 陈美雅" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="child-dob">Birthday</Label>
                <Input
                  id="child-dob"
                  type="date"
                  value={dob}
                  min={range.min}
                  max={range.max}
                  required
                  onChange={(e) => {
                    setDob(e.target.value);
                    setError("");
                  }}
                />
              </div>
            </div>
            <p className={cn("-mt-2 text-xs", dob && !level ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
              {level
                ? `Turns ${classLevel(level).turns} in ${year}, so ${level} (${classLevel(level).name}).`
                : "problem" in found && dob
                  ? `${LEVEL_PROBLEM_TEXT[found.problem]}, so they cannot join a class.`
                  : `Born ${range.from === range.to ? range.from : `${range.from} to ${range.to}`} for ${fixed ? `${fixed.name}` : "the classes you have"}. A child can only join a class of their own level.`}
            </p>

            <div className="grid gap-2">
              <Label>
                Pronouns <span className="font-normal text-muted-foreground">used when writing the report</span>
              </Label>
              <RadioGroup name="pronoun" defaultValue="she" className="grid grid-cols-2 gap-2">
                {[
                  ["she", "she / her"],
                  ["he", "he / him"],
                ].map(([v, l]) => (
                  <Label key={v} htmlFor={`pn-${v}`} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5")}>
                    <RadioGroupItem id={`pn-${v}`} value={v} />
                    {l}
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </Section>

          <Section title="At school">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="child-class">Class</Label>
                {!level ? (
                  <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">Enter the birthday first: it shows the classes for their level.</p>
                ) : ofLevel.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">There is no {level} class yet. Create one on the Classes page first.</p>
                ) : (
                  <select
                    id="child-class"
                    className={SELECT}
                    value={chosen?.id ?? ""}
                    onChange={(e) => {
                      setPicked(e.target.value ? Number(e.target.value) : null);
                      setError("");
                    }}
                  >
                    <option value="">Choose a class…</option>
                    {ofLevel.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} · {k.children} {k.children === 1 ? "child" : "children"}
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
              <div className="grid gap-2">
                <Label htmlFor="child-joined">First day at school</Label>
                <Input id="child-joined" type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />
              </div>
            </div>
            <Label htmlFor="child-consent" className="flex items-start gap-2 text-sm font-normal">
              <Checkbox id="child-consent" name="photoConsent" className="mt-0.5" />
              <span>
                <span className="font-semibold">Parents gave photo consent.</span> Without it, teachers cannot add photos and none print on the report.
              </span>
            </Label>
          </Section>

          <Section title="Parents and guardians" hint="optional">
            {guardians.map((g, i) => (
              <div key={i} className="grid gap-2 rounded-xl border bg-card p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input aria-label="Name" placeholder="Name" value={g.name} onChange={(e) => setGuardian(i, { name: e.target.value })} maxLength={100} />
                  <Input aria-label="Relationship" placeholder="Mother, father, grandmother…" value={g.relationship} onChange={(e) => setGuardian(i, { relationship: e.target.value })} maxLength={40} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${g.name || "this person"}`} onClick={() => setGuardians((gs) => (gs.length > 1 ? gs.filter((_, n) => n !== i) : [BLANK_GUARDIAN]))}>
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <PhoneInput label={`Phone of ${g.name || "this person"}`} value={g.phone} onChange={(phone) => setGuardian(i, { phone })} />
                  <Input aria-label="Email" placeholder="Email" type="email" value={g.email} onChange={(e) => setGuardian(i, { email: e.target.value })} maxLength={200} />
                </div>
              </div>
            ))}
            {guardians.length < 6 && (
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setGuardians((gs) => [...gs, BLANK_GUARDIAN])}>
                <Plus /> Add a parent or guardian
              </Button>
            )}
          </Section>

          <Section title="Staff notes" hint="optional">
            <div className="grid gap-2">
              <Label htmlFor="child-notes" className="sr-only">
                Staff notes
              </Label>
              <Textarea id="child-notes" name="notes" rows={3} maxLength={4000} placeholder="Pickup arrangements, or anything staff should know." />
            </div>
          </Section>

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
            <Button disabled={busy}>{busy ? "Adding…" : "Add child"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
