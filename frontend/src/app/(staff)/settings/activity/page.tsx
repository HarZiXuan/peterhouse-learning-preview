import Link from "next/link";
import { redirect } from "next/navigation";
import type { AuditEntry, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const { entries } = await apiGet<{ entries: AuditEntry[] }>("/admin/audit");
  return (
    <main className="board board-narrow">
      <p className="crumbs">
        <Link href="/settings">← Settings</Link>
      </p>
      <h1>Activity log</h1>
      <div className="rule" />
      <p className="small muted" style={{ marginBottom: 16 }}>The latest 200 events: who signed in, opened a child’s record, wrote or downloaded a report. It never contains a child’s name.</p>
      <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
        {entries.map((e) => (
          <li key={e.id} className="small row" style={{ justifyContent: "space-between", gap: 12 }}>
            <span>
              <strong>{e.userName ?? "Someone not signed in"}</strong> · {e.action}
              {e.detail ? <span className="muted"> · {e.detail}</span> : null}
            </span>
            <span className="muted">{new Date(e.at).toLocaleString()}</span>
          </li>
        ))}
        {entries.length === 0 && <li className="muted">Nothing yet.</li>}
      </ul>
    </main>
  );
}
