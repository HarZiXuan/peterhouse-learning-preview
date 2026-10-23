"use client";

// The one table for every list in the staff app (docs/DESIGN-SYSTEM.md): shadcn Table plus TanStack Table for sorting
// and paging. Every column with a value sorts: first click ascending, the next descending, the next back to the
// table's own order.
import { useState, type ReactNode } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type Row, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type { ColumnDef } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Classes for this column's cells and heading (width, alignment, hiding on small screens). */
    className?: string;
    /** Right-aligns the column, heading included (numbers, dates, actions). */
    align?: "right";
  }
}

/** Text sorts ignoring case and with numbers in order ("Class 2" before "Class 10"); empty values always go last. */
const textSort = (a: Row<unknown>, b: Row<unknown>, id: string) => {
  const x = a.getValue(id);
  const y = b.getValue(id);
  const blank = (v: unknown) => v === null || v === undefined || v === "";
  if (blank(x) || blank(y)) return blank(x) === blank(y) ? 0 : blank(x) ? 1 : -1;
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true });
};

const PAGE_SIZES = [10, 25, 50];

export function DataTable<T>({
  columns,
  data,
  getRowId,
  initialSort,
  rowClassName,
  onRowClick,
  empty = "Nothing here yet.",
  pageSize,
  className,
}: {
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[];
  getRowId?: (row: T) => string | number;
  /** The order before anyone clicks a heading, e.g. `[{ id: "name", desc: false }]`. Without it, the data's own order. */
  initialSort?: SortingState;
  rowClassName?: (row: T) => string | false | undefined;
  /** Makes the whole row open something. Keep a real link in the first cell too, for keyboards. */
  onRowClick?: (row: T) => void;
  /** Shown in place of the rows when there are none. */
  empty?: ReactNode;
  /** Pages the table with this many rows per page, with a footer to move between pages. */
  pageSize?: number;
  className?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? []);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: pageSize ?? 0 });
  // TanStack's table object changes in place, so the React Compiler leaves this component unmemoised; that is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, ...(pageSize ? { pagination } : {}) },
    onSortingChange: (s) => {
      setSorting(s);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    getRowId: getRowId ? (r) => String(getRowId(r)) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    defaultColumn: { sortingFn: textSort as never, sortDescFirst: false },
    autoResetPageIndex: false,
  });
  const rows = table.getRowModel().rows;
  const total = table.getPrePaginationRowModel().rows.length;
  const edge = "first:pl-4 last:pr-4";

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((g) => (
            <TableRow key={g.id} className="hover:bg-transparent">
              {g.headers.map((h) => {
                const meta = h.column.columnDef.meta;
                const dir = h.column.getIsSorted();
                const label = h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext());
                return (
                  <TableHead key={h.id} aria-sort={h.column.getCanSort() ? (dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none") : undefined} className={cn(edge, meta?.align === "right" && "text-right", meta?.className)}>
                    {h.column.getCanSort() ? (
                      <Button variant="ghost" size="sm" onClick={h.column.getToggleSortingHandler()} className={cn("h-7 gap-1 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground", meta?.align === "right" ? "-mr-1.5" : "-ml-1.5", dir && "text-foreground")}>
                        {label}
                        {dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : dir === "desc" ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />}
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-24 whitespace-normal text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id} className={cn(onRowClick && "cursor-pointer", rowClassName?.(r.original))} onClick={onRowClick ? () => onRowClick(r.original) : undefined}>
                {r.getVisibleCells().map((c) => {
                  const meta = c.column.columnDef.meta;
                  return (
                    <TableCell key={c.id} className={cn(edge, meta?.align === "right" && "text-right", meta?.className)}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pageSize && total > PAGE_SIZES[0] && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {pagination.pageIndex * pagination.pageSize + 1}–{Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)} of {total}
            </span>
            <Select value={String(pagination.pageSize)} onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}>
              <SelectTrigger size="sm" className="w-28" aria-label="Rows per page">
                <SelectValue>{pagination.pageSize} rows</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Page {pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The search box of a table's toolbar. */
export function TableSearch({ value, onChange, label, placeholder = "Search by name", className }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="bg-card pl-8" />
    </div>
  );
}

/** A filter of a table's toolbar: one of a few choices, with "all" as the empty value. */
export function TableFilter({ value, onChange, label, all, options, className }: { value: string; onChange: (v: string) => void; label: string; all: string; options: { value: string; label: string }[]; className?: string }) {
  const ALL = "__all";
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger className={cn("w-auto min-w-40 bg-card", className)} aria-label={label}>
        <SelectValue>{options.find((o) => o.value === value)?.label ?? all}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
