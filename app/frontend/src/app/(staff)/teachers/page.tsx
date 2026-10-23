import { redirect } from "next/navigation";
import type { UserSummary, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AddPerson, People } from "../settings/people/People";
import { PageTitle } from "@/components/admin";

export const dynamic = "force-dynamic";

/** The administrator's teachers: who is in which class, how far their reports are, and their sign-ins. */
export default async function TeachersPage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/");
  const { users } = await apiGet<{ users: UserSummary[] }>("/admin/users");
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8 md:pt-6">
      <header className="mb-5 mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <PageTitle icon="people">Teachers</PageTitle>
          <p className="text-sm text-muted-foreground sm:pl-[2.875rem]">Each teacher signs in with their own email and password. Administrators are managed in Settings → People.</p>
        </div>
        <AddPerson teacher />
      </header>
      <People initial={users} meId={user.id} teachersOnly />
    </main>
  );
}
