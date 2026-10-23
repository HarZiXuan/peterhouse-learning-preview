import { notFound, redirect } from "next/navigation";
import type { ApprovalItem, TeacherDetail, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet, apiGetOrNull } from "@/lib/api";
import { ChildAvatar, timeAgo } from "@/components/ui";
import { TeacherActions } from "./TeacherActions";
import { TeacherClassesTable, TeacherReportsTable } from "./TeacherTables";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { SectionCard, StatStrip } from "@/components/admin";

export const dynamic = "force-dynamic";

const STATUS_ORDER: ApprovalItem["status"][] = ["submitted", "changes_requested", "approved"];

/** One teacher: their classes and subjects, and where the reports of their children have got to. */
export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { user: me } = await apiGet<WorkspaceInfo>("/workspace");
  if (me.role !== "admin") redirect("/");
  const { data } = await apiGetOrNull<TeacherDetail>(`/admin/users/${id}/detail`);
  if (!data) notFound();
  const { user: t, reports } = data;
  const done = reports.filter((r) => r.status === "approved").length;
  const rank = (r: ApprovalItem) => (STATUS_ORDER.includes(r.status) ? STATUS_ORDER.indexOf(r.status) : STATUS_ORDER.length);
  const rows = [...reports].sort((a, b) => rank(a) - rank(b) || a.className.localeCompare(b.className) || a.childName.localeCompare(b.childName));
  const tally = [
    { label: "Approved", n: done },
    { label: "Waiting for review", n: reports.filter((r) => r.status === "submitted").length },
    { label: "Changes requested", n: reports.filter((r) => r.status === "changes_requested").length },
    { label: "With teachers", n: reports.filter((r) => !STATUS_ORDER.includes(r.status)).length },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8 md:pt-6">
      <BackLink fallback={{ href: "/teachers", label: "Teachers" }} />

      <header className="mb-5 mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <ChildAvatar src={t.photo} name={t.name} size={48} />
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">{t.name}</h1>
              <Badge variant="outline" className="font-medium text-muted-foreground">
                {t.role === "admin" ? "Administrator" : "Teacher"}
              </Badge>
              {!t.active && <Badge variant="secondary">Deactivated</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {t.email} · Last signed in {t.lastLoginAt ? timeAgo(t.lastLoginAt) : "never"}
            </p>
          </div>
        </div>
        <TeacherActions user={t} isMe={t.id === me.id} />
      </header>

      <StatStrip
        items={[
          { label: "Classes", value: t.classes.length, icon: "classes" },
          { label: "Approved", value: `${done} / ${reports.length}`, icon: "check" },
          { label: "Waiting for review", value: tally[1].n, icon: "reviews" },
          { label: "Changes requested", value: tally[2].n, icon: "edit" },
        ]}
      />

      <div className="mt-6 grid gap-6">
        <SectionCard title="Classes" icon="classes" count={t.classes.length} description="Where they teach this semester and which subjects they rate.">
          <TeacherClassesTable classes={t.classes} />
        </SectionCard>

        <SectionCard
          title="Reports"
          icon="reports"
          count={reports.length}
          description={reports.length === 0 ? "No children in their classes yet." : `${done} of ${reports.length} approved${tally.slice(1).some((x) => x.n) ? `, ${tally.slice(1).filter((x) => x.n).map((x) => `${x.n} ${x.label.toLowerCase()}`).join(", ")}` : ""}.`}
        >
          <TeacherReportsTable reports={rows} />
        </SectionCard>
      </div>
    </main>
  );
}
