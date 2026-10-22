"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Ellipsis, Plus, TriangleAlert } from "lucide-react";
import type { ClassChild, ClassesView, ClassSummary } from "@peterhouse/shared";
import { CLASS_LEVELS, LEVEL_PROBLEM_TEXT, classLevel } from "@peterhouse/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AddChild } from "../AddChild";
import { NewClass } from "./NewClass";
import { LEVEL_COLUMN, Meter, TeacherStack, capacityOf, hasTeacher } from "./shared";

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

function Stat({ value, label, hint, tone }: { value: number; label: string; hint: string; tone?: string }) {
  return (
    <div className="grid gap-0.5 rounded-2xl border bg-card px-5 pb-3.5 pt-4">
      <span className={cn("font-heading text-4xl font-bold leading-tight", tone)}>{value}</span>
      <span className="text-sm font-bold text-foreground/80">{label}</span>
      <span className="text-[13px] text-muted-foreground">{hint}</span>
    </div>
  );
}

function ClassCard({ k, view, flagged }: { k: ClassSummary; view: ClassesView; flagged: ClassChild[] }) {
  const [dialog, setDialog] = useState<"rename" | "add" | null>(null);
  const cap = capacityOf(k);
  const people = [...(k.lead ? [k.lead] : []), ...k.co];
  const note = flagged.length === 0 ? null : flagged.length === 1 ? (flagged[0].level ? `${flagged[0].name} belongs in ${flagged[0].level}` : `${flagged[0].name}’s birthday needs a check`) : `${flagged.length} children need a level check`;

  return (
    <Card className="relative gap-3 rounded-[14px] p-3.5 shadow-none transition-[border-color,box-shadow] hover:border-foreground/25 hover:shadow-md">
      <div className="flex items-start gap-1">
        <h3 className="flex-1 font-heading text-lg font-semibold leading-tight">
          <Link href={`/classes/${k.id}`} className="text-foreground outline-none hover:text-foreground after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
            {k.name}
          </Link>
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative z-10 -mr-2 -mt-1.5 size-8 text-muted-foreground" aria-label={`Options for ${k.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog("add")}>Add a child</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog("rename")}>Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between text-[13.5px]">
          <span>
            <b>{k.children}</b> <span className="text-muted-foreground">{cap.state === "none" ? (k.children === 1 ? "child" : "children") : `of ${k.capacity} places`}</span>
          </span>
          <span className={cn("text-[12.5px] font-extrabold", cap.state === "over" ? "text-destructive" : cap.state === "none" ? "text-warn-foreground" : "text-muted-foreground")}>{cap.label}</span>
        </div>
        <Meter value={k.children} max={k.capacity} tone={cap.state === "over" ? "over" : "default"} label={`${k.children} of ${k.capacity} places`} />
      </div>

      <div className="flex min-h-12 items-center gap-2.5 border-t pt-3">
        {people.length > 0 ? (
          <>
            <TeacherStack people={people} size={28} />
            <div className="min-w-0 leading-snug">
              <p className="truncate text-[13.5px] font-bold">{people[0].name}</p>
              <p className="truncate text-xs text-muted-foreground">{people.length > 1 ? `Lead, with ${k.co.map((c) => c.name).join(", ")}` : "Lead teacher"}</p>
            </div>
          </>
        ) : (
          <Button asChild variant="outline" size="sm" className="relative z-10 h-9 border-warn/60 bg-warn/10 font-bold text-warn-foreground hover:bg-warn/20">
            <Link href={`/classes/${k.id}`}>
              <Plus /> Assign teachers
            </Link>
          </Button>
        )}
      </div>

      {note && (
        <p className="flex items-center gap-1.5 rounded-lg bg-warn/10 px-2.5 py-1.5 text-xs font-bold text-warn-foreground">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {note}
        </p>
      )}

      {dialog === "rename" && <NewClass existing={{ id: k.id, name: k.name, level: k.level, empty: k.children === 0 }} year={view.year} dialog={{ open: true, onOpenChange: (o) => !o && setDialog(null) }} />}
      {dialog === "add" && <AddChild classes={view.classes} year={view.year} classId={k.id} dialog={{ open: true, onOpenChange: (o) => !o && setDialog(null) }} />}
    </Card>
  );
}

/** One age group: five of these side by side on a wide screen, stacked and collapsible on a phone. */
function LevelColumn({ lv, classes, view }: { lv: (typeof CLASS_LEVELS)[number]; classes: ClassSummary[]; view: ClassesView }) {
  const [open, setOpen] = useState(classes.length > 0);
  const tone = LEVEL_COLUMN[lv.key];
  const kids = classes.reduce((n, k) => n + k.children, 0);
  return (
    <section aria-labelledby={`lv-${lv.key}`} className={cn("min-w-0 rounded-[22px] p-3.5", tone.soft)}>
      <div className="flex items-center gap-2 px-1 pb-1.5">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 id={`lv-${lv.key}`} className={cn("flex flex-wrap items-baseline gap-x-2 font-heading leading-tight", tone.deep)}>
            <span className="text-[28px] font-bold">{lv.key}</span>
            <span className="text-sm font-bold">{lv.name}</span>
          </h2>
          <p className="text-[12.5px] text-foreground/70">
            Born {view.year - lv.turns} · turns {lv.turns}
          </p>
          <p className={cn("mt-2 w-fit rounded-full px-3 py-0.5 text-[12.5px] font-extrabold", tone.chip, tone.deep)}>{classes.length === 0 ? "No class yet" : `${plural(classes.length, "class", "classes")} · ${plural(kids, "child", "children")}`}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className={cn("size-11 min-[1280px]:hidden", tone.deep)} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${lv.name}`} onClick={() => setOpen((o) => !o)}>
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </div>
      <div className={cn("mt-1 grid-cols-[minmax(0,1fr)] gap-2.5", open ? "grid" : "hidden min-[1280px]:grid")}>
        {classes.map((k) => (
          <ClassCard key={k.id} k={k} view={view} flagged={view.flagged.filter((p) => p.classId === k.id)} />
        ))}
        <NewClass
          placeholder
          defaultLevel={lv.key}
          year={view.year}
          placeholderClass={cn("rounded-[14px] border-2 bg-transparent font-extrabold hover:text-current", classes.length === 0 ? "min-h-28" : "min-h-12", tone.dash, tone.deep)}
          placeholderLabel={classes.length === 0 ? `Add the first ${lv.key} class` : `Add a ${lv.key} class`}
        />
      </div>
    </section>
  );
}

export function ClassesBoard({ view }: { view: ClassesView }) {
  const items = attentionItems(view);
  const children = view.classes.reduce((n, k) => n + k.children, 0);
  const placed = new Set(view.classes.flatMap((k) => [...(k.lead ? [k.lead.id] : []), ...k.co.map((c) => c.id)])).size;
  const free = view.classes.reduce((n, k) => n + Math.max(0, k.capacity - k.children), 0);
  const empty = CLASS_LEVELS.filter((l) => !view.classes.some((k) => k.level === l.key)).length;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3.5 min-[1100px]:grid-cols-4">
        <Stat value={children} label={children === 1 ? "Child" : "Children"} hint={`in ${plural(view.classes.length, "class", "classes")}`} />
        <Stat value={view.classes.length} label={view.classes.length === 1 ? "Class" : "Classes"} hint={empty ? `${plural(empty, "level has", "levels have")} none yet` : `across all ${CLASS_LEVELS.length} levels`} />
        <Stat value={placed} label={placed === 1 ? "Teacher" : "Teachers"} hint="placed in a class" />
        <Stat value={free} label="Places free" hint="for the teachers they have" tone="text-[#2c5f80]" />
      </div>

      <AttentionPanel items={items} />

      <div className="hidden items-center gap-3.5 text-xs font-extrabold uppercase tracking-widest text-muted-foreground min-[1280px]:flex" aria-hidden>
        <span>Youngest</span>
        <span className="h-0.5 flex-1 rounded-full bg-border" />
        <span className="-mr-1">Oldest</span>
        <ChevronRight className="-ml-2 size-[18px] text-muted-foreground/70" />
      </div>

      <div className="grid items-start gap-3.5 md:grid-cols-2 min-[1280px]:-mt-3 min-[1280px]:grid-cols-5">
        {CLASS_LEVELS.map((lv) => (
          <LevelColumn key={lv.key} lv={lv} classes={view.classes.filter((k) => k.level === lv.key)} view={view} />
        ))}
      </div>
    </div>
  );
}
