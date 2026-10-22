import Link from "next/link";
import type { ApprovalItem, ApprovalStatusFilter, ApprovalsView, ChildListItem } from "@peterhouse/shared";
import { STATUS_LABEL } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { timeAgo } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Filters } from "./Filters";
import { TAB, TAB_NAV } from "@/components/ui/tab-styles";

const TABS: { key: ApprovalStatusFilter; label: string; empty: string }[] = [
  { key: "waiting", label: "Waiting for review", empty: "Nothing is waiting. Reports appear here when a teacher sends one for review." },
  { key: "changes", label: "Changes requested", empty: "No report is back with its teacher." },
  { key: "approved", label: "Approved", empty: "No report is approved yet this semester." },
  { key: "not_submitted", label: "Not sent yet", empty: "Every child’s report has been sent for review." },
];

/** How far a report not yet sent has got, from the class board's counts. */
type Progress = Pick<ChildListItem, "answered" | "total" | "hasReport">;
const progressText = (p: Progress | undefined) =>
  !p ? "" : p.hasReport ? "Report written" : p.answered === 0 ? "Not started" : p.answered === p.total ? "Ready to write" : `${p.answered} of ${p.total} rated`;
// Sorts furthest behind first: not started, then by share rated, then ready to write, then written.
const progressRank = (p: Progress | undefined) => (!p ? "" : p.hasReport ? "2" : (p.answered / Math.max(1, p.total)).toFixed(3));

type Column = { key: string; label: string; value: (i: ApprovalItem, p?: Progress) => string };
const COLUMNS: Column[] = [
  { key: "student", label: "Student", value: (i) => i.childName },
  { key: "class", label: "Class", value: (i) => i.className },
  { key: "teachers", label: "Class teachers", value: (i) => i.classTeachers.join(", ") },
  { key: "by", label: "Requested by", value: (i) => i.submittedBy ?? "" },
  { key: "at", label: "Requested at", value: (i) => i.submittedAt ?? "" },
  { key: "status", label: "Status", value: (i) => STATUS_LABEL[i.status] },
];
// Reports not sent yet have no request: their teachers' progress shows instead.
const NOT_SENT_COLUMNS: Column[] = [...COLUMNS.slice(0, 3), { key: "progress", label: "Progress", value: (_, p) => progressRank(p) }];

export type QueueParams = { status?: string; class?: string; teacher?: string; q?: string; sort?: string; dir?: string; term?: string };

/** The administrator's review queue: every report of one period, by where it is. `termId` is a past period; without it, the current one. */
export async function ReviewQueue({ sp, termId }: { sp: QueueParams; termId?: number }) {
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "waiting") as ApprovalStatusFilter;
  const q = new URLSearchParams({ status, ...(Number(sp.class) ? { classId: sp.class! } : {}), ...(Number(sp.teacher) ? { teacherId: sp.teacher! } : {}), ...(termId ? { termId: String(termId) } : {}) });
  const notSent = status === "not_submitted";
  const [view, progress] = await Promise.all([
    apiGet<ApprovalsView>(`/admin/approvals?${q}`),
    notSent && !termId ? apiGet<{ children: ChildListItem[] }>("/children").then((r) => new Map<number, Progress>(r.children.map((c) => [c.reviewId, c]))) : null,
  ]);
  // A past period has no live progress to show, so its unsent reports list like the others.
  const columns = progress ? NOT_SENT_COLUMNS : COLUMNS;
  const filters = { ...(termId ? { term: String(termId) } : {}), ...(sp.class ? { class: sp.class } : {}), ...(sp.teacher ? { teacher: sp.teacher } : {}), ...(sp.q ? { q: sp.q } : {}) };
  const keep = { ...filters, ...(sp.sort ? { sort: sp.sort, dir: sp.dir ?? "asc" } : {}) };
  const tabHref = (key: string) => `/reports?${new URLSearchParams({ status: key, ...keep })}`;
  const col = columns.find((c) => c.key === sp.sort);
  const dir = sp.dir === "desc" ? "desc" : "asc";
  // A column's first click sorts ascending, the next descending, the next goes back to newest first.
  const sortHref = (key: string) => {
    const p = new URLSearchParams({ status, ...filters });
    if (col?.key !== key || dir === "asc") {
      p.set("sort", key);
      p.set("dir", col?.key !== key ? "asc" : "desc");
    }
    return `/reports?${p}`;
  };
  const name = (sp.q ?? "").trim().toLowerCase();
  const found = name ? view.items.filter((i) => `${i.childName} ${i.chineseName}`.toLowerCase().includes(name)) : view.items;
  const items = col
    ? [...found].sort((a, b) => {
        const x = col.value(a, progress?.get(a.reviewId));
        const y = col.value(b, progress?.get(b.reviewId));
        if (!x && !y) return 0;
        if (!x) return 1;
        if (!y) return -1;
        return x.localeCompare(y, undefined, { sensitivity: "base", numeric: true }) * (dir === "asc" ? 1 : -1);
      })
    : found;
  const tab = TABS.find((t) => t.key === status)!;

  return (
    <>
      <Filters classes={view.classes} teachers={view.teachers} />

      <nav className={TAB_NAV} aria-label="Status">
        {TABS.map((t) => (
          <Link key={t.key} href={tabHref(t.key)} aria-current={status === t.key ? "true" : undefined} className={TAB}>
            {t.label}{" "}
            <span
              className={cn(
                "font-semibold",
                t.key === "waiting" && view.counts.waiting > 0 ? "rounded-full bg-primary px-1.5 text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {view.counts[t.key]}
            </span>
          </Link>
        ))}
      </nav>

      {view.items.length === 0 ? (
        <Card className="items-center gap-2 border-dashed px-6 py-12 text-center shadow-none">
          <p className="font-heading text-xl font-semibold">{status === "waiting" ? "All caught up" : "Nothing here"}</p>
          <p className="max-w-md text-muted-foreground">{tab.empty}</p>
          {status === "waiting" && view.counts.not_submitted > 0 && (
            <Link href={tabHref("not_submitted")} className="font-bold text-primary hover:underline">
              See the {view.counts.not_submitted} not sent yet
            </Link>
          )}
        </Card>
      ) : items.length === 0 ? (
        <Card className="items-center gap-2 border-dashed px-6 py-10 text-center shadow-none">
          <p className="font-heading text-xl font-semibold">No one matches</p>
          <p className="text-muted-foreground">Try a different name or clear the filters.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                {columns.map((c, n) => (
                  <TableHead
                    key={c.key}
                    aria-sort={col?.key === c.key ? (dir === "asc" ? "ascending" : "descending") : "none"}
                    className={cn("font-bold text-foreground", (n === 0 || n === columns.length - 1) && "px-4")}
                  >
                    <Link
                      href={sortHref(c.key)}
                      scroll={false}
                      className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {c.label}
                      <span className={cn("inline-flex", col?.key === c.key ? "text-primary" : "text-muted-foreground/50")}>
                        <Icon name={col?.key === c.key && dir === "desc" ? "down" : "up"} size={14} />
                      </span>
                    </Link>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.reviewId} className="relative cursor-pointer">
                  <TableCell className="px-4 py-3">
                    <Link
                      href={status === "not_submitted" ? `/child/${i.reviewId}` : `/approvals/${i.reviewId}`}
                      className="font-heading text-base font-semibold text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
                    >
                      {i.childName}
                    </Link>
                    {i.chineseName && <span className="ml-2 text-sm text-muted-foreground">{i.chineseName}</span>}
                  </TableCell>
                  <TableCell>{i.className}</TableCell>
                  <TableCell className="text-muted-foreground">{i.classTeachers.join(", ") || "No teacher"}</TableCell>
                  {progress ? (
                    <TableCell className="px-4">
                      <ProgressCell p={progress?.get(i.reviewId)} />
                    </TableCell>
                  ) : (
                    <>
                      <TableCell>{i.submittedBy ?? <span className="text-muted-foreground">Not sent yet</span>}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{i.submittedAt ? timeAgo(i.submittedAt) : "—"}</TableCell>
                    </>
                  )}
                  {!progress && (
                    <TableCell className="px-4">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={i.status === "approved" ? "default" : "outline"}
                          className={cn(
                            "font-normal",
                            i.status === "changes_requested" && "border-warn bg-warn/15",
                            i.status === "submitted" && "border-primary/40 text-primary",
                          )}
                        >
                          {STATUS_LABEL[i.status]}
                        </Badge>
                        {i.version > 0 && <span className="text-xs text-muted-foreground">v{i.version}</span>}
                        {i.adminEdited && (
                          <Badge variant="secondary" className="font-normal">
                            Edited by admin
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}

/** "12 of 16 rated" with a small bar, or where the report has got to. */
function ProgressCell({ p }: { p: Progress | undefined }) {
  if (!p) return <span className="text-muted-foreground">—</span>;
  const share = p.hasReport ? 1 : p.answered / Math.max(1, p.total);
  return (
    <span className="flex min-w-32 items-center gap-2">
      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <span className={cn("block h-full rounded-full", p.hasReport ? "bg-primary" : "bg-primary/60")} style={{ width: `${share * 100}%` }} />
      </span>
      <span className={cn("whitespace-nowrap text-sm", p.answered === 0 && !p.hasReport && "text-muted-foreground")}>{progressText(p)}</span>
    </span>
  );
}
