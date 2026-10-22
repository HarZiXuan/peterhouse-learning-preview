import { redirect } from "next/navigation";
import type { UserSummary, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AddPerson, People } from "../settings/people/People";
import { Icon } from "@/components/icons";

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
          <p className="text-sm text-muted-foreground">Each teacher signs in with their own email and password. Administrators are managed in Settings → People.</p>
          <h1 className="flex items-center gap-3 font-heading text-3xl font-bold tracking-tight md:text-4xl"><Icon name="teachers" size={30} />Teachers</h1>
        </div>
        <AddPerson teacher />
      </header>
      <People initial={users} meId={user.id} teachersOnly />
    </main>
  );
}
