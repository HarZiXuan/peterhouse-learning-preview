import { redirect } from "next/navigation";
import type { ReportView, ReviewView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet, apiGetOrNull } from "@/lib/api";
import { BackLink } from "@/components/back-link";
import { ReviewForm } from "./ReviewForm";

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  // Teachers write the reports; an administrator only reads them, unless they have taken one over.
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role === "admin") {
    // With no report written yet ("no_draft") the admin sees the review itself, read-only, to follow the teachers'
    // progress; a written report opens on its own page.
    const { data: report, code } = await apiGetOrNull<ReportView>(`/reviews/${id}/report`);
    if (!report && code !== "no_draft") redirect("/reports");
    if (report?.workflow.locked) redirect(`/child/${id}/report`);
  }
  // Opening the review freezes the question set it uses (later edits by the administrator do not change it).
  const v = await apiGet<ReviewView>(`/reviews/${id}`);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <BackLink fallback={user.role === "admin" ? { href: "/reports", label: "Reports" } : { href: "/reports", label: "Reports" }} skip={[`/child/${id}/report`]} className="mb-2" />
      <ReviewForm key={id} view={v} adminView={user.role === "admin"} />
    </main>
  );
}
