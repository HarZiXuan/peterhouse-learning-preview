import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { ChangePasswordForm } from "@/app/change-password/ChangePasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsSection } from "../SettingsSection";
import { MyPhoto } from "./MyPhoto";

export default async function AccountPage() {
  const { user, classes, myPhoto } = await apiGet<WorkspaceInfo>("/workspace");
  const admin = user.role === "admin";
  const rows: [string, React.ReactNode][] = [
    ["Name", user.name],
    ["Email", user.email],
    ["Role", admin ? "Administrator: sees every class and manages the school" : "Teacher"],
    ...(!admin
      ? [
          [
            "Classes",
            classes.length === 0
              ? "Not in a class yet"
              : classes.map((k) => `${k.name} (${k.lead?.id === user.id ? "lead" : k.co.some((c) => c.id === user.id) ? "co-teacher" : "subject teacher"})`).join(", "),
          ] as [string, React.ReactNode],
        ]
      : []),
  ];
  return (
    <SettingsSection title="My account" description="How you sign in. Your name is printed on the reports of your classes.">
      <div className="grid max-w-2xl gap-4">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-semibold">Your details</CardTitle>
            <CardDescription>{admin ? "Change them on People and sign-ins." : "Only an administrator can change these. Ask them if something is wrong."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <MyPhoto userId={user.id} photo={myPhoto} name={user.name} />
            <dl className="grid gap-3 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-semibold">Change password</CardTitle>
            <CardDescription>At least 10 characters. A few random words is a good idea.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm stay />
          </CardContent>
        </Card>
      </div>
    </SettingsSection>
  );
}
