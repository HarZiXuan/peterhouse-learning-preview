import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ApprovalItem, TeacherDetail, WorkspaceInfo } from "@peterhouse/shared";
import { STATUS_LABEL } from "@peterhouse/shared";
import { apiGet, apiGetOrNull } from "@/lib/api";
import { SUBJECT_TINT } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const ROLE = { lead: "Lead teacher", co: "Co-teacher", subject: "Subject teacher" } as const;
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
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-4 md:px-10 md:pt-8">
      <BackLink fallback={{ href: "/teachers", label: "Teachers" }} />
      <header className="mb-6 mt-3">
        <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight md:text-4xl">{t.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span>{t.email}</span>
          <span>{t.role === "admin" ? "Administrator" : "Teacher"}</span>
          <span>Last signed in {t.lastLoginAt ? timeAgo(t.lastLoginAt) : "never"}</span>
          {!t.active && <Badge variant="outline">Deactivated</Badge>}
        </p>
      </header>

      <h2 className="mb-3 font-heading text-xl font-semibold">Classes</h2>
      {t.classes.length === 0 ? (
        <Card className="mb-8 border-dashed px-6 py-8 text-center text-muted-foreground shadow-none">Not in a class this semester.</Card>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {t.classes.map((k) => (
            <Card key={k.id} className="gap-2 p-4 shadow-none">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/classes/${k.id}`} className="font-heading text-lg font-semibold underline-offset-4 hover:underline">
                  {k.name}
                </Link>
                <span className="text-sm text-muted-foreground">{ROLE[k.role]}</span>
              </p>
              <p className="flex flex-wrap gap-1">
                {k.subjects?.length ? (
                  k.subjects.map((x) => (
                    <span key={x.name} className={cn("rounded-full border px-2.5 py-0.5 text-[13px] font-semibold", SUBJECT_TINT[x.color] ?? SUBJECT_TINT.stone)}>
                      {x.name}
                    </span>
                  ))
                ) : k.role === "subject" ? null : (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[13px] font-semibold">All subjects</span>
                )}
              </p>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-1 font-heading text-xl font-semibold">Reports</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {reports.length === 0 ? "No children in their classes yet." : `${done} of ${reports.length} approved. ${tally.slice(1).filter((x) => x.n).map((x) => `${x.n} ${x.label.toLowerCase()}`).join(", ")}`.replace(/\.\s*$/, ".")}
      </p>
      {reports.length > 0 && (
        <Card className="overflow-hidden p-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="px-4 font-bold text-foreground">Student</TableHead>
                <TableHead className="font-bold text-foreground">Class</TableHead>
                <TableHead className="font-bold text-foreground">Sent for review</TableHead>
                <TableHead className="px-4 font-bold text-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.reviewId} className="relative cursor-pointer">
                  <TableCell className="px-4 py-3">
                    <Link
                      href={STATUS_ORDER.includes(r.status) ? `/approvals/${r.reviewId}` : `/child/${r.reviewId}`}
                      className="font-heading text-base font-semibold text-foreground outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
                    >
                      {r.childName}
                    </Link>
                    {r.chineseName && <span className="ml-2 text-sm text-muted-foreground">{r.chineseName}</span>}
                  </TableCell>
                  <TableCell>{r.className}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{r.submittedAt ? `${timeAgo(r.submittedAt)}${r.submittedBy ? ` by ${r.submittedBy}` : ""}` : "—"}</TableCell>
                  <TableCell className="px-4">
                    <Badge
                      variant={r.status === "approved" ? "default" : "outline"}
                      className={cn("font-normal", r.status === "changes_requested" && "border-warn bg-warn/15", r.status === "submitted" && "border-primary/40 text-primary")}
                    >
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </main>
  );
}
