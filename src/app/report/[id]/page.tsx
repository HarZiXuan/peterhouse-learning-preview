import { notFound } from "next/navigation";
import { getReviewRow, reportDataFor } from "@/lib/reviews";
import { getSchool } from "@/lib/school";
import { Report } from "@/components/report/Report";

export const dynamic = "force-dynamic";

/** The page the PDF is printed from. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const r = getReviewRow(id);
  if (!r || !r.draft) notFound();
  const { data } = reportDataFor(r);
  return <Report data={data} school={getSchool()} isDraft={false} reportDate={new Date()} />;
}
