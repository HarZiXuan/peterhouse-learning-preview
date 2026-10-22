import { redirect } from "next/navigation";
import type { UserSummary, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AddPerson, People } from "../settings/people/People";

export const dynamic = "force-dynamic";

/** The administrator's teachers: who is in which class, how far their reports are, and their sign-ins. */
export default async function TeachersPage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/");
  const { users } = await apiGet<{ users: UserSummary[] }>("/admin/users");
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Everyone signs in with their own email and password. Accounts are deactivated, never deleted, so the record of who wrote each report is kept.</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">Teachers</h1>
        </div>
        <AddPerson />
      </header>
      <People initial={users} meId={user.id} defaultRole="teacher" />
    </main>
  );
}
