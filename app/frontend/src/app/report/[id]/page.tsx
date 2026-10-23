import type { ReportView } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Report } from "@/components/report/Report";

export const dynamic = "force-dynamic";

/** The page the PDF is printed from. An approved report carries the date it was approved. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const v = await apiGet<ReportView>(`/reviews/${id}/report`);
  return <Report data={v.data} school={v.school} isDraft={false} reportDate={v.reportDate ? new Date(v.reportDate) : new Date()} />;
}
