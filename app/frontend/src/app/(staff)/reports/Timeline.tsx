import Link from "next/link";
import type { PeriodSummary, Season } from "@peterhouse/shared";
import { semesterLabel } from "@peterhouse/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SEASONS: Season[] = ["June", "December"];

/**
 * Every report period, a row per year with its June and December side by side, newest year first.
 * Each period shows how far its reports got; the one on view has a ring.
 */
export function Timeline({ periods, selected, teacher = false }: { periods: PeriodSummary[]; selected: number; teacher?: boolean }) {
  const years = [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a);
  return (
    <Card className="mb-6 gap-0 divide-y overflow-hidden p-0 shadow-none" aria-label="Report periods">
      {years.map((year) => (
        <div key={year} className="grid items-stretch gap-3 p-3 sm:grid-cols-[4.5rem_1fr_1fr] sm:items-center">
          <p className="font-heading text-xl font-bold tabular-nums text-muted-foreground sm:text-center">{year}</p>
          {SEASONS.map((season) => {
            const p = periods.find((x) => x.year === year && x.season === season);
            return p ? <Period key={season} p={p} on={p.termId === selected} teacher={teacher} /> : <Empty key={season} season={season} />;
          })}
        </div>
      ))}
    </Card>
  );
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
            {p.counts.not_submitted > 0 && <span>{p.counts.not_submitted} not sent</span>}
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
