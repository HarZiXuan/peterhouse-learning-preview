import Link from "next/link";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSettingsAction } from "../../actions";
import { SELECT } from "../../AddChild";
import { SettingsSection } from "../SettingsSection";

export default async function ReportDetailsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  const { school, period, user } = await apiGet<WorkspaceInfo>("/workspace");
  const admin = user.role === "admin";
  return (
    <SettingsSection title="Report details" description="Printed on every report. Each report also prints the child’s own class and its teachers.">
      <div className="grid max-w-2xl gap-4">
        {saved && (
          <Alert>
            <AlertDescription>Saved.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>Those details could not be saved.</AlertDescription>
          </Alert>
        )}
        {!admin && (
          <Alert>
            <AlertDescription>Only an administrator can change these. Ask them if something printed on the reports needs updating.</AlertDescription>
          </Alert>
        )}
        <form action={saveSettingsAction} className="grid gap-4">
          <fieldset disabled={!admin} className="contents">
            <Card className="shadow-none">
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="school">School name</Label>
                  <Input id="school" name="school" defaultValue={school.name} />
                </div>
                <div className="grid grid-cols-[1fr_7rem] gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="season">Reports for</Label>
                    <select id="season" className={SELECT} name="season" defaultValue={period.season}>
                      <option value="June">June report (January to June)</option>
                      <option value="December">December report (July to December)</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" name="year" type="number" defaultValue={period.year} />
                  </div>
                </div>
                {admin && (
                  <p className="text-sm text-muted-foreground">
                    Class names and teachers are set per class.{" "}
                    <Link className="underline underline-offset-4 hover:text-foreground" href="/classes">
                      Manage classes
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
          </fieldset>
          {admin && <Button className="justify-self-start">Save report details</Button>}
        </form>
      </div>
    </SettingsSection>
  );
}
