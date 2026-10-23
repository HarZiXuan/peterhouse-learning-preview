"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import type { ChildListItem } from "@peterhouse/shared";
import { ChildAvatar, timeAgo } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SendNow } from "./SendNow";
import { STATE_RANK, STATE_TONE, myAreas, partOnly, partsLeft, ratedAreas, readyToSend, stateKey, stateLabel } from "./reportState";

/** How many learning areas are fully rated, as a ring with the count inside: blue while going, green when done. */
function AreaRing({ rated, total }: { rated: number; total: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const done = total > 0 && rated === total;
  return (
    <span className="relative inline-grid size-10 place-items-center" role="img" aria-label={`${rated} of ${total} areas rated`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={done ? "var(--status-approved)" : "var(--status-progress)"} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(total ? rated / total : 0) * c} ${c}`} />
      </svg>
      <span className="text-[10px] font-semibold tabular-nums">
        {rated}/{total}
      </span>
    </span>
  );
}

/** The one button that moves a child's report on, or nothing when there is nothing to do. */
function NextStep({ c, past }: { c: ChildListItem; past: boolean }) {
  const complete = c.answered === c.total;
  // An earlier semester can no longer be written: a report that was never written has nothing to open.
  const primary = partOnly(c)
    ? c.myParts.length && !past
      ? { href: `/child/${c.reviewId}`, label: partsLeft(c).length ? "Do my part" : "Open" }
      : null
    : c.hasReport
      ? { href: `/child/${c.reviewId}/report`, label: c.status === "changes_requested" && !past ? "Fix report" : "Open report" }
      : past
        ? null
        : { href: `/child/${c.reviewId}`, label: complete ? "Write report" : c.answered === 0 ? "Start" : "Continue" };
  if (readyToSend(c) && !past) return <SendNow reviewId={c.reviewId} childName={c.name} />;
  if (!primary) return null;
  const strong = (!c.hasReport && (complete || c.answered === 0)) || (c.status === "changes_requested" && !past);
  return (
    <Button asChild size="sm" variant={strong ? "default" : "outline"} className="min-w-28">
      <Link href={primary.href}>{primary.label}</Link>
    </Button>
  );
}

/** Every child of the teacher's classes in the semester on view, with how far each report is. */
export function ReportsTable({ list, showClass, past }: { list: ChildListItem[]; showClass: boolean; past: boolean }) {
  const columns: ColumnDef<ChildListItem>[] = [
    {
      id: "name",
      accessorFn: (c) => c.name,
      header: "Child",
      cell: ({ row: { original: c } }) => (
        <Link href={`/child/${c.reviewId}`} aria-label={`${c.name}: ${stateLabel(c, past)}`} className="flex items-center gap-3 text-foreground underline-offset-4 hover:text-foreground hover:underline">
          <ChildAvatar src={c.photo} name={c.name} size={32} />
          <span className="font-medium">
            {c.name} {c.chineseName && <span className="ml-1 font-normal text-muted-foreground">{c.chineseName}</span>}
          </span>
        </Link>
      ),
    },
    ...(showClass ? [{ id: "class", accessorFn: (c: ChildListItem) => c.className, header: "Class", meta: { className: "hidden md:table-cell" } } satisfies ColumnDef<ChildListItem>] : []),
    {
      id: "areas",
      accessorFn: (c) => ratedAreas(c),
      header: "Areas rated",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row: { original: c } }) => <AreaRing rated={ratedAreas(c)} total={myAreas(c).length} />,
    },
    {
      id: "status",
      accessorFn: (c) => STATE_RANK[stateKey(c)],
      header: "Learning report",
      cell: ({ row: { original: c } }) => {
        const key = stateKey(c);
        return (
          <Badge className={cn("gap-1.5 border-transparent font-medium", STATE_TONE[key])}>
            {key === "not_started" && <CircleAlert className="size-3" aria-hidden />}
            {stateLabel(c, past)}
          </Badge>
        );
      },
    },
    {
      id: "sent",
      accessorFn: (c) => c.submittedAt ?? "",
      header: "Sent for review",
      meta: { className: "hidden text-xs text-muted-foreground lg:table-cell" },
      cell: ({ row: { original: c } }) =>
        c.submittedAt ? (
          <>
            {c.submittedBy ?? "A teacher"}
            <span className="block">{timeAgo(c.submittedAt)}</span>
          </>
        ) : (
          "—"
        ),
    },
    { id: "next", header: () => <span className="sr-only">Next step</span>, enableSorting: false, meta: { align: "right" }, cell: ({ row: { original: c } }) => <NextStep c={c} past={past} /> },
  ];
  return <DataTable columns={columns} data={list} getRowId={(c) => c.reviewId} initialSort={[{ id: showClass ? "class" : "name", desc: false }]} />;
}
