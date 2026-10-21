import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReportView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet, apiGetOrNull } from "@/lib/api";
import { WorkflowPanel } from "../../../WorkflowPanel";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DownloadPdf } from "./DownloadPdf";
import { ReportWorkbench } from "./ReportWorkbench";

export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [{ data: v, code }, { user }] = await Promise.all([apiGetOrNull<ReportView>(`/reviews/${id}/report`), apiGet<WorkspaceInfo>("/workspace")]);
  const admin = user.role === "admin";
  if (!v) {
    if (code === "no_draft") redirect(`/child/${id}`);
    notFound();
  }
  return (
    <main className="mx-auto max-w-[1480px] px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <Link href={admin ? "/approvals" : "/reports"} className="text-sm text-muted-foreground hover:text-foreground">
        ← {admin ? "Approvals" : "Reports"}
      </Link>
      <div className="mb-4 mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Report</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
            {v.childName} {v.data.chineseName && <span className="ml-1 text-xl font-normal text-muted-foreground">{v.data.chineseName}</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/child/${id}`}>Change ratings</Link>
          </Button>
          <DownloadPdf reviewId={Number(id)} childName={v.childName} disabledReason={v.workflow.canDownload ? null : "The PDF for families can be downloaded once the report is approved."} />
        </div>
      </div>
      <WorkflowPanel reviewId={id} childName={v.childName} workflow={v.workflow} admin={admin} />
      {v.notes.length > 0 && (
        <Alert className="mb-4">
          <AlertDescription>{v.notes.join(" ")}</AlertDescription>
        </Alert>
      )}
      <p className="mb-3 text-sm text-muted-foreground">
        Written by {v.provider === "sentence_bank" ? "the built-in writer" : `AI (${v.provider})`}.{" "}
        {v.workflow.locked ? v.workflow.locked : "Not quite right? Edit any wording in the boxes and watch the report change."}
      </p>
      <ReportWorkbench reviewId={id} locked={v.workflow.locked} data={v.data} school={v.school} sections={v.sections} reportDateIso={new Date().toISOString()} />
    </main>
  );
}
