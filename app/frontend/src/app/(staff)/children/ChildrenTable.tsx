"use client";

// Every child this semester in one table (CHANGES-TO-MAKE change 14). A row opens the child's profile.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import type { ClassChild, ClassSummary } from "@peterhouse/shared";
import { CLASS_LEVELS, LEVEL_PROBLEM_TEXT, REPORT_STAGES, STAGE_LABEL, STATUS_LABEL, stageOf } from "@peterhouse/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyTable, SearchBox, SortHead, STICKY_CELL, useSort, type Column } from "@/components/sort-table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SELECT } from "../AddChild";
import { LEVEL_TINT, STATUS_TONE } from "../classes/shared";
import { ChildAvatar } from "@/components/ui";

const birthday = (d: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

export function ChildrenTable({ pupils, classes }: { pupils: ClassChild[]; classes: ClassSummary[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [classId, setClassId] = useState(0);
  const [status, setStatus] = useState("");
  const [showLeft, setShowLeft] = useState(false);
  const classOf = new Map(classes.map((k) => [k.id, k]));
  const teachersOf = (c: ClassChild) => {
    const k = classOf.get(c.classId);
    return k ? [...(k.lead ? [k.lead.name] : []), ...k.co.map((t) => t.name)].join(", ") : "";
  };
  const wrongLevel = (c: ClassChild) => !c.left && (!!c.levelProblem || c.level !== classOf.get(c.classId)?.level);
  const columns: Column<ClassChild>[] = [
    { key: "name", label: "Child", sort: (c) => c.name },
    { key: "birthday", label: "Birthday", sort: (c) => c.dateOfBirth || "~" },
    { key: "level", label: "Level", sort: (c) => CLASS_LEVELS.findIndex((l) => l.key === classOf.get(c.classId)?.level) },
    { key: "class", label: "Class", sort: (c) => classOf.get(c.classId)?.name ?? "" },
    { key: "teachers", label: "Class teachers", sort: (c) => teachersOf(c) || "~" },
    { key: "status", label: "Report", sort: (c) => (c.left ? 99 : REPORT_STAGES.indexOf(stageOf(c.status))) },
  ];
  const left = pupils.filter((c) => c.left).length;
  const shown = pupils.filter(
    (c) =>
      (showLeft || !c.left) &&
      `${c.name} ${c.chineseName}`.toLowerCase().includes(q.trim().toLowerCase()) &&
      (!level || classOf.get(c.classId)?.level === level) &&
      (!classId || c.classId === classId) &&
      (!status || stageOf(c.status) === status),
  );
  const { sorted, sort, toggle } = useSort(shown, columns);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} label="Search children by name" />
        <select
          aria-label="Level"
          className={cn(SELECT, "w-auto min-w-32")}
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            // The class list follows the level: a class of another level is no longer a choice.
            if (e.target.value && classOf.get(classId)?.level !== e.target.value) setClassId(0);
          }}
        >
          <option value="">All levels</option>
          {CLASS_LEVELS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.key} · {l.name}
            </option>
          ))}
        </select>
        <select aria-label="Class" className={cn(SELECT, "w-auto min-w-40")} value={classId || ""} onChange={(e) => setClassId(Number(e.target.value))}>
          <option value="">{level ? `All ${level} classes` : "All classes"}</option>
          {classes.filter((k) => !level || k.level === level).map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
        <select aria-label="Report status" className={cn(SELECT, "w-auto min-w-40")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any report status</option>
          {REPORT_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        {left > 0 && (
          <label className="ml-1 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showLeft} onChange={(e) => setShowLeft(e.target.checked)} className="size-4 accent-primary" />
            Show children who left ({left})
          </label>
        )}
      </div>
      {pupils.length === 0 ? (
        <EmptyTable title="No children yet" text="Add each child with Add a child. Their level comes from their birthday." />
      ) : sorted.length === 0 ? (
        <EmptyTable title="No one matches" text="Try a different name or clear the filters." />
      ) : (
        <Card className="overflow-hidden p-0 shadow-none">
          <Table>
            <SortHead columns={columns} sort={sort} toggle={toggle} />
            <TableBody>
              {sorted.map((c) => {
                const k = classOf.get(c.classId);
                return (
                  <TableRow key={c.reviewId} className={cn("cursor-pointer", c.left && "text-muted-foreground")} onClick={() => router.push(`/children/${c.childId}`)}>
                    <TableCell className={cn(STICKY_CELL, "py-3")}>
                      <span className="flex items-center gap-3">
                        <ChildAvatar src={c.photo} name={c.name} size={36} />
                        <span>
                          <Link href={`/children/${c.childId}`} onClick={(e) => e.stopPropagation()} className="font-heading text-base font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50">
                            {c.name}
                          </Link>
                          {c.chineseName && <span className="ml-2 text-sm text-muted-foreground">{c.chineseName}</span>}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{birthday(c.dateOfBirth) || <span className="text-muted-foreground">No birthday</span>}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {k && <Badge className={cn("border-transparent font-bold", LEVEL_TINT[k.level])}>{k.level}</Badge>}
                        {wrongLevel(c) && (
                          <span className="text-warn" title={c.levelProblem ? LEVEL_PROBLEM_TEXT[c.levelProblem] : `By their birthday this child is ${c.level} this year`}>
                            <TriangleAlert className="size-4" aria-label={c.levelProblem ? LEVEL_PROBLEM_TEXT[c.levelProblem] : `By their birthday this child is ${c.level} this year`} />
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{k?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{teachersOf(c) || "No teacher"}</TableCell>
                    <TableCell className="px-4">
                      {c.left ? (
                        <Badge variant="outline" className="font-normal">
                          Left
                        </Badge>
                      ) : (
                        <Badge className={cn("whitespace-nowrap font-normal", STATUS_TONE[c.status])}>{STATUS_LABEL[c.status]}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
