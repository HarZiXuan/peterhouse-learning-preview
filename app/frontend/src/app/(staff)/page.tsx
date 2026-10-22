import { redirect } from "next/navigation";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Board } from "./Board";

export default async function HomePage() {
  // The administrator's home is Classes; every child's report is followed from Reports.
  if ((await apiGet<WorkspaceInfo>("/workspace")).user.role === "admin") redirect("/classes");
  return <Board />;
}
