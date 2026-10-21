import { redirect } from "next/navigation";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Board, type Show } from "./Board";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ show?: string; class?: string }> }) {
  const sp = await searchParams;
  // The administrator's home is Classes; their list of every child is under Reviews.
  if ((await apiGet<WorkspaceInfo>("/workspace")).user.role === "admin") redirect("/classes");
  const show: Show = sp.show === "todo" || sp.show === "ready" ? sp.show : "all";
  return <Board show={show} base="/" classId={Number(sp.class) || undefined} />;
}
