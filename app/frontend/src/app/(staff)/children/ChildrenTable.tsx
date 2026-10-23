"use client";

// Every child this semester in one table (BUILT.md change 14). A row opens the child's profile.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import type { ClassChild, ClassSummary } from "@peterhouse/shared";
import { CLASS_LEVELS, LEVEL_PROBLEM_TEXT, REPORT_STAGES, STAGE_LABEL, stageOf } from "@peterhouse/shared";
import { DataTable, TableFilter, TableSearch, type ColumnDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChildAvatar } from "@/components/ui";
import { StatusBadge } from "../classes/shared";

const birthday = (d: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

export function ChildrenTable({ pupils, classes }: { pupils: ClassChild[]; classes: ClassSummary[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [showLeft, setShowLeft] = useState(false);
  const classOf = new Map(classes.map((k) => [k.id, k]));
  const teachersOf = (c: ClassChild) => {
    const k = classOf.get(c.classId);
    return k ? [...(k.lead ? [k.lead.name] : []), ...k.co.map((t) => t.name)].join(", ") : "";
  };
  const wrongLevel = (c: ClassChild) => !c.left && (!!c.levelProblem || c.level !== classOf.get(c.classId)?.level);
  const levelNote = (c: ClassChild) => (c.levelProblem ? LEVEL_PROBLEM_TEXT[c.levelProblem] : `By their birthday this child is ${c.level} this year`);

  const columns: ColumnDef<ClassChild>[] = [
    {
      id: "name",
      accessorFn: (c) => c.name,
      header: "Child",
      cell: ({ row: { original: c } }) => (
        <span className="flex items-center gap-3">
          <ChildAvatar src={c.photo} name={c.name} size={32} />
          <span>
            <Link href={`/children/${c.childId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-foreground underline-offset-4 hover:text-foreground hover:underline">
              {c.name}
            </Link>
            {c.chineseName && <span className="ml-2 text-muted-foreground">{c.chineseName}</span>}
          </span>
        </span>
      ),
    },
    {
      id: "birthday",
      accessorFn: (c) => c.dateOfBirth,
      header: "Birthday",
      meta: { className: "text-muted-foreground" },
      cell: ({ row: { original: c } }) => birthday(c.dateOfBirth) || "No birthday",
    },
    {
      id: "level",
      accessorFn: (c) => CLASS_LEVELS.findIndex((l) => l.key === classOf.get(c.classId)?.level),
      header: "Level",
      cell: ({ row: { original: c } }) => {
        const k = classOf.get(c.classId);
        return (
          <span className="flex items-center gap-1.5">
            {k && (
              <Badge variant="outline" className="font-medium">
                {k.level}
              </Badge>
            )}
            {wrongLevel(c) && (
              <span className="text-warn" title={levelNote(c)}>
                <TriangleAlert className="size-4" aria-label={levelNote(c)} />
              </span>
            )}
          </span>
        );
      },
    },
    { id: "class", accessorFn: (c) => classOf.get(c.classId)?.name ?? "", header: "Class" },
    { id: "teachers", accessorFn: (c) => teachersOf(c), header: "Class teachers", meta: { className: "text-muted-foreground" }, cell: ({ getValue }) => (getValue() as string) || "No teacher" },
    {
      id: "status",
      accessorFn: (c) => (c.left ? 99 : REPORT_STAGES.indexOf(stageOf(c.status))),
      header: "Report",
      cell: ({ row: { original: c } }) => <StatusBadge status={c.status} left={c.left} />,
    },
  ];

  const left = pupils.filter((c) => c.left).length;
  const shown = pupils.filter(
    (c) =>
      (showLeft || !c.left) &&
      `${c.name} ${c.chineseName}`.toLowerCase().includes(q.trim().toLowerCase()) &&
      (!level || classOf.get(c.classId)?.level === level) &&
      (!classId || c.classId === Number(classId)) &&
      (!status || stageOf(c.status) === status),
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <TableSearch value={q} onChange={setQ} label="Search children by name" />
        <TableFilter
          label="Level"
          all="All levels"
          value={level}
          onChange={(v) => {
            setLevel(v);
            // The class list follows the level: a class of another level is no longer a choice.
            if (v && classOf.get(Number(classId))?.level !== v) setClassId("");
          }}
          options={CLASS_LEVELS.map((l) => ({ value: l.key, label: `${l.key} · ${l.name}` }))}
        />
        <TableFilter label="Class" all={level ? `All ${level} classes` : "All classes"} value={classId} onChange={setClassId} options={classes.filter((k) => !level || k.level === level).map((k) => ({ value: String(k.id), label: k.name }))} />
        <TableFilter label="Report status" all="Any report status" value={status} onChange={setStatus} options={REPORT_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} />
        {left > 0 && (
          <Label className="ml-1 font-normal">
            <Checkbox checked={showLeft} onCheckedChange={(v) => setShowLeft(v === true)} />
            Show children who left ({left})
          </Label>
        )}
        <p className="ml-auto text-sm text-muted-foreground">{shown.length === pupils.length ? `${pupils.length} children` : `${shown.length} of ${pupils.length} children`}</p>
      </div>
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <DataTable
          columns={columns}
          data={shown}
          getRowId={(c) => c.reviewId}
          initialSort={[{ id: "name", desc: false }]}
          onRowClick={(c) => router.push(`/children/${c.childId}`)}
          rowClassName={(c) => c.left && "text-muted-foreground"}
          pageSize={50}
          empty={pupils.length === 0 ? "No children yet. Add each child with Add a child; their level comes from their birthday." : "No one matches. Try a different name or clear the filters."}
        />
      </Card>
    </div>
  );
}
