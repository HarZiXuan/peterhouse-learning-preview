"use client";

import type { AuditEntry } from "@peterhouse/shared";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Card } from "@/components/ui/card";

const columns: ColumnDef<AuditEntry>[] = [
  { id: "who", accessorFn: (e) => e.userName ?? "Not signed in", header: "Who", meta: { className: "font-medium" } },
  {
    id: "what",
    accessorFn: (e) => (e.detail ? `${e.action} · ${e.detail}` : e.action),
    header: "What",
    meta: { className: "whitespace-normal" },
    cell: ({ row: { original: e } }) => (
      <>
        {e.action}
        {e.detail ? <span className="text-muted-foreground"> · {e.detail}</span> : null}
      </>
    ),
  },
  { id: "when", accessorFn: (e) => new Date(e.at).getTime(), header: "When", meta: { align: "right", className: "text-muted-foreground" }, cell: ({ row: { original: e } }) => new Date(e.at).toLocaleString() },
];

/** The activity log as a table: click a heading to sort it, and page through it. Newest first until a column is chosen. */
export function ActivityTable({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      <DataTable columns={columns} data={entries} getRowId={(e) => e.id} pageSize={10} empty="Nothing yet." />
    </Card>
  );
}
