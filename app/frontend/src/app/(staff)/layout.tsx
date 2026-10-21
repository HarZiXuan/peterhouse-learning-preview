import type { ChildListItem, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { ClassRail } from "./ClassRail";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const [info, { children: kids }] = await Promise.all([apiGet<WorkspaceInfo>("/workspace"), apiGet<{ children: ChildListItem[] }>("/children")]);
  return (
    <ClassRail kids={kids} classes={info.classes} year={info.period.year} waiting={info.waiting} user={info.user}>
      {children}
    </ClassRail>
  );
}
