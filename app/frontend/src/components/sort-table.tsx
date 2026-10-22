"use client";

// A table whose column headings sort it, shared by the Children table and People and sign-ins.
import { useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** A column; one without `sort` cannot be sorted and its heading is for screen readers only. */
export type Column<T> = { key: string; label: string; sort?: (r: T) => string | number };
type Sort = { key: string; dir: "asc" | "desc" } | null;

/** Sorts by a column: the first click ascending, the next descending, the next back to the table's own order. */
export function useSort<T>(rows: T[], columns: Column<T>[]) {
  const [sort, setSort] = useState<Sort>(null);
  const by = columns.find((c) => c.key === sort?.key)?.sort;
  const sorted = by
    ? [...rows].sort((a, b) => {
        const x = by(a);
        const y = by(b);
        const n = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true });
        return sort!.dir === "asc" ? n : -n;
      })
    : rows;
  const toggle = (key: string) => setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  return { sorted, sort, toggle };
}

export function SortHead<T>({ columns, sort, toggle }: { columns: Column<T>[]; sort: Sort; toggle: (key: string) => void }) {
  return (
    <TableHeader>
      <TableRow className="bg-secondary/50 hover:bg-secondary/50">
        {columns.map((c, n) => (
          <TableHead
            key={c.key}
            aria-sort={!c.sort ? undefined : sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
            className={cn("font-bold text-foreground", n === 0 && "sticky left-0 z-10 bg-secondary px-4 md:static md:bg-transparent", n === columns.length - 1 && "px-4")}
          >
            {c.sort ? (
              <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {c.label}
                <span className={cn("inline-flex", sort?.key === c.key ? "text-primary" : "text-muted-foreground/50")}>
                  {sort?.key === c.key && sort.dir === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                </span>
              </button>
            ) : (
              <span className="sr-only">{c.label}</span>
            )}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="relative min-w-52 flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search by name" aria-label={label} className="h-9 pl-9" />
    </div>
  );
}

export function EmptyTable({ title, text }: { title: string; text: string }) {
  return (
    <Card className="items-center gap-2 border-dashed px-6 py-10 text-center shadow-none">
      <p className="font-heading text-xl font-semibold">{title}</p>
      <p className="max-w-md text-muted-foreground">{text}</p>
    </Card>
  );
}

/** The sticky first cell of a row, matching the sticky first heading. */
export const STICKY_CELL = "sticky left-0 z-10 bg-card px-4 md:static md:bg-transparent";
