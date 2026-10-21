import Link from "next/link";
import type { ChildListItem, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AreaPips, ChildAvatar } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AddChild } from "./AddChild";

export type Show = "all" | "todo" | "ready";

const TITLES: Record<Show, string> = { all: "", todo: "Reviews to finish", ready: "Finished reports" };

/**
 * The class board. Class shows everyone; Reviews shows the children still to rate or write; Reports the finished ones.
 * Someone with more than one class (every administrator, or a teacher in two) can narrow it to one class.
 */
export async function Board({ show, base, classId }: { show: Show; base: "/" | "/reviews" | "/reports"; classId?: number }) {
  const [info, { children: all }] = await Promise.all([apiGet<WorkspaceInfo>("/workspace"), apiGet<{ children: ChildListItem[] }>("/children")]);
  const { period, hasAi, classes, user } = info;
  const admin = user.role === "admin";
  const current = classes.find((k) => k.id === classId) ?? null;
  const kids = current ? all.filter((c) => c.classId === current.id) : all;
  const several = classes.length > 1 && !current;

  const ready = kids.filter((c) => c.hasReport).length;
  const inProgress = kids.filter((c) => !c.hasReport && c.answered > 0).length;
  const notStarted = kids.length - ready - inProgress;
  const todo = kids.length - ready;
  const list = kids.filter((c) => (show === "ready" ? c.hasReport : show === "todo" ? !c.hasReport : true));
  const nextUp = kids.find((c) => !c.hasReport);
  const withClass = (path: string, id = current?.id) => (id ? `${path}${path.includes("?") ? "&" : "?"}class=${id}` : path);
  // A teacher's "Everyone" is their class home; the administrator has no class home, so theirs stays under Reviews.
  const everyone = admin ? "/reviews?show=all" : "/";
  const href = (s: Show) => withClass(base === "/" ? (s === "all" ? "/" : `/?show=${s}`) : s === "todo" ? "/reviews" : s === "ready" ? "/reports" : everyone);
  const thisPage = base === "/" ? (show === "all" ? "/" : `/?show=${show}`) : show === "all" ? everyone : base;
  const title = TITLES[show] || current?.name || (admin ? "All children" : classes.length === 1 ? classes[0].name : "Your classes");
  const add = admin && <AddChild classes={classes} year={period.year} classId={current?.id} icon />;

  const filters: { show: Show; label: string; n: number }[] = [
    { show: "all", label: "Everyone", n: kids.length },
    { show: "todo", label: "To do", n: todo },
    { show: "ready", label: "Reports ready", n: ready },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Learning reviews
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-1 text-muted-foreground">
            {kids.length === 0
              ? admin
                ? classes.length === 0
                  ? "Create the classes first, then add the children."
                  : "Add the children to begin."
                : classes.length === 0
                  ? "You are not in a class yet."
                  : "No children in your class yet."
              : todo === 0
                ? "Every report is ready."
                : `${ready} of ${kids.length} reports ready · ${inProgress} in progress · ${notStarted} not started`}
          </p>
        </div>
        {kids.length > 0 && add}
      </header>

      {classes.length > 1 && (
        <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" aria-label="Class">
          {[{ id: 0, name: admin ? "All classes" : "All my classes" }, ...classes].map((k) => (
            <Link
              key={k.id}
              href={withClass(thisPage, k.id || undefined)}
              aria-current={(current?.id ?? 0) === k.id ? "true" : undefined}
              className="whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground aria-[current=true]:border-foreground aria-[current=true]:bg-foreground aria-[current=true]:text-background"
            >
              {k.name}
            </Link>
          ))}
        </nav>
      )}

      {kids.length === 0 && (
        <Card className="items-center gap-3 border-dashed px-6 py-12 text-center shadow-none">
          {admin ? (
            classes.length === 0 ? (
              <>
                <h2 className="font-heading text-xl font-semibold">No classes yet</h2>
                <p className="max-w-md text-muted-foreground">Create each class with its level and teachers. Then add the children to it.</p>
                <Button asChild>
                  <Link href="/classes">Set up classes</Link>
                </Button>
              </>
            ) : (
              <>
                <h2 className="font-heading text-xl font-semibold">No children yet</h2>
                <p className="max-w-md text-muted-foreground">Add each child. Their level comes from their birthday, and their teachers then rate a few statements in five areas.</p>
                <AddChild classes={classes} year={period.year} classId={current?.id} label="Add the first child" icon />
              </>
            )
          ) : (
            <>
              <h2 className="font-heading text-xl font-semibold">{classes.length === 0 ? "Not in a class yet" : "No children yet"}</h2>
              <p className="max-w-md text-muted-foreground">
                {classes.length === 0 ? "Ask the administrator to add you to your class. Its children then appear here." : "The administrator adds the children to your class. They appear here as soon as they are added."}
              </p>
            </>
          )}
        </Card>
      )}

      {!hasAi && kids.length > 0 && <p className="mb-4 rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">Reports use the built-in writer. An administrator can switch on AI writing on the server for richer reports.</p>}

      {kids.length > 0 && (
        <>
          <nav className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Show">
            {filters.map((f) => (
              <Link
                key={f.show}
                href={href(f.show)}
                aria-current={show === f.show ? "true" : undefined}
                className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground aria-[current=true]:border-primary aria-[current=true]:text-foreground"
              >
                {f.label} <span className="ml-1 text-muted-foreground">{f.n}</span>
              </Link>
            ))}
          </nav>

          {list.length === 0 ? (
            <Card className="items-center gap-3 border-dashed px-6 py-12 text-center shadow-none">
              {show === "todo" ? (
                <>
                  <h2 className="font-heading text-xl font-semibold">All caught up</h2>
                  <p className="text-muted-foreground">Every child’s report is ready, so there is nothing left to do.</p>
                  <Button asChild>
                    <Link href={href("ready")}>See the finished reports</Link>
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-xl font-semibold">No reports yet</h2>
                  <p className="max-w-md text-muted-foreground">A report appears here once a child’s statements are all rated and you press Write report.</p>
                  {nextUp && (
                    <Button asChild>
                      <Link href={`/child/${nextUp.reviewId}`}>{nextUp.answered ? `Continue with ${nextUp.name}` : `Start with ${nextUp.name}`}</Link>
                    </Button>
                  )}
                </>
              )}
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => {
                const complete = c.answered === c.total;
                const state =
                  c.status === "approved"
                    ? "Approved"
                    : c.status === "submitted"
                      ? "Waiting for review"
                      : c.status === "changes_requested"
                        ? "Changes requested"
                        : c.hasReport
                          ? "Report written"
                          : complete
                            ? "Ready to write"
                            : c.answered === 0
                              ? "Not started"
                              : `${c.answered} of ${c.total} rated`;
                const primary = c.hasReport
                  ? { href: `/child/${c.reviewId}/report`, label: "Open report" }
                  : { href: `/child/${c.reviewId}`, label: complete ? "Write report" : c.answered === 0 ? "Start" : "Continue" };
                return (
                  <li key={c.reviewId}>
                    <Card className="gap-0 p-0 shadow-none transition-colors hover:border-foreground/30">
                      <Link href={`/child/${c.reviewId}`} aria-label={`${c.name}: ${state}`} className="flex items-center gap-3 p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                        <ChildAvatar photoId={c.coverPhotoId} name={c.name} size={48} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-heading text-lg font-semibold leading-tight">
                            {c.name} {c.chineseName && <span className="ml-1 text-sm font-normal text-muted-foreground">{c.chineseName}</span>}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Badge
                              variant={c.status === "approved" ? "default" : "outline"}
                              className={cn("font-normal", c.status === "changes_requested" && "border-warn bg-warn/15 text-foreground", c.status === "submitted" && "border-primary/40 text-primary")}
                            >
                              {state}
                            </Badge>
                            {several && <span className="truncate text-xs text-muted-foreground">{c.className}</span>}
                          </span>
                        </span>
                      </Link>
                      <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
                        <AreaPips areas={c.areas} />
                        <div className="flex items-center gap-1">
                          <Button asChild size="sm" variant={c.hasReport || complete ? "default" : "outline"}>
                            <Link href={primary.href}>{primary.label}</Link>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
