import Link from "next/link";
import { redirect } from "next/navigation";
import type { ApprovalsView, PeriodSummary, WorkspaceInfo } from "@peterhouse/shared";
import { reportPeriod } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsSection } from "../SettingsSection";
import { PeriodPicker, type PeriodOption } from "../PeriodPicker";

export default async function PeriodPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const { period, user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/settings");
  const [{ counts }, periods] = await Promise.all([apiGet<ApprovalsView>("/admin/approvals"), apiGet<PeriodSummary[]>("/admin/periods")]);
  const parts = [
    counts.waiting && `${counts.waiting} waiting for review`,
    counts.changes && `${counts.changes} with changes requested`,
    counts.not_submitted && `${counts.not_submitted} still with teachers`,
  ].filter(Boolean);
  const now = reportPeriod(period.season, period.year);
  const sem = (season: string) => (season === "June" ? 1 : 2);
  const have = new Map(periods.map((p) => [`${p.year}-${sem(p.season)}`, p]));
  const latest = periods[0]; // newest first
  const next = latest ? (sem(latest.season) === 1 ? { year: latest.year, semester: 2 as const } : { year: latest.year + 1, semester: 1 as const }) : null;
  const oldest = periods[periods.length - 1];
  const before = oldest && sem(oldest.season) === 2 ? { year: oldest.year, semester: 1 as const } : null; // an earlier year is not supported
  const years = [...periods.map((p) => p.year), ...(next ? [next.year] : [])];
  const options: PeriodOption[] = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    for (const semester of [1, 2] as const) {
      const p = have.get(`${y}-${semester}`);
      const state = p ? (p.current ? "now" : "exists") : (next && next.year === y && next.semester === semester) || (before && before.year === y && before.semester === semester) ? "new" : "none";
      options.push({ year: y, semester, state });
    }
  }

  return (
    <SettingsSection title="Report period" description="Pick the semester teachers are writing for. Semester 1 runs January to June and Semester 2 July to December. You can go back to an earlier one or forward again, and nothing is deleted.">
      <div className="grid max-w-2xl gap-4">
        {saved && (
          <Alert>
            <AlertDescription>The {now} are open. Every other period keeps its reports.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Now: {now}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {counts.approved} approved{parts.length ? `, ${parts.join(", ")}` : ", nothing left to do"}.{" "}
            <Link href="/reports" className="font-semibold text-foreground underline underline-offset-4">
              Open Reports
            </Link>
          </CardContent>
        </Card>

        <PeriodPicker options={options} />
      </div>
    </SettingsSection>
  );
}
