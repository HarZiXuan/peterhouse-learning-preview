import type { ChildListItem, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { ClassRail } from "./ClassRail";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const [info, { children: kids }] = await Promise.all([apiGet<WorkspaceInfo>("/workspace"), apiGet<{ children: ChildListItem[] }>("/children")]);
  return (
    <div className="shell">
      <ClassRail kids={kids} className={info.school.className} period={`${info.period.season} ${info.period.year}`} user={info.user} />
      <div className="stage">{children}</div>
    </div>
  );
}
