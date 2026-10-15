import { listChildren, getReportPeriod } from "@/lib/workspace";
import { getSchool } from "@/lib/school";
import { ClassRail } from "./ClassRail";

export const dynamic = "force-dynamic";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const kids = listChildren();
  const period = getReportPeriod();
  return (
    <div className="shell">
      <ClassRail kids={kids} className={getSchool().className} period={`${period.season} ${period.year}`} />
      <div className="stage">{children}</div>
    </div>
  );
}
