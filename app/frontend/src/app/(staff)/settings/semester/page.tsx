import Link from "next/link";
import { redirect } from "next/navigation";
import type { ApprovalsView, WorkspaceInfo } from "@peterhouse/shared";
import { reportPeriod } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { startNextSemesterAction } from "../../actions";
import { SettingsSection } from "../SettingsSection";
import { StartSemester } from "../StartSemester";

export default async function SemesterPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const { period, user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const { counts } = await apiGet<ApprovalsView>("/admin/approvals");
  const open = counts.waiting + counts.changes + counts.not_submitted;
  const parts = [
    counts.waiting && `${counts.waiting} waiting for review`,
    counts.changes && `${counts.changes} with changes requested`,
    counts.not_submitted && `${counts.not_submitted} not sent yet`,
  ].filter(Boolean);
  const now = reportPeriod(period.season, period.year);
  const next = period.season === "June" ? reportPeriod("December", period.year) : reportPeriod("June", period.year + 1);
  return (
    <SettingsSection title="Start next semester" description={`Closes the ${now} and opens the ${next}. This cannot be undone.`}>
      <div className="grid max-w-2xl gap-4">
        {saved && (
          <Alert>
            <AlertDescription>The {now} are closed. The new semester has started.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {open > 0 && !saved && (
          <Alert className="border-warn/60 bg-warn/10">
            <AlertDescription className="text-foreground">
              {open === 1 ? "1 report is" : `${open} reports are`} not approved yet: {parts.join(", ")}. If you start the next semester now they stay as they are, and families cannot get those PDFs.{" "}
              <Link href="/approvals" className="font-semibold underline underline-offset-4">
                Open Approvals
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <Card className="shadow-none">
          <CardContent className="grid gap-4">
            <ul className="grid list-disc gap-2 pl-5 text-sm text-muted-foreground">
              <li>Every child keeps all of this semester’s ratings, comments and report. The new report shows them beside the new ratings, so progress is visible.</li>
              <li>{counts.approved} approved {counts.approved === 1 ? "report is" : "reports are"} kept as the record of the {now}.</li>
              {period.season === "December" ? (
                <li>It is a new year, so every class moves up a level with its children and teachers (K1 Sunflower becomes K2 Sunflower). K2 children are marked as left for primary school.</li>
              ) : (
                <li>Classes, teachers and children stay exactly as they are.</li>
              )}
            </ul>
            <div>
              <StartSemester action={startNextSemesterAction} />
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsSection>
  );
}
