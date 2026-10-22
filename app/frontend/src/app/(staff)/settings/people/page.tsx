import { redirect } from "next/navigation";
import type { UserSummary, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { SettingsSection } from "../SettingsSection";
import { AddPerson, People } from "./People";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const { users } = await apiGet<{ users: UserSummary[] }>("/admin/users");
  return (
    <SettingsSection
      title="People and sign-ins"
      description="Everyone signs in with their own email and password. Accounts are deactivated, never deleted, so the record of who wrote each report is kept."
      action={<AddPerson />}
    >
      <People initial={users} meId={user.id} />
    </SettingsSection>
  );
}
