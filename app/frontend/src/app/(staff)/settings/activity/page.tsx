import { redirect } from "next/navigation";
import type { AuditEntry, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { SettingsSection } from "../SettingsSection";
import { ActivityTable } from "./ActivityTable";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const { entries } = await apiGet<{ entries: AuditEntry[] }>("/admin/audit");
  return (
    <SettingsSection title="Activity log" description="The latest 200 events: who signed in, opened a child’s record, wrote or downloaded a report. It never contains a child’s name.">
      <ActivityTable entries={entries} />
    </SettingsSection>
  );
}
