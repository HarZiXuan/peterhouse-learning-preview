import Link from "next/link";
import type { ChildListItem, PeriodSummary, WorkspaceInfo } from "@peterhouse/shared";
import { reportPeriod } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAB } from "@/components/ui/tab-styles";
import { Filters } from "./Filters";
import { Timeline } from "./Timeline";
import { ReportsTable } from "./ReportsTable";
import { myWorkDone, partOnly, readyToSend } from "./reportState";
import { Icon } from "@/components/icons";

export type TeacherParams = { term?: string; class?: string; show?: string; q?: string; sort?: string; dir?: string };
type Show = "all" | "todo" | "send" | "changes" | "ready";

/**
 * A teacher's Reports page: every child in the classes they teach, one semester at a time, with how far each report is.
 * The current semester is where they write; an earlier one can be opened to read its reports and download the family PDF.
 */
export async function TeacherReports({ sp, period }: { sp: TeacherParams; period: WorkspaceInfo["period"] }) {
  const periods = await apiGet<PeriodSummary[]>("/my/periods");
  const now = periods.find((p) => p.current);
  const shown = periods.find((p) => p.termId === Number(sp.term) && !p.current) ?? now;
  const past = shown && !shown.current ? shown : undefined;
  const { children: all } = await apiGet<{ children: ChildListItem[] }>(past ? `/children?termId=${past.termId}` : "/children");

  // The classes of the semester on view, from its children: an earlier semester had classes of its own.
  const classes = [...new Map(all.map((c) => [c.classId, c.className])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const current = classes.find((k) => k.id === Number(sp.class)) ?? null;
  const kids = current ? all.filter((c) => c.classId === current.id) : all;
  const show: Show = sp.show === "todo" || sp.show === "send" || sp.show === "changes" || sp.show === "ready" ? sp.show : "all";
  const ready = kids.filter((c) => myWorkDone(c) && !readyToSend(c)).length;
  const toSend = past ? 0 : kids.filter(readyToSend).length;
  const sentBack = kids.filter((c) => c.status === "changes_requested" && !partOnly(c));
  const q = (sp.q ?? "").trim().toLowerCase();
  const multi = !current && classes.length > 1;
  const list = kids
    .filter((c) =>
      show === "ready" ? myWorkDone(c) && !readyToSend(c) : show === "send" ? readyToSend(c) : show === "todo" ? !myWorkDone(c) || readyToSend(c) : show === "changes" ? c.status === "changes_requested" && !partOnly(c) : true,
    )
    .filter((c) => !q || `${c.name} ${c.chineseName}`.toLowerCase().includes(q));
  const nextUp = past ? undefined : kids.find((c) => !myWorkDone(c) || readyToSend(c));

  // Every link keeps the rest of the address, with the given parts changed (an empty value removes one).
  const href = (change: Partial<Record<keyof TeacherParams, string>>) => {
    const next = new URLSearchParams();
    const merged: TeacherParams = { ...(past ? { term: String(past.termId) } : {}), ...(current ? { class: String(current.id) } : {}), ...(show !== "all" ? { show } : {}), ...(sp.q ? { q: sp.q } : {}), ...change };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/reports?${s}` : "/reports";
  };

  const filters: { show: Show; label: string; n: number }[] = [
    { show: "all", label: "Everyone", n: kids.length },
    { show: "todo", label: past ? "Not written" : "To do", n: kids.length - ready },
    ...(kids.some((c) => !partOnly(c)) ? [{ show: "send" as const, label: "Ready to send", n: toSend }] : []),
    { show: "changes", label: "Changes requested", n: sentBack.length },
    { show: "ready", label: kids.every(partOnly) ? "Parts sent" : "Done", n: ready },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">{past ? `${reportPeriod(past.season, past.year)} · past semester` : `${reportPeriod(period.season, period.year)} · ongoing`}</p>
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold tracking-tight md:text-4xl"><Icon name="reports" size={30} />Children’s reports</h1>
        <p className="mt-1 max-w-xl text-muted-foreground">
          {past ? "What was written for your classes in this semester. Open a report to read it, or download the family PDF once it is approved." : "Rate each child, write their report and send it for review. Choose an earlier semester to see its reports."}
        </p>
      </header>

      {shown && periods.length > 0 && <Timeline periods={periods} selected={shown.termId} teacher />}

      {all.length === 0 ? (
        <Card className="items-center gap-3 border-dashed px-6 py-12 text-center shadow-none">
          <h2 className="font-heading text-xl font-semibold">{past ? "No reports in this semester" : "No children yet"}</h2>
          <p className="max-w-md text-muted-foreground">{past ? "None of your classes had children in this semester." : "The administrator adds the children to your class. They appear here as soon as they are added."}</p>
        </Card>
      ) : (
        <section aria-label="Children" className="grid min-w-0 gap-4">
          {/* A report the administrator sent back is the first thing to deal with. */}
          {!past && sentBack.length > 0 && show !== "changes" && (
            <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-primary/40 bg-primary/[0.07] px-5 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <CircleAlert className="size-5" aria-hidden />
              </span>
              <p className="min-w-60 flex-1">
                <b className="font-heading text-lg text-primary">
                  {sentBack.length === 1 ? `${sentBack[0].name}’s report needs changes` : `${sentBack.length} reports need changes`}
                </b>
                <span className="block text-sm text-foreground/80">The administrator sent {sentBack.length === 1 ? "it" : "them"} back with a note. Make the changes and send {sentBack.length === 1 ? "it" : "them"} for review again.</span>
              </p>
              <Button asChild className="h-10 px-5 font-bold">
                <Link href={sentBack.length === 1 ? `/child/${sentBack[0].reviewId}/report` : href({ show: "changes" })}>{sentBack.length === 1 ? "Fix report" : "See them"}</Link>
              </Button>
            </div>
          )}

          {/* The status tabs and the name search share one row, on the line above the table. */}
          <div className="mb-1 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b">
            <nav className="-mb-px flex gap-1 overflow-x-auto overflow-y-hidden" aria-label="Show">
              {filters.map((f) => (
                <Link key={f.show} href={href({ show: f.show === "all" ? "" : f.show })} aria-current={show === f.show ? "true" : undefined} className={TAB}>
                  {f.label}{" "}
                  {(f.show === "changes" || f.show === "send") && f.n > 0 && !past ? (
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground">{f.n}</span>
                  ) : (
                    <span className={cn("font-semibold tabular-nums", f.show === "todo" && f.n > 0 && !past ? "text-primary" : "text-muted-foreground")}>{f.n}</span>
                  )}
                </Link>
              ))}
            </nav>
            <Filters classes={classes} teachers={[]} className="mb-0 w-full pb-2 sm:w-auto sm:min-w-[28rem]" />
          </div>

          {list.length === 0 && q ? (
            <Card className="items-center gap-2 border-dashed px-6 py-10 text-center shadow-none">
              <h2 className="font-heading text-xl font-semibold">No one matches</h2>
              <p className="text-muted-foreground">Try a different name or clear the search.</p>
            </Card>
          ) : list.length === 0 ? (
            <Card className="items-center gap-3 border-dashed px-6 py-12 text-center shadow-none">
              {show === "changes" ? (
                <>
                  <h2 className="font-heading text-xl font-semibold">Nothing sent back</h2>
                  <p className="text-muted-foreground">When the administrator asks for changes to a report, it shows up here.</p>
                </>
              ) : show === "send" ? (
                <>
                  <h2 className="font-heading text-xl font-semibold">Nothing waiting to send</h2>
                  <p className="text-muted-foreground">A report shows up here once you have written it. Press Send for review and the office can approve it.</p>
                </>
              ) : show === "todo" ? (
                <>
                  <h2 className="font-heading text-xl font-semibold">{past ? "Every report was written" : "All caught up"}</h2>
                  <p className="text-muted-foreground">{past ? "Every child in this semester has a report." : "Your reports are written and your parts are sent, so there is nothing left to do."}</p>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-xl font-semibold">No reports yet</h2>
                  <p className="max-w-md text-muted-foreground">{past ? "No report was written in this semester." : "A report appears here once a child’s statements are all rated and you press Write report."}</p>
                  {nextUp && (
                    <Button asChild>
                      <Link href={`/child/${nextUp.reviewId}`}>{nextUp.answered ? `Continue with ${nextUp.name}` : `Start with ${nextUp.name}`}</Link>
                    </Button>
                  )}
                </>
              )}
            </Card>
          ) : (
            <Card className="gap-0 overflow-hidden py-0 shadow-none">
              <ReportsTable list={list} showClass={multi} past={!!past} />
            </Card>
          )}
        </section>
      )}
    </main>
  );
}
