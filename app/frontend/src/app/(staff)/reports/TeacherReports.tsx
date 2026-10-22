import Link from "next/link";
import type { ChildListItem, PeriodSummary, WorkspaceInfo } from "@peterhouse/shared";
import { reportPeriod } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { ChildAvatar, timeAgo } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAB } from "@/components/ui/tab-styles";
import { Filters } from "./Filters";
import { SendNow } from "./SendNow";
import { Timeline } from "./Timeline";
import { Icon } from "@/components/icons";

export type TeacherParams = { term?: string; class?: string; show?: string; q?: string; sort?: string; dir?: string };
type Show = "all" | "todo" | "send" | "changes" | "ready";

// A teacher who is not the class's lead does their own part only: their areas, sent to the lead.
const partOnly = (c: ChildListItem) => !c.iAmLead;
// A part is only owed while the report is still being put together (not once it is written, sent or taken over).
const partsLeft = (c: ChildListItem) => (c.partsOpen ? c.myParts.filter((p) => !p.done) : []);

const stateKey = (c: ChildListItem) =>
  c.status === "approved"
    ? "approved"
    : c.status === "submitted"
      ? "waiting"
      : c.status === "changes_requested" && !partOnly(c)
        ? "changes"
        : partOnly(c)
          ? partsLeft(c).length
            ? "in_progress"
            : "written"
          : c.hasReport
            ? c.status === "written" && !c.takenOver
              ? "send"
              : "written"
            : c.waitingFor.length
              ? "in_progress"
              : c.answered === c.total
                ? "ready"
                : c.answered === 0
                  ? "not_started"
                  : "in_progress";

const STATE_TONE: Record<string, string> = {
  approved: "border-transparent bg-success text-white",
  waiting: "border-transparent bg-[#f5e1e2] text-[#8c1a22]",
  changes: "border-warn/60 bg-warn/15 text-foreground",
  written: "border-transparent bg-[#dcefe2] text-[#1f5236]",
  send: "border-transparent bg-[#fdecb3] text-[#5a4300]",
  ready: "border-transparent bg-[#fdecb3] text-[#5a4300]",
  in_progress: "border-transparent bg-[#dbeef9] text-[#0a3a57]",
  not_started: "border-transparent bg-primary text-primary-foreground",
};

function stateLabel(c: ChildListItem, past: boolean) {
  if (c.status === "approved") return "Approved";
  if (c.status === "submitted") return "Sent for review";
  if (c.takenOver) return "Taken over by the office";
  if (partOnly(c)) {
    if (!c.myParts.length) return "Not your areas";
    if (!c.partsOpen && c.myParts.some((p) => !p.done)) return c.hasReport ? "Written by the lead" : "With the lead";
    const left = partsLeft(c);
    return left.length ? `Your part: ${left.map((p) => p.area).join(", ")}` : "Your part is sent";
  }
  if (c.status === "changes_requested") return "Changes requested";
  if (readyToSend(c) && !past) return "Ready to send";
  if (!c.hasReport && c.waitingFor.length) return `Waiting for ${[...new Set(c.waitingFor.map((w) => w.teacher))].join(", ")}`;
  if (c.hasReport) return "Report written";
  if (past) return "Not written";
  if (c.answered === c.total) return "Ready to write";
  return c.answered === 0 ? "Not started" : `${c.areas.filter((a) => a.answered === a.total).length} of ${c.areas.length} areas rated`;
}

const STATE_RANK: Record<string, number> = { not_started: 0, in_progress: 1, ready: 2, send: 3, written: 3, changes: 4, waiting: 5, approved: 6 };
type SortKey = "name" | "class" | "areas" | "status" | "sent";
const SORT_KEYS: SortKey[] = ["name", "class", "areas", "status", "sent"];

// The areas that are this person's to rate: all of them for the lead, only their own for another teacher.
const myAreas = (c: ChildListItem) => (partOnly(c) ? c.areas.filter((a) => c.myParts.some((p) => p.area === a.name)) : c.areas);
const ratedAreas = (c: ChildListItem) => myAreas(c).filter((a) => a.answered === a.total).length;
/** Nothing left for this person: the lead has written the report, another teacher has sent every part of theirs, or the office took it over. */
/** The lead has written the report but not sent it for review yet: the step that is easy to miss. */
const readyToSend = (c: ChildListItem) => !partOnly(c) && !c.takenOver && c.hasReport && c.status === "written";
const myWorkDone = (c: ChildListItem) => c.takenOver || (partOnly(c) ? partsLeft(c).length === 0 : c.hasReport);

function compare(a: ChildListItem, b: ChildListItem, key: SortKey) {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "class":
      return a.className.localeCompare(b.className) || a.name.localeCompare(b.name);
    case "areas":
      return ratedAreas(a) - ratedAreas(b) || a.name.localeCompare(b.name);
    case "status":
      return STATE_RANK[stateKey(a)] - STATE_RANK[stateKey(b)] || a.name.localeCompare(b.name);
    case "sent":
      return (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "") || a.name.localeCompare(b.name);
  }
}

/** A column heading that sorts the table: click for ascending, again for descending. */
function SortHead({ label, k, sort, dir, href, className }: { label: string; k: SortKey; sort: SortKey; dir: "asc" | "desc"; href: (key: SortKey) => string; className?: string }) {
  const on = sort === k;
  const Arrow = !on ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("h-11 text-xs font-extrabold uppercase tracking-wider text-muted-foreground", className)}>
      <Link href={href(k)} className={cn("inline-flex items-center gap-1.5 rounded-md py-1 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50", on && "text-foreground")}>
        {label}
        <Arrow className={cn("size-3.5", !on && "opacity-50")} aria-hidden />
      </Link>
    </TableHead>
  );
}

/** How many learning areas are fully rated, as a ring with the count inside. */
function AreaRing({ rated, total }: { rated: number; total: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const done = total > 0 && rated === total;
  return (
    <span className="relative inline-grid size-11 place-items-center" role="img" aria-label={`${rated} of ${total} areas rated`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={done ? "var(--success)" : "#2c5f80"} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(total ? rated / total : 0) * c} ${c}`} />
      </svg>
      <span className="text-[11px] font-extrabold tabular-nums">
        {rated}/{total}
      </span>
    </span>
  );
}

/** One child as a row: who they are, their class, how far the report is, and the one button that moves it on. */
function ChildTableRow({ c, showClass, past }: { c: ChildListItem; showClass: boolean; past: boolean }) {
  const complete = c.answered === c.total;
  const key = stateKey(c);
  // An earlier semester can no longer be written: a report that was never written has nothing to open.
  const primary = partOnly(c)
    ? c.myParts.length && !past
      ? { href: `/child/${c.reviewId}`, label: partsLeft(c).length ? "Do my part" : "Open" }
      : null
    : c.hasReport ? { href: `/child/${c.reviewId}/report`, label: c.status === "changes_requested" && !past ? "Fix report" : "Open report" } : past ? null : { href: `/child/${c.reviewId}`, label: complete ? "Write report" : c.answered === 0 ? "Start" : "Continue" };
  return (
    <TableRow>
      <TableCell className="py-3">
        <Link href={primary?.href ?? `/child/${c.reviewId}`} aria-label={`${c.name}: ${stateLabel(c, past)}`} className="flex items-center gap-3 text-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <ChildAvatar src={c.photo} name={c.name} size={44} />
          <span className="min-w-0 font-heading text-base font-bold leading-tight">
            {c.name} {c.chineseName && <span className="ml-1 text-sm font-normal text-muted-foreground">{c.chineseName}</span>}
          </span>
        </Link>
      </TableCell>
      {showClass && <TableCell className="hidden text-sm md:table-cell">{c.className}</TableCell>}
      <TableCell className="hidden md:table-cell">
        <AreaRing rated={ratedAreas(c)} total={myAreas(c).length} />
      </TableCell>
      <TableCell>
        <Badge className={cn("h-7 gap-1.5 whitespace-nowrap px-3 text-[13px] font-bold", STATE_TONE[key])}>
          {key === "not_started" && <CircleAlert className="size-3.5" aria-hidden />}
          {stateLabel(c, past)}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
        {c.submittedAt ? (
          <>
            {c.submittedBy ?? "A teacher"}
            <span className="block">{timeAgo(c.submittedAt)}</span>
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-right">
        {readyToSend(c) && !past ? (
          <SendNow reviewId={c.reviewId} childName={c.name} />
        ) : primary && (
          <Button asChild variant={(!c.hasReport && (complete || c.answered === 0)) || (c.status === "changes_requested" && !past) ? "default" : "outline"} className="h-10 min-w-32 px-4 font-bold">
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}


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
  const sort: SortKey = SORT_KEYS.find((k) => k === sp.sort) ?? (multi ? "class" : "name");
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";
  const list = kids
    .filter((c) =>
      show === "ready" ? myWorkDone(c) && !readyToSend(c) : show === "send" ? readyToSend(c) : show === "todo" ? !myWorkDone(c) || readyToSend(c) : show === "changes" ? c.status === "changes_requested" && !partOnly(c) : true,
    )
    .filter((c) => !q || `${c.name} ${c.chineseName}`.toLowerCase().includes(q))
    .sort((a, b) => (dir === "asc" ? 1 : -1) * compare(a, b, sort));
  const nextUp = past ? undefined : kids.find((c) => !myWorkDone(c) || readyToSend(c));

  // Every link keeps the rest of the address, with the given parts changed (an empty value removes one).
  const href = (change: Partial<Record<keyof TeacherParams, string>>) => {
    const next = new URLSearchParams();
    const merged: TeacherParams = { ...(past ? { term: String(past.termId) } : {}), ...(current ? { class: String(current.id) } : {}), ...(show !== "all" ? { show } : {}), ...(sp.q ? { q: sp.q } : {}), ...(sp.sort ? { sort, dir } : {}), ...change };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/reports?${s}` : "/reports";
  };
  const sortHref = (key: SortKey) => href({ sort: key, dir: sort === key && dir === "asc" ? "desc" : "asc" });

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
            <div className="overflow-hidden rounded-[18px] border bg-card">
              <Table>
                <TableHeader className="bg-secondary/40">
                  <TableRow className="hover:bg-transparent">
                    <SortHead label="Child" k="name" sort={sort} dir={dir} href={sortHref} className="pl-4" />
                    {multi && <SortHead label="Class" k="class" sort={sort} dir={dir} href={sortHref} className="hidden md:table-cell" />}
                    <SortHead label="Areas rated" k="areas" sort={sort} dir={dir} href={sortHref} className="hidden md:table-cell" />
                    <SortHead label="Learning report" k="status" sort={sort} dir={dir} href={sortHref} />
                    <SortHead label="Sent for review" k="sent" sort={sort} dir={dir} href={sortHref} className="hidden lg:table-cell" />
                    <TableHead className="w-40" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((c) => (
                    <ChildTableRow key={c.reviewId} c={c} showClass={multi} past={!!past} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
