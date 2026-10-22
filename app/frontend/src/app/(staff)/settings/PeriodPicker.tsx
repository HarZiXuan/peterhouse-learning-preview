"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { openPeriodAction } from "../actions";

export type PeriodOption = { year: number; semester: 1 | 2; state: "now" | "exists" | "new" | "none" };

const RANGE = { 1: "January – June", 2: "July – December" } as const;
const REPORT = { 1: "June", 2: "December" } as const;

/** Every year with its two semesters. Pick one, then confirm. Semesters that do not exist yet (apart from the next one) cannot be picked. */
export function PeriodPicker({ options }: { options: PeriodOption[] }) {
  const now = options.find((o) => o.state === "now");
  const [picked, setPicked] = useState<PeriodOption | null>(null);
  const [busy, setBusy] = useState(false);
  const years = [...new Set(options.map((o) => o.year))].sort((a, b) => b - a);
  const label = (o: PeriodOption) => `Semester ${o.semester} ${o.year}`;

  return (
    <div className="grid gap-4">
      {years.map((year) => (
        <div key={year} className="grid gap-2">
          <h3 className="font-heading text-lg">{year}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {([1, 2] as const).map((semester) => {
              const o = options.find((x) => x.year === year && x.semester === semester)!;
              const disabled = o.state === "none";
              const on = o.state === "now";
              return (
                <button
                  key={semester}
                  type="button"
                  disabled={disabled || on}
                  onClick={() => setPicked(o)}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
                    on ? "border-primary bg-primary/5" : disabled ? "border-dashed opacity-50" : "hover:border-foreground/40 hover:bg-muted/50",
                  )}
                >
                  <span className="grid gap-0.5">
                    <span className="font-semibold">Semester {semester}</span>
                    <span className="text-sm text-muted-foreground">{RANGE[semester]}</span>
                    <span className="text-xs text-muted-foreground">{REPORT[semester]} {year} reports</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold">
                    {on ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Check className="size-3.5" aria-hidden /> Now
                      </span>
                    ) : o.state === "new" ? (
                      <span className="text-muted-foreground">Start</span>
                    ) : o.state === "none" ? (
                      <span className="text-muted-foreground">Not yet</span>
                    ) : (
                      <span className="text-muted-foreground">Open</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <AlertDialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{picked && (picked.state === "new" ? `Start ${label(picked)}?` : `Switch to ${label(picked)}?`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {picked &&
                (picked.state === "new" && now && picked.year * 2 + picked.semester < now.year * 2 + now.semester
                  ? `${label(picked)} is created with the same classes, teachers and children as your earliest semester, each with an empty report to fill in. ${label(now)} closes and keeps all its reports.`
                  : picked.state === "new"
                  ? `${now ? label(now) : "This semester"} closes and keeps all its reports. Every child gets a new report for ${label(picked)}, with the earlier ratings beside it.${picked.year !== now?.year ? " It is a new year, so every class moves up a level and K2 children are marked as left." : ""}`
                  : `Teachers will write for ${label(picked)}. ${now ? label(now) : "The current semester"} closes and keeps all its reports; nothing is deleted. You can switch back at any time.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                if (!picked) return;
                setBusy(true);
                void openPeriodAction(picked.semester, picked.year).finally(() => setBusy(false));
              }}
            >
              {picked?.state === "new" ? "Start" : "Switch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
