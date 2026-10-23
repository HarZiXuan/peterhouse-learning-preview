"use client";

import Link from "next/link";
import type { ApprovalItem, UserSummary } from "@peterhouse/shared";
import { timeAgo } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUBJECT_SWATCH } from "@/lib/calendar";
import { StatusBadge } from "../../classes/shared";

const ROLE = { lead: "Lead teacher", co: "Co-teacher", subject: "Subject teacher" } as const;
/** Statuses that went to the office, furthest along last; everything else is still with the teachers. */
const SENT: ApprovalItem["status"][] = ["submitted", "changes_requested", "approved"];
const sent = (r: ApprovalItem) => SENT.includes(r.status);

type TeacherClass = UserSummary["classes"][number];

const classColumns: ColumnDef<TeacherClass>[] = [
  {
    id: "name",
    accessorFn: (k) => k.name,
    header: "Class",
    cell: ({ row: { original: k } }) => (
      <Link href={`/classes/${k.id}`} className="font-medium text-foreground underline-offset-4 hover:text-foreground hover:underline">
        {k.name}
      </Link>
    ),
  },
  {
    id: "role",
    accessorFn: (k) => ["lead", "co", "subject"].indexOf(k.role),
    header: "Role",
    cell: ({ row: { original: k } }) => (
      <Badge variant={k.role === "lead" ? "secondary" : "outline"} className="font-medium">
        {ROLE[k.role]}
      </Badge>
    ),
  },
  {
    id: "subjects",
    accessorFn: (k) => k.subjects?.map((x) => x.name).join(", ") || (k.role === "subject" ? "" : "All subjects"),
    header: "Subjects",
    meta: { className: "whitespace-normal" },
    cell: ({ row: { original: k } }) => (
      <span className="flex flex-wrap gap-1">
        {k.subjects?.length ? (
          k.subjects.map((x) => (
            <Badge key={x.name} variant="outline" className="gap-1.5 font-normal">
              <span className="size-1.5 rounded-full" style={{ background: SUBJECT_SWATCH[x.color] }} aria-hidden />
              {x.name}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">{k.role === "subject" ? "—" : "All subjects"}</span>
        )}
      </span>
    ),
  },
];

const reportColumns: ColumnDef<ApprovalItem>[] = [
  {
    id: "name",
    accessorFn: (r) => r.childName,
    header: "Child",
    cell: ({ row: { original: r } }) => (
      <>
        <span className="font-medium">{r.childName}</span>
        {r.chineseName && <span className="ml-2 text-muted-foreground">{r.chineseName}</span>}
      </>
    ),
  },
  { id: "class", accessorFn: (r) => r.className, header: "Class", meta: { className: "text-muted-foreground" } },
  {
    id: "sent",
    accessorFn: (r) => r.submittedAt ?? "",
    header: "Sent for review",
    meta: { className: "text-muted-foreground" },
    cell: ({ row: { original: r } }) => (r.submittedAt ? `${timeAgo(r.submittedAt)}${r.submittedBy ? ` by ${r.submittedBy}` : ""}` : "—"),
  },
  {
    id: "status",
    // Furthest from done first: with teachers, then waiting, then sent back, then approved.
    accessorFn: (r) => (sent(r) ? SENT.indexOf(r.status) + 1 : 0),
    header: "Status",
    cell: ({ row: { original: r } }) => <StatusBadge status={r.status} />,
  },
  {
    id: "open",
    header: () => <span className="sr-only">Open</span>,
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row: { original: r } }) => (
      <Button asChild variant="ghost" size="sm" className="text-foreground hover:text-foreground">
        <Link href={sent(r) ? `/approvals/${r.reviewId}` : `/child/${r.reviewId}`}>{sent(r) ? "Open report" : "Open review"}</Link>
      </Button>
    ),
  },
];

export function TeacherClassesTable({ classes }: { classes: TeacherClass[] }) {
  return <DataTable columns={classColumns} data={classes} getRowId={(k) => k.id} empty="Not in a class this semester." />;
}

export function TeacherReportsTable({ reports }: { reports: ApprovalItem[] }) {
  // Unsorted, the page's own order: reports waiting on the office first, then by class and name.
  return <DataTable columns={reportColumns} data={reports} getRowId={(r) => r.reviewId} pageSize={25} empty="No children in their classes yet." />;
}
