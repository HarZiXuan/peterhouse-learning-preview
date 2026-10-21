import Link from "next/link";
import { redirect } from "next/navigation";
import type { ApprovalStatusFilter, ApprovalsView, WorkspaceInfo } from "@peterhouse/shared";
import { STATUS_LABEL, reportPeriod } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { timeAgo } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Filters } from "./Filters";

export const dynamic = "force-dynamic";

const TABS: { key: ApprovalStatusFilter; label: string; empty: string }[] = [
  { key: "waiting", label: "Waiting for review", empty: "Nothing is waiting. Reports appear here when a teacher sends one for review." },
  { key: "changes", label: "Changes requested", empty: "No report is back with its teacher." },
  { key: "approved", label: "Approved", empty: "No report is approved yet this semester." },
  { key: "not_submitted", label: "Not sent yet", empty: "Every child’s report has been sent for review." },
];

/** The administrator's review queue: every report this semester, by where it is. */
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ status?: string; class?: string; teacher?: string }> }) {
  const sp = await searchParams;
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/reports");
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "waiting") as ApprovalStatusFilter;
  const q = new URLSearchParams({ status, ...(Number(sp.class) ? { classId: sp.class! } : {}), ...(Number(sp.teacher) ? { teacherId: sp.teacher! } : {}) });
  const view = await apiGet<ApprovalsView>(`/admin/approvals?${q}`);
  const tabHref = (key: string) => {
    const p = new URLSearchParams({ status: key, ...(sp.class ? { class: sp.class } : {}), ...(sp.teacher ? { teacher: sp.teacher } : {}) });
    return `/approvals?${p}`;
  };
  const tab = TABS.find((t) => t.key === status)!;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {reportPeriod(info.period.season, info.period.year)} · teachers write, you approve
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">Approvals</h1>
          <p className="mt-1 max-w-xl text-muted-foreground">Read each report the way the family will see it, with the teacher’s ratings beside it. Approve it, or send it back with a note.</p>
        </div>
        <Filters classes={view.classes} teachers={view.teachers} />
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            aria-current={status === t.key ? "true" : undefined}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground aria-[current=true]:border-primary aria-[current=true]:text-foreground"
          >
            {t.label} <span className={cn("ml-1", t.key === "waiting" && view.counts.waiting > 0 ? "rounded-full bg-primary px-1.5 text-primary-foreground" : "text-muted-foreground")}>{view.counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {view.items.length === 0 ? (
        <Card className="items-center gap-2 border-dashed px-6 py-12 text-center shadow-none">
          <p className="font-heading text-xl font-semibold">{status === "waiting" ? "All caught up" : "Nothing here"}</p>
          <p className="max-w-md text-muted-foreground">{tab.empty}</p>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {view.items.map((i) => (
            <li key={i.reviewId}>
              <Link href={status === "not_submitted" ? `/child/${i.reviewId}` : `/approvals/${i.reviewId}`} className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <Card className="grid gap-2 px-5 py-4 shadow-none transition-colors hover:border-foreground/30 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-lg font-semibold leading-tight">
                      {i.childName} {i.chineseName && <span className="ml-1 text-sm font-normal text-muted-foreground">{i.chineseName}</span>}
                    </span>
                    <span className="text-sm text-muted-foreground sm:hidden">
                      {i.className} · {i.teacher ?? "No teacher"}
                    </span>
                  </span>
                  <span className="hidden truncate text-sm text-muted-foreground sm:block">{i.className}</span>
                  <span className="hidden truncate text-sm text-muted-foreground sm:block">{i.teacher ?? "No teacher"}</span>
                  <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge variant={i.status === "approved" ? "default" : "outline"} className={cn("font-normal", i.status === "changes_requested" && "border-warn bg-warn/15", i.status === "submitted" && "border-primary/40 text-primary")}>
                      {STATUS_LABEL[i.status]}
                    </Badge>
                    {i.version > 0 && <span className="text-xs text-muted-foreground">v{i.version}</span>}
                    {i.adminEdited && <Badge variant="secondary" className="font-normal">Edited by admin</Badge>}
                    <span className="text-xs text-muted-foreground">{timeAgo(i.updatedAt)}</span>
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
