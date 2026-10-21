"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Ellipsis, Plus, TriangleAlert } from "lucide-react";
import type { ClassChild, ClassesView, ClassSummary } from "@peterhouse/shared";
import { CLASS_LEVELS, LEVEL_PROBLEM_TEXT, classLevel, type ClassLevel } from "@peterhouse/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AddChild } from "../AddChild";
import { NewClass } from "./NewClass";
import { Meter, TeacherStack, capacityOf, hasTeacher } from "./shared";

type Filter = "all" | "attention" | ClassLevel;

type Item = { key: string; classId: number; label: string; text: ReactNode; action: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the administrator should look at: children in the wrong level, classes nobody teaches, classes over their ratio. */
function attentionItems(view: ClassesView): Item[] {
  const items: Item[] = [];
  for (const p of view.flagged) {
    const k = view.classes.find((c) => c.id === p.classId);
    items.push({
      key: `child-${p.reviewId}`,
      classId: p.classId,
      label: p.name,
      action: "Review",
      text: p.levelProblem ? (
        <>
          <b>{p.name}</b> in {k?.name}: {LEVEL_PROBLEM_TEXT[p.levelProblem]}.
        </>
      ) : (
        <>
          <b>{p.name}</b> turns {p.level ? classLevel(p.level).turns : "another age"} this year, so they belong in {p.level}, not <b>{k?.name}</b>.
        </>
      ),
    });
  }
  for (const k of view.classes) {
    if (!hasTeacher(k)) {
      items.push({
        key: `none-${k.id}`,
        classId: k.id,
        label: k.name,
        action: "Assign teachers",
        text: (
          <>
            <b>{k.name}</b> has no teacher. Only administrators can see it until one is assigned.
          </>
        ),
      });
    } else if (k.children > k.capacity) {
      const teachers = (k.lead ? 1 : 0) + k.co.length;
      items.push({
        key: `over-${k.id}`,
        classId: k.id,
        label: k.name,
        action: "Add a teacher",
        text: (
          <>
            <b>{k.name}</b> has {plural(k.children, "child", "children")} for {plural(teachers, "teacher", "teachers")}, which is {k.children - k.capacity} over the 1:{classLevel(k.level).ratio} ratio.
          </>
        ),
      });
    }
  }
  return items;
}

function AttentionPanel({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <Collapsible defaultOpen className="group/attn overflow-hidden rounded-2xl border border-warn/50 bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-3 bg-warn/15 px-5 py-4 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50">
        <TriangleAlert className="size-5 shrink-0 text-warn-foreground" aria-hidden />
        <span className="font-heading text-[17px] font-semibold text-warn-foreground">{plural(items.length, "thing", "things")} to sort out</span>
        <span className="hidden min-w-0 truncate text-sm text-warn-foreground group-data-[state=open]/attn:hidden sm:block">{items.map((i) => i.label).join(" · ")}</span>
        <span className="flex-1" />
        <ChevronDown className="size-5 shrink-0 text-warn-foreground transition-transform group-data-[state=open]/attn:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-warn/30">
          {items.map((it) => (
            <li key={it.key} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5">
              <p className="min-w-60 flex-1">{it.text}</p>
              <Button asChild variant="outline" className="h-10 px-4 font-semibold text-foreground hover:text-foreground">
                <Link href={`/classes/${it.classId}`}>{it.action}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ClassCard({ k, view, flagged }: { k: ClassSummary; view: ClassesView; flagged: ClassChild[] }) {
  const [dialog, setDialog] = useState<"rename" | "add" | null>(null);
  const cap = capacityOf(k);
  const people = [...(k.lead ? [k.lead] : []), ...k.co];
  const note = flagged.length === 0 ? null : flagged.length === 1 ? (flagged[0].level ? `${flagged[0].name} belongs in ${flagged[0].level}` : `${flagged[0].name}’s birthday needs a check`) : `${flagged.length} children need a level check`;

  return (
    <Card className="relative gap-3.5 p-5 shadow-none transition-[border-color,box-shadow] hover:border-foreground/25 hover:shadow-md">
      <div className="flex items-start gap-2">
        <h3 className="flex-1 font-heading text-xl font-semibold leading-tight">
          <Link href={`/classes/${k.id}`} className="text-foreground outline-none hover:text-foreground after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {k.name}
          </Link>
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative z-10 -mr-2 -mt-1 text-muted-foreground" aria-label={`Options for ${k.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog("add")}>Add a child</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog("rename")}>Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between text-sm">
          <span>
            <b>{k.children}</b> <span className="text-muted-foreground">{cap.state === "none" ? (k.children === 1 ? "child" : "children") : `of ${k.capacity} places`}</span>
          </span>
          <span className={cn("text-[13px] font-bold", cap.state === "over" ? "text-destructive" : cap.state === "none" ? "text-warn-foreground" : "text-muted-foreground")}>{cap.label}</span>
        </div>
        <Meter value={k.children} max={k.capacity} tone={cap.state === "over" ? "over" : "default"} label={`${k.children} of ${k.capacity} places`} />
      </div>

      <div className="flex min-h-14 items-center gap-3 border-t pt-3.5">
        {people.length > 0 ? (
          <>
            <TeacherStack people={people} />
            <div className="min-w-0 leading-snug">
              <p className="truncate text-sm font-semibold">{people[0].name}</p>
              <p className="truncate text-[13px] text-muted-foreground">{people.length > 1 ? `Lead, with ${k.co.map((c) => c.name).join(", ")}` : "Lead teacher"}</p>
            </div>
          </>
        ) : (
          <Button asChild variant="outline" className="relative z-10 h-10 border-warn/60 bg-warn/10 font-semibold text-warn-foreground hover:bg-warn/20">
            <Link href={`/classes/${k.id}`}>
              <Plus /> Assign teachers
            </Link>
          </Button>
        )}
      </div>

      {note && (
        <p className="flex items-center gap-2 rounded-lg bg-warn/10 px-2.5 py-2 text-[13px] font-semibold text-warn-foreground">
          <TriangleAlert className="size-4 shrink-0" aria-hidden /> {note}
        </p>
      )}

      {dialog === "rename" && <NewClass existing={{ id: k.id, name: k.name, level: k.level, empty: k.children === 0 }} year={view.year} dialog={{ open: true, onOpenChange: (o) => !o && setDialog(null) }} />}
      {dialog === "add" && <AddChild classes={view.classes} year={view.year} classId={k.id} dialog={{ open: true, onOpenChange: (o) => !o && setDialog(null) }} />}
    </Card>
  );
}

export function ClassesBoard({ view }: { view: ClassesView }) {
  const [filter, setFilter] = useState<Filter>("all");
  const items = attentionItems(view);
  const flaggedClasses = new Set(items.map((i) => i.classId));
  const shown = view.classes.filter((k) => filter === "all" || (filter === "attention" ? flaggedClasses.has(k.id) : k.level === filter));

  const chips: { id: Filter; label: string; count: number; warn?: boolean }[] = [
    { id: "all", label: "All", count: view.classes.length },
    ...CLASS_LEVELS.map((l) => ({ id: l.key as Filter, label: l.key, count: view.classes.filter((k) => k.level === l.key).length })),
    ...(flaggedClasses.size > 0 ? [{ id: "attention" as Filter, label: "Needs attention", count: flaggedClasses.size, warn: true }] : []),
  ];

  return (
    <div className="grid gap-8">
      <AttentionPanel items={items} />

      <div role="group" aria-label="Filter by level" className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(c.id)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border pl-4 pr-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:bg-secondary",
              )}
            >
              {c.label}
              <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs", on ? "bg-background/20" : c.warn ? "bg-warn/20 text-warn-foreground" : "bg-secondary text-muted-foreground")}>{c.count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-10">
        {CLASS_LEVELS.map((lv) => {
          const mine = shown.filter((k) => k.level === lv.key);
          if (mine.length === 0 && filter === "attention") return null;
          if (filter !== "all" && filter !== "attention" && filter !== lv.key) return null;
          const kids = mine.reduce((n, k) => n + k.children, 0);
          return (
            <section key={lv.key} aria-labelledby={`lv-${lv.key}`} className="grid gap-4">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                  <h2 id={`lv-${lv.key}`} className="font-heading text-[22px] font-semibold leading-tight">
                    {lv.key} <span className="font-medium text-muted-foreground">· {lv.name}</span>
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    Born {view.year - lv.turns} · turns {lv.turns} in {view.year}
                  </p>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {plural(mine.length, "class", "classes")} · {plural(kids, "child", "children")}
                </p>
              </div>
              <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))]">
                {mine.map((k) => (
                  <li key={k.id}>
                    <ClassCard k={k} view={view} flagged={view.flagged.filter((p) => p.classId === k.id)} />
                  </li>
                ))}
                {mine.length === 0 && (
                  <li>
                    <NewClass placeholder defaultLevel={lv.key} year={view.year} />
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
