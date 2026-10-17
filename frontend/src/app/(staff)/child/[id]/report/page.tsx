import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReportView } from "@peterhouse/shared";
import { apiGetOrNull } from "@/lib/api";
import { notFound } from "next/navigation";
import { ReportWorkbench } from "./ReportWorkbench";

export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { data: v, code } = await apiGetOrNull<ReportView>(`/reviews/${id}/report`);
  if (!v) {
    if (code === "no_draft") redirect(`/child/${id}`);
    notFound();
  }
  return (
    <main className="board board-wide">
      <p className="crumbs">
        <Link href="/">← All children</Link>
      </p>
      <div className="page-head">
        <div>
          <p className="kicker">Report</p>
          <h1 style={{ marginTop: 4 }}>{v.childName}</h1>
        </div>
        <div className="row">
          <Link className="btn" href={`/child/${id}`}>
            Change answers
          </Link>
          <a className="btn btn-primary" href={`/api/reviews/${id}/pdf`}>
            Download PDF
          </a>
        </div>
      </div>
      {v.notes.length > 0 && <p className="notice-gold" style={{ marginBottom: 16 }}>{v.notes.join(" ")}</p>}
      <p className="small muted" style={{ marginBottom: 12 }}>
        Written by {v.provider === "sentence_bank" ? "the built-in basic writer" : `AI (${v.provider})`}. Not quite right? Edit any wording in the boxes and watch the report change, then download.
      </p>
      <ReportWorkbench reviewId={id} data={v.data} school={v.school} sections={v.sections} reportDateIso={new Date().toISOString()} />
    </main>
  );
}
