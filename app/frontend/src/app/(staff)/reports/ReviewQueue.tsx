import Link from "next/link";
import type { ApprovalStatusFilter, ApprovalsView, ChildListItem } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Filters } from "./Filters";
import { QueueTable, type Progress } from "./QueueTable";
import { TAB, TAB_NAV } from "@/components/ui/tab-styles";

const TABS: { key: ApprovalStatusFilter; label: string; empty: string }[] = [
  { key: "waiting", label: "Waiting for review", empty: "Nothing is waiting. Reports appear here when a teacher sends one for review." },
  { key: "changes", label: "Changes requested", empty: "No report is back with its teacher." },
  { key: "approved", label: "Approved", empty: "No report is approved yet this semester." },
  { key: "not_submitted", label: "With teachers", empty: "Every child’s report has been sent for review." },
];

export type QueueParams = { status?: string; class?: string; teacher?: string; q?: string; sort?: string; dir?: string; term?: string };

/** The administrator's review queue: every report of one period, by where it is. `termId` is a past period; without it, the current one. */
export async function ReviewQueue({ sp, termId }: { sp: QueueParams; termId?: number }) {
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "waiting") as ApprovalStatusFilter;
  const q = new URLSearchParams({ status, ...(Number(sp.class) ? { classId: sp.class! } : {}), ...(Number(sp.teacher) ? { teacherId: sp.teacher! } : {}), ...(termId ? { termId: String(termId) } : {}) });
  const notSent = status === "not_submitted";
  const [view, progress] = await Promise.all([
    apiGet<ApprovalsView>(`/admin/approvals?${q}`),
    notSent && !termId ? apiGet<{ children: ChildListItem[] }>("/children").then((r) => Object.fromEntries(r.children.map((c): [number, Progress] => [c.reviewId, { answered: c.answered, total: c.total, hasReport: c.hasReport }]))) : null,
  ]);
  const filters = { ...(termId ? { term: String(termId) } : {}), ...(sp.class ? { class: sp.class } : {}), ...(sp.teacher ? { teacher: sp.teacher } : {}), ...(sp.q ? { q: sp.q } : {}) };
  const tabHref = (key: string) => `/reports?${new URLSearchParams({ status: key, ...filters })}`;
  const name = (sp.q ?? "").trim().toLowerCase();
  const items = name ? view.items.filter((i) => `${i.childName} ${i.chineseName}`.toLowerCase().includes(name)) : view.items;
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
              See the {view.counts.not_submitted} still with teachers
            </Link>
          )}
        </Card>
      ) : items.length === 0 ? (
        <Card className="items-center gap-2 border-dashed px-6 py-10 text-center shadow-none">
          <p className="font-heading text-xl font-semibold">No one matches</p>
          <p className="text-muted-foreground">Try a different name or clear the filters.</p>
        </Card>
      ) : (
        <QueueTable items={items} progress={progress} notSent={notSent} />
      )}
    </>
  );
}
