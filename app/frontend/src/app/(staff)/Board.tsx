import Link from "next/link";
import type { ChildListItem, WorkspaceInfo } from "@peterhouse/shared";
import { semesterLabel } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUBJECT_SWATCH } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

const ROLE: Record<"lead" | "co" | "subject", { label: string; className: string }> = {
  lead: { label: "Lead teacher", className: "bg-[#dbeef9] text-[#0a3a57]" },
  co: { label: "Co-teacher", className: "bg-[#e9e3f5] text-[#3b2a63]" },
  subject: { label: "Subject teacher", className: "bg-[#fde3d7] text-[#6b2a10]" },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A teacher's home: the classes they teach this semester, each with how many of its reports are written. The reports themselves are on Reports. */
export async function Board() {
  const [info, { children: all }] = await Promise.all([apiGet<WorkspaceInfo>("/workspace"), apiGet<{ children: ChildListItem[] }>("/children")]);
  const { period, hasAi, classes } = info;
  const togo = all.filter((c) => !c.hasReport).length;
  const perClass = classes.map((k) => {
    const mine = all.filter((c) => c.classId === k.id);
    return { k, n: mine.length, done: mine.filter((c) => c.hasReport).length };
  });

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <p className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            {semesterLabel(period.season)} · {period.year}
            <Badge className="border-transparent bg-[#dcefe2] px-2.5 text-[11px] font-extrabold normal-case tracking-normal text-[#1f5236]">
              Ongoing · {period.season === "June" ? "January – June" : "July – December"}
            </Badge>
          </p>
          <h1 className="flex items-center gap-3 font-heading text-4xl font-bold leading-tight tracking-tight md:text-[44px]"><Icon name="class" size={30} />My classes</h1>
          <p className="text-[17px] text-foreground/80">
            {classes.length === 0 ? (
              "You are not in a class yet."
            ) : (
              <>
                You teach <b>{plural(classes.length, "class", "classes")}</b> and <b>{plural(all.length, "child", "children")}</b>.{" "}
                {all.length === 0 ? "No children have been added yet." : togo === 0 ? <b className="text-success">Every learning report is written.</b> : <><b className="text-primary">{plural(togo, "learning report is", "learning reports are")}</b> still to do.</>}
              </>
            )}
          </p>
        </div>
        {all.length > 0 && (
          <Button asChild className="h-11 px-5 font-bold">
            <Link href="/reports">Go to reports</Link>
          </Button>
        )}
      </header>

      {classes.length === 0 ? (
        <Card className="items-center gap-3 border-dashed px-6 py-12 text-center shadow-none">
          <h2 className="font-heading text-xl font-semibold">Not in a class yet</h2>
          <p className="max-w-md text-muted-foreground">Ask the administrator to add you to your class. Its children then appear here.</p>
        </Card>
      ) : (
        <section aria-label="My classes" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(18.5rem,1fr))]">
          {perClass.map(({ k, n, done }) => {
            const left = n - done;
            return (
              <Link
                key={k.id}
                href={`/reports?class=${k.id}`}
                className="grid gap-3 rounded-[20px] border bg-card px-[22px] py-5 text-foreground outline-none transition-[border-color,box-shadow] hover:border-foreground/25 hover:text-foreground hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-heading text-2xl font-semibold leading-tight">{k.name}</span>
                  <Badge className={cn("shrink-0 border-transparent px-3 text-[12.5px] font-extrabold", n === 0 ? "bg-secondary text-muted-foreground" : left === 0 ? "bg-[#dcefe2] text-[#1f5236]" : "bg-[#fff1c2] text-[#4d3700]")}>{n === 0 ? "No children yet" : left === 0 ? "All done" : `${left} to do`}</Badge>
                </span>
                {k.myRole && (
                  <span className="grid gap-1.5">
                    <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted-foreground">
                      <Badge className={cn("border-transparent px-2.5 font-bold", ROLE[k.myRole].className)}>{ROLE[k.myRole].label}</Badge>
                      {k.mySubjects.length === 0 ? (
                        <span>
                          Teaches <b className="font-bold text-foreground">all subjects</b>
                        </span>
                      ) : (
                        <>
                          <span>Teaches</span>
                          {k.mySubjects.map((x) => (
                            <span key={x.name} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-bold text-foreground">
                              <span className="size-2 rounded-full" style={{ background: SUBJECT_SWATCH[x.color] }} aria-hidden />
                              {x.name}
                            </span>
                          ))}
                        </>
                      )}
                    </span>
                    {k.myRole === "subject" && <span className="text-[13px] text-muted-foreground">You rate the children in your subjects. The class teachers write the reports.</span>}
                  </span>
                )}
                <span className="flex items-baseline gap-2">
                  <span className="font-heading text-[44px] font-bold leading-none">{n}</span>
                  <span className="text-base font-bold text-foreground/80">{n === 1 ? "child" : "children"}</span>
                </span>
                <span className="grid gap-1.5">
                  <span className="h-2 overflow-hidden rounded-full bg-border">
                    <span className="block h-full rounded-full bg-success" style={{ width: `${n ? (done / n) * 100 : 0}%` }} />
                  </span>
                  <span className="text-sm">
                    <b>{done} of {n}</b> <span className="text-muted-foreground">learning reports written</span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-primary">See this class’s reports</span>
              </Link>
            );
          })}
        </section>
      )}

      {!hasAi && all.length > 0 && <p className="mt-6 rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">Reports use the built-in writer. An administrator can switch on AI writing on the server for richer reports.</p>}
    </main>
  );
}
