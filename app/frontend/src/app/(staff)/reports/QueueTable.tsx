"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApprovalItem, ChildListItem } from "@peterhouse/shared";
import { timeAgo } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress as Bar } from "@/components/ui/progress";
import { StatusBadge } from "../classes/shared";

/** How far a report not yet sent has got, from the class board's counts. */
export type Progress = Pick<ChildListItem, "answered" | "total" | "hasReport">;
const progressText = (p: Progress | undefined) =>
  !p ? "" : p.hasReport ? "Report written" : p.answered === 0 ? "Not started" : p.answered === p.total ? "Ready to write" : `${p.answered} of ${p.total} rated`;
// Sorts furthest behind first: not started, then by share rated, then written.
const progressRank = (p: Progress | undefined) => (!p ? -1 : p.hasReport ? 2 : p.answered / Math.max(1, p.total));

/**
 * The administrator's review queue as a table. Reports not sent yet (`progress` given) show their teachers' progress
 * instead of who sent them; those rows open the review, the others the approval page.
 */
export function QueueTable({ items, progress, notSent }: { items: ApprovalItem[]; progress: Record<number, Progress> | null; notSent: boolean }) {
  const router = useRouter();
  const hrefOf = (i: ApprovalItem) => (notSent ? `/child/${i.reviewId}` : `/approvals/${i.reviewId}`);
  const columns: ColumnDef<ApprovalItem>[] = [
    {
      id: "student",
      accessorFn: (i) => i.childName,
      header: "Child",
      cell: ({ row: { original: i } }) => (
        <>
          <Link href={hrefOf(i)} onClick={(e) => e.stopPropagation()} className="font-medium text-foreground underline-offset-4 hover:text-foreground hover:underline">
            {i.childName}
          </Link>
          {i.chineseName && <span className="ml-2 text-muted-foreground">{i.chineseName}</span>}
        </>
      ),
    },
    { id: "class", accessorFn: (i) => i.className, header: "Class" },
    { id: "teachers", accessorFn: (i) => i.classTeachers.join(", "), header: "Class teachers", meta: { className: "whitespace-normal text-muted-foreground" }, cell: ({ getValue }) => (getValue() as string) || "No teacher" },
    ...(progress
      ? [
          {
            id: "progress",
            accessorFn: (i: ApprovalItem) => progressRank(progress[i.reviewId]),
            header: "Progress",
            cell: ({ row: { original: i } }: { row: { original: ApprovalItem } }) => <ProgressCell p={progress[i.reviewId]} />,
          } satisfies ColumnDef<ApprovalItem>,
        ]
      : [
          { id: "by", accessorFn: (i: ApprovalItem) => i.submittedBy ?? "", header: "Sent by", cell: ({ row: { original: i } }: { row: { original: ApprovalItem } }) => i.submittedBy ?? <span className="text-muted-foreground">Not sent yet</span> } satisfies ColumnDef<ApprovalItem>,
          { id: "at", accessorFn: (i: ApprovalItem) => i.submittedAt ?? "", header: "Sent", meta: { className: "text-muted-foreground" }, cell: ({ row: { original: i } }: { row: { original: ApprovalItem } }) => (i.submittedAt ? timeAgo(i.submittedAt) : "—") } satisfies ColumnDef<ApprovalItem>,
          {
            id: "status",
            accessorFn: (i: ApprovalItem) => i.status,
            header: "Status",
            cell: ({ row: { original: i } }: { row: { original: ApprovalItem } }) => (
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge status={i.status} />
                {i.version > 0 && <span className="text-xs text-muted-foreground">v{i.version}</span>}
                {i.adminEdited && <Badge variant="outline">Edited by admin</Badge>}
              </span>
            ),
          } satisfies ColumnDef<ApprovalItem>,
        ]),
    {
      id: "open",
      header: () => <span className="sr-only">Open</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row: { original: i } }) => {
        // Waiting for review is the admin's job, so that is the one filled button; the rest just open.
        const review = i.status === "submitted";
        return (
          <Button asChild size="sm" variant={review ? "default" : "outline"} className="min-w-24" onClick={(e) => e.stopPropagation()}>
            <Link href={hrefOf(i)}>{notSent ? "Open review" : review ? "Review" : "Open report"}</Link>
          </Button>
        );
      },
    },
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      <DataTable columns={columns} data={items} getRowId={(i) => i.reviewId} onRowClick={(i) => router.push(hrefOf(i))} pageSize={50} empty="No one matches. Try a different name or clear the filters." />
    </Card>
  );
}

/** "12 of 16 rated" with a small green bar, or where the report has got to. */
function ProgressCell({ p }: { p: Progress | undefined }) {
  if (!p) return <span className="text-muted-foreground">—</span>;
  const share = p.hasReport ? 1 : p.answered / Math.max(1, p.total);
  return (
    <span className="flex min-w-32 items-center gap-2">
      <Bar value={share * 100} className="h-1.5 w-16 shrink-0" aria-hidden />
      <span className={p.answered === 0 && !p.hasReport ? "text-muted-foreground" : undefined}>{progressText(p)}</span>
    </span>
  );
}
