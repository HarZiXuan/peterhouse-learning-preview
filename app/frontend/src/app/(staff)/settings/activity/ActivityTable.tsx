"use client";

import { useMemo, useState } from "react";
import type { AuditEntry } from "@peterhouse/shared";
import { Icon } from "@/components/icons";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SELECT } from "../../AddChild";

type Key = "who" | "what" | "when";
const COLUMNS: { key: Key; label: string; right?: boolean }[] = [
  { key: "who", label: "Who" },
  { key: "what", label: "What" },
  { key: "when", label: "When", right: true },
];
const SIZES = [10, 25, 50];

const who = (e: AuditEntry) => e.userName ?? "Not signed in";
const what = (e: AuditEntry) => (e.detail ? `${e.action} · ${e.detail}` : e.action);

/** Page numbers to show: the first, the last, and the ones around the current page, with gaps as null. */
function pageList(page: number, pages: number): (number | null)[] {
  const wanted = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  return wanted.flatMap((p, n) => (n > 0 && p - wanted[n - 1] > 1 ? [null, p] : [p]));
}

/** The activity log as a table: click a heading to sort it, and page through it. Newest first until a column is chosen. */
export function ActivityTable({ entries }: { entries: AuditEntry[] }) {
  const [sort, setSort] = useState<{ key: Key; dir: "asc" | "desc" } | null>(null);
  const [size, setSize] = useState(SIZES[0]);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    if (!sort) return entries;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...entries].sort((a, b) => {
      if (sort.key === "when") return (new Date(a.at).getTime() - new Date(b.at).getTime()) * sign;
      const f = sort.key === "who" ? who : what;
      return f(a).localeCompare(f(b), undefined, { sensitivity: "base" }) * sign;
    });
  }, [entries, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * size, current * size);
  const first = rows.length === 0 ? 0 : (current - 1) * size + 1;

  // First click sorts ascending, the next descending, the next returns to newest first.
  const clickSort = (key: Key) => {
    setPage(1);
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  };

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              {COLUMNS.map((c) => {
                const on = sort?.key === c.key;
                return (
                  <TableHead key={c.key} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("font-bold text-foreground", c.right && "text-right")}>
                    <button type="button" onClick={() => clickSort(c.key)} className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {c.label}
                      <span className={cn("inline-flex", on ? "text-primary" : "text-muted-foreground/50")}>
                        <Icon name={on && sort.dir === "desc" ? "down" : "up"} size={14} />
                      </span>
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{who(e)}</TableCell>
                <TableCell>
                  {e.action}
                  {e.detail ? <span className="text-muted-foreground"> · {e.detail}</span> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-muted-foreground">{new Date(e.at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Nothing yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {first}–{Math.min(current * size, rows.length)} of {rows.length}
            </span>
            <label className="flex items-center gap-2">
              Rows
              <select
                className={`${SELECT} w-auto`}
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious aria-disabled={current === 1} onClick={() => setPage(Math.max(1, current - 1))} />
              </PaginationItem>
              {pageList(current, pages).map((p, n) => (
                <PaginationItem key={p ?? `gap-${n}`}>
                  {p === null ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink isActive={p === current} onClick={() => setPage(p)}>
                      {p}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext aria-disabled={current === pages} onClick={() => setPage(Math.min(pages, current + 1))} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
