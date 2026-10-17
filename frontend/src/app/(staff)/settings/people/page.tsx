import Link from "next/link";
import { redirect } from "next/navigation";
import type { UserSummary, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { People } from "./People";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const { users } = await apiGet<{ users: UserSummary[] }>("/admin/users");
  return (
    <main className="board board-narrow">
      <p className="crumbs">
        <Link href="/settings">← Settings</Link>
      </p>
      <h1>People and sign-ins</h1>
      <div className="rule" />
      <p className="small muted" style={{ marginBottom: 16 }}>
        Everyone signs in with their own email and password, so the activity log shows who did what. A new person must choose their own password the first time they sign in.
      </p>
      <People initial={users} meId={user.id} />
    </main>
  );
}
