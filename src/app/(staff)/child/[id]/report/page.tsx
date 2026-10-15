import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getReviewRow, reportDataFor } from "@/lib/reviews";
import { getSchool } from "@/lib/school";
import type { Draft } from "@/lib/types";
import { ReportWorkbench } from "./ReportWorkbench";

export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const r = getReviewRow(id);
  if (!r) notFound();
  if (!r.draft) redirect(`/child/${id}`);
  const draft = JSON.parse(r.draft) as Draft;
  const { data } = reportDataFor(r);
  const sections = [
    ...draft.paragraphs.map((p) => ({ key: p.key, title: p.title, text: p.text })),
    { key: "home", title: "Ideas to try at home (one per line)", text: draft.homeIdeas.join("\n") },
  ];
  return (
    <main className="board board-wide">
      <p className="crumbs">
        <Link href="/">← All children</Link>
      </p>
      <div className="page-head">
        <div>
          <p className="kicker">Report</p>
          <h1 style={{ marginTop: 4 }}>{r.preferred_name}</h1>
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
      {draft.notes.length > 0 && <p className="notice-gold" style={{ marginBottom: 16 }}>{draft.notes.join(" ")}</p>}
      <p className="small muted" style={{ marginBottom: 12 }}>
        Written by {draft.provider === "sentence_bank" ? "the built-in basic writer" : `AI (${draft.provider})`}. Not quite right? Edit any wording in the boxes and watch the report change, then download.
      </p>
      <ReportWorkbench reviewId={id} data={data} school={getSchool()} sections={sections} reportDateIso={new Date().toISOString()} />
    </main>
  );
}
