import { redirect } from "next/navigation";
import type { UserSummary, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { SettingsSection } from "../SettingsSection";
import { People } from "./People";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const { users } = await apiGet<{ users: UserSummary[] }>("/admin/users");
  return (
    <SettingsSection
      title="People and sign-ins"
      description="Everyone signs in with their own email and password, so the activity log shows who did what. Only an administrator creates or changes accounts; teachers can change only their own password. Accounts are deactivated, never deleted, so the record of who wrote each report is kept."
    >
      <div className="max-w-3xl">
        <People initial={users} meId={user.id} />
      </div>
    </SettingsSection>
  );
}
