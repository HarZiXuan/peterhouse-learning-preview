import { redirect } from "next/navigation";
import type { AuditEntry, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { SettingsSection } from "../SettingsSection";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const { entries } = await apiGet<{ entries: AuditEntry[] }>("/admin/audit");
  return (
    <SettingsSection title="Activity log" description="The latest 200 events: who signed in, opened a child’s record, wrote or downloaded a report. It never contains a child’s name.">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Who</TableHead>
              <TableHead>What</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.userName ?? "Not signed in"}</TableCell>
                <TableCell>
                  {e.action}
                  {e.detail ? <span className="text-muted-foreground"> · {e.detail}</span> : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-muted-foreground">{new Date(e.at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">Nothing yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </SettingsSection>
  );
}
