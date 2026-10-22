import { redirect } from "next/navigation";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";

/** Old address. Everyone's reviews are on Reports now. */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ class?: string; show?: string }> }) {
  const sp = await searchParams;
  if ((await apiGet<WorkspaceInfo>("/workspace")).user.role === "admin") redirect(sp.show === "all" ? "/reports" : "/reports?status=not_submitted");
  redirect(`/reports${sp.show === "all" ? "" : "?show=todo"}${Number(sp.class) ? `${sp.show === "all" ? "?" : "&"}class=${Number(sp.class)}` : ""}`);
}
