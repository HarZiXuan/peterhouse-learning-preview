import { redirect } from "next/navigation";
import type { SubjectsView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { SettingsSection } from "../SettingsSection";
import { SubjectsEditor } from "./SubjectsEditor";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const view = await apiGet<SubjectsView>("/admin/subjects");
  return (
    <SettingsSection
      title="Subjects"
      description="The subjects on each class’s weekly timetable. Add, rename, colour or hide them as the school needs. Who teaches which subject is set on each class."
    >
      <SubjectsEditor view={view} />
    </SettingsSection>
  );
}
