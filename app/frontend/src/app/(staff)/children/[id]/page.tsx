import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import type { ChildProfile, ClassesView, WorkspaceInfo } from "@peterhouse/shared";
import { classLevel } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionCard, StatStrip } from "@/components/admin";
import { ChildAvatar, initials } from "@/components/ui";
import type { IconName } from "@/components/icons";
import { EditInfo, ProfileActions, SemestersTable } from "./Profile";

export const dynamic = "force-dynamic";

const longDate = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Whole years and months between two dates, as "4 years 3 months". */
function span(from: string, to: Date): string {
  const a = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  let months = (to.getUTCFullYear() - a.getUTCFullYear()) * 12 + to.getUTCMonth() - a.getUTCMonth();
  if (to.getUTCDate() < a.getUTCDate()) months--;
  if (months < 0) return "Not yet";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [y && `${y} ${y === 1 ? "year" : "years"}`, m && `${m} ${m === 1 ? "month" : "months"}`].filter(Boolean);
  return parts.length ? parts.join(" ") : "Under a month";
}

/** One child: who they are, every semester they were at school with its report, and who to call. */
export default async function ChildProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/");
  const [child, view] = await Promise.all([apiGet<ChildProfile>(`/admin/children/${id}`), apiGet<ClassesView>("/admin/classes")]);
  const now = new Date();
  const current = child.semesters.find((s) => s.current) ?? null;
  const latest = current ?? child.semesters[0] ?? null;
  const turns = child.dateOfBirth ? now.getUTCFullYear() - Number(child.dateOfBirth.slice(0, 4)) : null;

  const facts: { label: string; value: string; note?: string; icon: IconName }[] = [
    { icon: "calendar", label: "Birthday", value: child.dateOfBirth ? longDate(child.dateOfBirth) : "Not on file", note: child.dateOfBirth ? `${span(child.dateOfBirth, now)} old${turns ? `, turns ${turns} this year` : ""}` : undefined },
    { icon: "school", label: "Joined Peterhouse", value: longDate(child.joinedOn), note: `${span(child.joinedOn, now)} ago` },
    { icon: "camera", label: "Photo consent", value: child.photoConsent ? "Yes" : "No", note: child.photoConsent ? "photos print on the report" : "no photos on the report" },
    { icon: "semester", label: "Semesters", value: String(child.semesters.length), note: current ? "in a class now" : undefined },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8 md:pt-6">
      <BackLink fallback={{ href: "/children", label: "Children" }} />

      <header className="mb-5 mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <ChildAvatar src={child.photo} name={child.firstName || child.name} size={48} />
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                {child.name}
                {child.chineseName && <span className="ml-2.5 text-lg font-normal text-muted-foreground">{child.chineseName}</span>}
              </h1>
              {latest && (
                <Badge variant="outline" className="font-medium text-muted-foreground">
                  {classLevel(latest.level).name}
                </Badge>
              )}
              {child.left && <Badge variant="secondary">Left {child.leftAt ? longDate(child.leftAt) : ""}</Badge>}
            </div>
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              {latest && (
                <>
                  <Link href={`/classes/${latest.classId}`} className="font-medium text-foreground underline-offset-4 hover:text-foreground hover:underline">
                    {latest.className}
                  </Link>
                  {latest.teachers.length > 0 && <span>· {latest.teachers.join(", ")}</span>}
                  <span>·</span>
                </>
              )}
              <span>{child.pronoun === "she" ? "she / her" : "he / him"}</span>
            </p>
          </div>
        </div>
        <ProfileActions child={child} current={current} classes={view.classes} year={view.year} />
      </header>

      <StatStrip items={facts} />

      <div className="mt-6 grid gap-6">
        <SectionCard title="Semesters and reports" icon="semester" count={child.semesters.length}>
          <SemestersTable semesters={child.semesters} />
        </SectionCard>

        <div className="grid items-start gap-6 md:grid-cols-2">
          <SectionCard title="Parents and guardians" icon="users" count={child.guardians.length} action={<EditInfo child={child} />}>
            {child.guardians.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No parents or guardians on file yet.</p>
            ) : (
              <ul className="divide-y">
                {child.guardians.map((g, i) => (
                  <li key={i} className="flex gap-3 px-4 py-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs font-semibold">{initials(g.name || "?")}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 gap-1 text-sm">
                      <p className="font-medium">
                        {g.name || "No name"} {g.relationship && <span className="font-normal text-muted-foreground">· {g.relationship}</span>}
                      </p>
                      {g.phone && (
                        <a href={`tel:${g.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-foreground hover:text-foreground hover:underline">
                          <Phone className="size-3.5 text-muted-foreground" aria-hidden /> {g.phone}
                        </a>
                      )}
                      {g.email && (
                        <a href={`mailto:${g.email}`} className="inline-flex min-w-0 items-center gap-2 text-muted-foreground hover:text-foreground hover:underline">
                          <Mail className="size-3.5 shrink-0" aria-hidden /> <span className="break-all">{g.email}</span>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Staff notes" icon="info" action={<EditInfo child={child} />}>
            <div className="px-4 py-3 text-sm">
              {child.notes ? <p className="whitespace-pre-line">{child.notes}</p> : <p className="text-muted-foreground">No notes yet. Add pickup arrangements, allergies or anything staff should know.</p>}
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
