"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PeriodSummary, Season } from "@peterhouse/shared";
import { semesterLabel } from "@peterhouse/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

const SEASONS: Season[] = ["June", "December"];

/**
 * Report periods, one row per year, newest first. A row opens to that year's June and December.
 * Only one year is open at a time: opening another year shows that year's reports.
 */
export function Timeline({ periods, selected, teacher = false }: { periods: PeriodSummary[]; selected: number; teacher?: boolean }) {
  const router = useRouter();
  const years = [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a);
  const selectedYear = periods.find((p) => p.termId === selected)?.year ?? null;
  const [openYear, setOpenYear] = useState<number | null>(selectedYear);

  // The address picks the year (a semester link, or Back). Opening a row updates the address too.
  const [shownYear, setShownYear] = useState(selectedYear);
  if (shownYear !== selectedYear) {
    setShownYear(selectedYear);
    setOpenYear(selectedYear);
  }

  function reveal(year: number) {
    setOpenYear(year);
    const inYear = periods.filter((p) => p.year === year);
    if (inYear.some((p) => p.termId === selected)) return;
    const target = inYear.find((p) => p.current) ?? inYear.find((p) => p.season === "December") ?? inYear[0];
    if (!target) return;
    router.push(target.current ? "/reports" : `/reports?term=${target.termId}`);
  }

  return (
    <Card className="mb-6 gap-0 divide-y overflow-hidden p-0 shadow-none" aria-label="Report periods">
      {years.map((year) => {
        const inYear = periods.filter((p) => p.year === year);
        const open = openYear === year;
        return (
          <Collapsible key={year} open={open} onOpenChange={(next) => (next ? reveal(year) : setOpenYear(null))} className="group/year">
            <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-3 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50">
              <span className="text-muted-foreground transition-transform group-data-[state=open]/year:rotate-180">
                <Icon name="down" size={18} />
              </span>
              <span className={cn("font-heading text-xl font-semibold tabular-nums", open ? "text-foreground" : "text-muted-foreground")}>{year}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground group-data-[state=open]/year:hidden">
                {SEASONS.map((season) => seasonBit(inYear.find((p) => p.season === season), season, teacher)).join(" · ")}
              </span>
              {inYear.some((p) => p.current) && <Badge className="group-data-[state=open]/year:hidden">Now</Badge>}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid items-stretch gap-3 px-3 pb-3 sm:grid-cols-2 sm:pl-12">
                {SEASONS.map((season) => {
                  const p = inYear.find((x) => x.season === season);
                  return p ? <Period key={season} p={p} on={p.termId === selected} teacher={teacher} /> : <Empty key={season} season={season} />;
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </Card>
  );
}

function seasonBit(p: PeriodSummary | undefined, season: Season, teacher: boolean) {
  if (!p || p.total === 0) return `${season} · no history`;
  const done = teacher ? p.total - p.counts.not_submitted - p.counts.changes : p.counts.approved;
  return `${season} ${done} of ${p.total}`;
}

function Period({ p, on, teacher }: { p: PeriodSummary; on: boolean; teacher: boolean }) {
  // A teacher's part is done once a report is sent; the administrator's once it is approved.
  const finished = teacher ? p.total - p.counts.not_submitted - p.counts.changes : p.counts.approved;
  const share = p.total ? finished / p.total : 0;
  const open = p.counts.waiting + p.counts.changes + p.counts.not_submitted;
  return (
    <Link
      href={p.current ? "/reports" : `/reports?term=${p.termId}`}
      aria-current={on ? "true" : undefined}
      className={cn(
        "block rounded-lg border bg-card p-3 outline-none transition-colors hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50",
        on && "border-primary ring-2 ring-primary/30",
      )}
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading text-base font-semibold">
          {p.season} <span className="font-normal text-muted-foreground">· {semesterLabel(p.season)}</span>
        </span>
        {p.current ? <Badge>Now</Badge> : <Badge variant="outline" className="font-normal">Past</Badge>}
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <span className="block h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
      </span>
      <span className="mt-2 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
        {teacher ? (
          <>
            <span className="font-semibold text-foreground">
              {finished} of {p.total} reports done
            </span>
            {p.counts.changes > 0 && <span>{p.counts.changes} to fix</span>}
            {p.counts.not_submitted > 0 && <span>{p.counts.not_submitted} {p.current ? "to write" : "not written"}</span>}
            {p.counts.changes + p.counts.not_submitted === 0 && p.total > 0 && <span>All done</span>}
          </>
        ) : (
          <>
            <span className="font-semibold text-foreground">
              {p.counts.approved} of {p.total} approved
            </span>
            {p.counts.waiting > 0 && <span>{p.counts.waiting} to review</span>}
            {p.counts.changes > 0 && <span>{p.counts.changes} sent back</span>}
            {p.counts.not_submitted > 0 && <span>{p.counts.not_submitted} with teachers</span>}
            {open === 0 && p.total > 0 && <span>All done</span>}
          </>
        )}
      </span>
    </Link>
  );
}

function Empty({ season }: { season: Season }) {
  return (
    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      <span className="font-heading text-base font-semibold">{season}</span> · no history
    </div>
  );
}
