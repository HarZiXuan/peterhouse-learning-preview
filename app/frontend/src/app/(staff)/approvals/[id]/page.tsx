import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import type { ApprovalDetail, ReportView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet, apiGetOrNull } from "@/lib/api";
import { Report } from "@/components/report/Report";
import { Card } from "@/components/ui/card";
import { ScaledReport } from "../../child/[id]/report/ScaledReport";
import { WorkflowPanel } from "../../WorkflowPanel";

export const dynamic = "force-dynamic";

const DECISION: Record<string, string> = { approved: "Approved", changes_requested: "Sent back", taken_back: "Taken back by the teacher" };
// Singapore time on the server and in every browser, so the page reads the same wherever it is drawn.
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

/** One report under review: the report as the family will see it, and the teacher's ratings and comments beside it. */
export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect(`/child/${id}/report`);
  const { data: report, code } = await apiGetOrNull<ReportView>(`/reviews/${id}/report`);
  if (!report) redirect(code === "no_draft" ? `/child/${id}` : "/reports");
  const extra = await apiGet<Omit<ApprovalDetail, "report">>(`/admin/approvals/${id}`);
  const latest = extra.versions[0];

  return (
    <main className="mx-auto max-w-[1480px] px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <BackLink fallback={{ href: "/reports", label: "Reports" }} />
      <div className="mb-4 mt-2">
        <p className="text-sm text-muted-foreground">
          {extra.className} · {extra.teacher ?? "No teacher"}
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
          {report.childName} {report.data.chineseName && <span className="ml-1 text-xl font-normal text-muted-foreground">{report.data.chineseName}</span>}
        </h1>
      </div>
      <WorkflowPanel reviewId={id} childName={report.childName} workflow={report.workflow} admin teacher={extra.teacher} inApprovals />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label="The report as the family will see it" className="min-w-0">
          <ScaledReport>
            <Report data={report.data} school={report.school} isDraft={false} reportDate={new Date()} />
          </ScaledReport>
        </section>

        <aside className="grid content-start gap-4">
          {extra.versions.length > 1 && (
            <Card className="gap-2 px-5 py-4 shadow-none">
              <p className="font-heading text-base font-semibold">Changed since v{extra.versions[1].version}</p>
              {extra.changedSinceLast.length === 0 ? (
                <p className="text-sm text-muted-foreground">No wording changed.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {extra.changedSinceLast.map((t) => (
                    <li key={t} className="rounded-full border border-primary/40 px-2.5 py-0.5 text-sm text-primary">
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="gap-3 px-5 py-4 shadow-none">
            <p className="font-heading text-base font-semibold">The teacher’s ratings and comments</p>
            {extra.areas.map((a) => (
              <details key={a.key} className="group border-t pt-2 first-of-type:border-t-0 first-of-type:pt-0">
                <summary className="cursor-pointer text-sm font-semibold">{a.name}</summary>
                <ul className="mt-2 grid gap-1.5 text-sm">
                  {a.ratings.map((r) => (
                    <li key={r.text} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{r.text}</span>
                      <span className="shrink-0 font-medium">{r.word}</span>
                    </li>
                  ))}
                </ul>
                {a.note && <p className="mt-2 rounded-md bg-secondary px-3 py-2 text-sm">“{a.note}”</p>}
              </details>
            ))}
          </Card>

          <Card className="gap-2 px-5 py-4 shadow-none">
            <p className="font-heading text-base font-semibold">History</p>
            {!latest ? (
              <p className="text-sm text-muted-foreground">Not sent for review yet.</p>
            ) : (
              <ol className="grid gap-2 text-sm">
                {extra.versions.map((v) => (
                  <li key={v.version} className="border-l-2 pl-3">
                    <p>
                      <b>v{v.version}</b> sent by {v.submittedBy ?? "someone"}, {when(v.submittedAt)}
                    </p>
                    <p className="text-muted-foreground">{v.decision ? `${DECISION[v.decision] ?? v.decision}${v.decidedBy ? ` by ${v.decidedBy}` : ""}` : "Waiting for review"}</p>
                    {v.note && <p className="mt-1 rounded-md bg-secondary px-2 py-1">“{v.note}”</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </main>
  );
}
