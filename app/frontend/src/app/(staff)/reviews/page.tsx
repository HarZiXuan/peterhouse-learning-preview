import { redirect } from "next/navigation";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";

/** Old address. Teachers' reviews are the "To do" view of Students (change 13); the administrator's are in Approvals (change 9). */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ class?: string; show?: string }> }) {
  const sp = await searchParams;
  if ((await apiGet<WorkspaceInfo>("/workspace")).user.role === "admin") redirect(sp.show === "all" ? "/reports" : "/reports?status=not_submitted");
  redirect(`/?show=${sp.show === "all" ? "all" : "todo"}${Number(sp.class) ? `&class=${Number(sp.class)}` : ""}`);
}
