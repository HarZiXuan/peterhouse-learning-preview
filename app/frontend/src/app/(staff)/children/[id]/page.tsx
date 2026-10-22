import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import type { ChildProfile, ClassesView, WorkspaceInfo } from "@peterhouse/shared";
import { STATUS_LABEL, classLevel } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { ChildAvatar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LEVEL_TINT, STATUS_TONE } from "../../classes/shared";
import { EditInfo, ProfileActions } from "./Profile";

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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="grid content-start gap-1 px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold leading-tight">{value}</p>
      {sub && <p className="text-[13px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="gap-3 p-5 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

const Missing = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{children}</p>;

/** One child: who they are, every semester they were at school with its report, and who to call. */
export default async function ChildProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/");
  const [child, view] = await Promise.all([apiGet<ChildProfile>(`/admin/children/${id}`), apiGet<ClassesView>("/admin/classes")]);
  const now = new Date();
  const current = child.semesters.find((s) => s.current) ?? null;
  const latest = current ?? child.semesters[0] ?? null;
  const approved = child.semesters.filter((s) => s.status === "approved").length;
  const turns = child.dateOfBirth ? now.getUTCFullYear() - Number(child.dateOfBirth.slice(0, 4)) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-10">
      <BackLink fallback={{ href: "/children", label: "Children" }} className="mb-4" />

      <Card className="mb-6 gap-0 overflow-hidden p-0 shadow-none">
        <div className="flex flex-wrap items-start gap-5 p-5 md:p-6">
          <ChildAvatar name={child.name} size={88} />
          <div className="grid min-w-0 flex-1 basis-60 gap-2">
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              {child.name}
              {child.chineseName && <span className="ml-3 font-medium text-muted-foreground">{child.chineseName}</span>}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {latest && <Badge className={cn("border-transparent font-bold", LEVEL_TINT[latest.level])}>{latest.level}</Badge>}
              {latest && (
                <Link href={`/classes/${latest.classId}`} className="font-semibold text-foreground underline-offset-4 hover:underline">
                  {latest.className}
                </Link>
              )}
              {latest && latest.teachers.length > 0 && <span className="text-muted-foreground">· {latest.teachers.join(", ")}</span>}
              <span className="text-muted-foreground">· {child.pronoun === "she" ? "she / her" : "he / him"}</span>
              {child.left && <Badge variant="outline" className="font-normal">Left {child.leftAt ? longDate(child.leftAt) : ""}</Badge>}
            </div>
          </div>
          <ProfileActions child={child} current={current} classes={view.classes} year={view.year} />
        </div>
        <div className="grid grid-cols-2 border-t md:grid-cols-4 [&>*:nth-child(n+2)]:border-l max-md:[&>*:nth-child(3)]:border-l-0 max-md:[&>*:nth-child(n+3)]:border-t">
          <Stat label="Age" value={child.dateOfBirth ? span(child.dateOfBirth, now) : "—"} sub={turns ? `Turns ${turns} in ${now.getUTCFullYear()}` : "No birthday on file"} />
          <Stat label="Birthday" value={child.dateOfBirth ? longDate(child.dateOfBirth) : "—"} sub={latest ? classLevel(latest.level).name : undefined} />
          <Stat label="Joined" value={longDate(child.joinedOn)} sub={`${span(child.joinedOn, now)} at Peterhouse`} />
          <Stat label="Reports" value={`${approved} approved`} sub={`${child.semesters.length} ${child.semesters.length === 1 ? "semester" : "semesters"} at school`} />
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Section title="Semesters and reports">
          {child.semesters.length === 0 ? (
            <Missing>No semesters yet.</Missing>
          ) : (
            <ul className="-mx-5 divide-y border-t">
              {child.semesters.map((s) => (
                <li key={s.reviewId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold">
                      {s.year} · Semester {s.semester}
                      {s.current && <span className="ml-2 text-[13px] font-normal text-muted-foreground">this semester</span>}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {s.level} · {s.className}
                      {s.teachers.length > 0 && ` · ${s.teachers.join(", ")}`}
                    </p>
                  </div>
                  <Badge className={cn("whitespace-nowrap font-normal", STATUS_TONE[s.status])}>{STATUS_LABEL[s.status]}</Badge>
                  <Link href={s.hasReport ? `/child/${s.reviewId}/report` : `/child/${s.reviewId}`} className="w-24 text-right text-sm font-semibold text-primary hover:underline">
                    {s.hasReport ? "Open report" : "Open review"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="grid gap-6">
          <Section title="Parents and guardians" action={<EditInfo child={child} />}>
            {child.guardians.length === 0 ? (
              <Missing>No parents or guardians on file yet.</Missing>
            ) : (
              <ul className="grid gap-3">
                {child.guardians.map((g, i) => (
                  <li key={i} className="grid gap-0.5 text-sm">
                    <p className="font-semibold">
                      {g.name || "No name"} {g.relationship && <span className="font-normal text-muted-foreground">· {g.relationship}</span>}
                    </p>
                    {g.phone && (
                      <a href={`tel:${g.phone.replace(/\s/g, "")}`} className="text-foreground hover:underline">
                        {g.phone}
                      </a>
                    )}
                    {g.email && (
                      <a href={`mailto:${g.email}`} className="break-all text-muted-foreground hover:underline">
                        {g.email}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>


          <Section title="Staff notes" action={<EditInfo child={child} />}>
            {child.notes ? <p className="whitespace-pre-line text-sm">{child.notes}</p> : <Missing>No notes yet. Add pickup arrangements or anything staff should know.</Missing>}
          </Section>
        </div>
      </div>
    </main>
  );
}
