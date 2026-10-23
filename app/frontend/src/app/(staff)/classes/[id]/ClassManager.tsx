"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ArrowRightLeft, Check, ChevronRight, ChevronsUpDown, Ellipsis, LogOut, Pencil, Plus, Search, Trash2, TriangleAlert, UserRound } from "lucide-react";
import type { ClassChild, ClassDetail, ClassSummary, LevelProblem, Pronoun, ReportStage, StaffRef } from "@peterhouse/shared";
import { LEVEL_PROBLEM_TEXT, REPORT_STAGES, STAGE_LABEL, birthdayRange, stageOf, levelForBirthday } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { ChildAvatar, initials } from "@/components/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PROFILE_DIALOG, ProfileForm, ProfilePhoto } from "@/components/ProfileForm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUBJECT_SWATCH } from "@/lib/calendar";
import { DataTable, TableSearch, type ColumnDef } from "@/components/data-table";
import { Icon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { SELECT } from "../../AddChild";
import { removeChildAction } from "../../actions";
import { STAGE_FILL, StatusBadge, areaClashes } from "../shared";

/** Runs one admin request, shows the outcome, and refreshes the page on success. */
function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<string | null>, ok: string): Promise<boolean> {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) {
      toast.error(err);
      return false;
    }
    toast.success(ok);
    router.refresh();
    return true;
  }
  return { busy, act };
}

const birthday = (d: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "No birthday");

export function RemoveClass({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          Remove class
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>The class has no children, so nothing else is lost.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={async () => {
              const err = await adminSend("DELETE", `/classes/${id}`);
              if (err) return void toast.error(err);
              toast.success(`${name} removed.`);
              router.push("/classes");
              router.refresh();
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Name, Chinese name, pronouns and birthday. Also opened from the child's profile, so it needs only the class's name, level and year. */
export function EditChild({
  child,
  detail,
  classes,
  open,
  onOpenChange,
}: {
  child: Pick<ClassChild, "reviewId" | "childId" | "name" | "firstName" | "lastName" | "chineseName" | "pronoun" | "dateOfBirth" | "photo">;
  detail: Pick<ClassDetail, "name" | "level" | "year">;
  classes: ClassSummary[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { busy, act } = useAct();
  const [dob, setDob] = useState(child.dateOfBirth);
  const [picked, setPicked] = useState<number | null>(null);
  // Only birthdays that fit a class of this school: any level it has a class for, and this child's own.
  const allowed = birthdayRange(detail.year, [...new Set([detail.level, ...classes.map((k) => k.level)])]);
  const found = levelForBirthday(dob, detail.year);
  const level = "level" in found ? found.level : null;
  // A birthday of another level means the child changes class too: only that level's classes are offered.
  const elsewhere = !!level && level !== detail.level;
  const ofLevel = classes.filter((k) => k.level === level);
  const target = elsewhere ? (ofLevel.find((k) => k.id === picked) ?? null) : null;
  const blocked = !level || (elsewhere && !target);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={PROFILE_DIALOG}>
        <ProfileForm
          title={`Edit ${child.name}`}
          description="Changes show on their form and report straight away."
          photo={<ProfilePhoto endpoint={`/api/children/${child.childId}/photo`} photo={child.photo} name={child.firstName || child.name} okMessage={`Photo saved. It is also the cover of ${child.name}’s report.`} />}
          busy={busy}
          disabled={blocked}
          saveLabel={target ? "Save and move" : "Save changes"}
          onSubmit={async (e) => {
            e.preventDefault();
            if (blocked) return;
            const f = new FormData(e.currentTarget);
            const body = {
              firstName: String(f.get("firstName") ?? ""),
              lastName: String(f.get("lastName") ?? ""),
              chineseName: String(f.get("chineseName") ?? ""),
              pronoun: String(f.get("pronoun")) as Pronoun,
              dateOfBirth: dob,
              ...(target ? { classId: target.id } : {}),
            };
            if (await act(() => adminSend("PUT", `/reviews/${child.reviewId}/child`, body), target ? `Saved, and ${child.name} moved to ${target.name}.` : "Saved.")) onOpenChange(false);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`n-${child.reviewId}`}>First name</Label>
              <Input id={`n-${child.reviewId}`} name="firstName" defaultValue={child.firstName} maxLength={80} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`l-${child.reviewId}`}>Last name</Label>
              <Input id={`l-${child.reviewId}`} name="lastName" defaultValue={child.lastName} maxLength={80} required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`z-${child.reviewId}`}>Chinese name</Label>
            <Input id={`z-${child.reviewId}`} name="chineseName" defaultValue={child.chineseName} maxLength={40} lang="zh" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`p-${child.reviewId}`}>Pronouns</Label>
            <select id={`p-${child.reviewId}`} name="pronoun" className={SELECT} defaultValue={child.pronoun}>
              <option value="she">she / her</option>
              <option value="he">he / him</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`d-${child.reviewId}`}>Birthday</Label>
            <Input id={`d-${child.reviewId}`} type="date" value={dob} min={allowed.min} max={allowed.max} onChange={(e) => setDob(e.target.value)} required />
            <p className={`text-xs ${dob && !level ? "text-destructive" : "text-muted-foreground"}`}>
              {level ? `${level} in ${detail.year}.` : dob ? `${LEVEL_PROBLEM_TEXT[(found as { problem: LevelProblem }).problem]}, so they cannot be in a class.` : "Sets their level."}
            </p>
          </div>
          {elsewhere && (
            <div className="grid gap-2 rounded-md border border-warn/50 bg-warn/10 px-3 py-3">
              <p className="text-sm">
                With this birthday {child.name} is {level}, so they move out of {detail.name} ({detail.level}).
              </p>
              {ofLevel.length === 0 ? (
                <p className="text-sm text-destructive">There is no {level} class yet. Create one on the Classes page first.</p>
              ) : (
                <>
                  <Label htmlFor={`c-${child.reviewId}`}>New class</Label>
                  <select id={`c-${child.reviewId}`} className={SELECT} value={target?.id ?? ""} onChange={(e) => setPicked(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Choose a class…</option>
                    {ofLevel.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
        </ProfileForm>
      </DialogContent>
    </Dialog>
  );
}

type Person = StaffRef & { role: "lead" | "teacher" | "subject"; subjectIds: number[] };

/** Everyone who teaches this class: the lead, the co-teachers, then those who teach only some subjects. */
function classPeople(detail: ClassDetail): Person[] {
  return [
    ...(detail.lead ? [{ ...detail.lead, role: "lead" as const, subjectIds: detail.teacherSubjects[detail.lead.id] ?? [] }] : []),
    ...detail.co.map((c) => ({ ...c, role: "teacher" as const, subjectIds: detail.teacherSubjects[c.id] ?? [] })),
    ...detail.subjectTeachers.map((t) => ({ id: t.id, name: t.name, role: "subject" as const, subjectIds: t.subjectIds })),
  ];
}

const ROLE_LABEL: Record<Person["role"], string> = { lead: "Lead teacher", teacher: "Teacher", subject: "Subject teacher" };

const subjectNames = (detail: ClassDetail, ids: number[]) => ids.flatMap((id) => detail.subjects.filter((x) => x.id === id));

/** The areas one person rates in this class. */
const ratedBy = (detail: ClassDetail, id: number) => detail.areaTeachers.filter((a) => a.teacher?.id === id);

export function ClassTeachers({ detail, teachers, classes }: { detail: ClassDetail; teachers: StaffRef[]; classes: ClassSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const [setting, setSetting] = useState<Person | null>(null);
  const people = classPeople(detail);
  const here = new Set(people.map((p) => p.id));
  const prev = { leadId: detail.lead?.id ?? null, coIds: detail.co.map((c) => c.id) };
  const staffCount = people.filter((p) => p.role !== "subject").length;

  /** Saves the new team straight away and offers an Undo, so there is no Save button to forget. */
  async function save(next: { leadId: number | null; coIds: number[] }, message: string) {
    setBusy(true);
    const err = await adminSend("PUT", `/classes/${detail.id}/staff`, next);
    setBusy(false);
    if (err) return void toast.error(err);
    toast.success(message, {
      action: {
        label: "Undo",
        onClick: async () => {
          const e = await adminSend("PUT", `/classes/${detail.id}/staff`, prev);
          if (e) toast.error(e);
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  const add = (t: StaffRef) => {
    setPicker(false);
    setQ("");
    return detail.lead ? save({ leadId: prev.leadId, coIds: [...prev.coIds, t.id] }, `${t.name} added to ${detail.name}.`) : save({ leadId: t.id, coIds: prev.coIds }, `${t.name} is now the lead of ${detail.name}.`);
  };
  const makeLead = (t: StaffRef) => save({ leadId: t.id, coIds: [...(prev.leadId ? [prev.leadId] : []), ...prev.coIds.filter((id) => id !== t.id)] }, `${t.name} is now the lead of ${detail.name}.`);
  const remove = (t: Person) =>
    save(t.role === "lead" ? { leadId: null, coIds: prev.coIds } : { leadId: prev.leadId, coIds: prev.coIds.filter((id) => id !== t.id) }, staffCount === 1 ? `${t.name} removed. Only administrators see ${detail.name} now.` : `${t.name} removed from ${detail.name}.`);

  const teacherColumns: ColumnDef<Person>[] = [
    {
      id: "name",
      accessorFn: (p) => p.name,
      header: "Teacher",
      cell: ({ row: { original: p } }) => (
        <span className="flex items-center gap-2.5">
          <Avatar className="size-7">
            <AvatarFallback className="text-[11px] font-semibold">{initials(p.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{p.name}</span>
        </span>
      ),
    },
    {
      id: "role",
      accessorFn: (p) => ["lead", "teacher", "subject"].indexOf(p.role),
      header: "Role",
      cell: ({ row: { original: p } }) => (
        <Badge variant={p.role === "lead" ? "secondary" : "outline"} className="font-medium">
          {ROLE_LABEL[p.role]}
        </Badge>
      ),
    },
    {
      id: "subjects",
      accessorFn: (p) => subjectNames(detail, p.subjectIds).map((x) => x.name).join(", ") || "All subjects",
      header: "Subjects",
      meta: { className: "whitespace-normal" },
      cell: ({ row: { original: p } }) => {
        const subs = subjectNames(detail, p.subjectIds);
        return (
          <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`Change subjects for ${p.name}`} className="-ml-2 h-auto max-w-full flex-wrap justify-start gap-1 px-2 py-1 font-normal" onClick={() => setSetting(p)}>
            {subs.length === 0 ? (
              <span className="text-muted-foreground">All subjects</span>
            ) : (
              subs.map((x) => (
                <Badge key={x.id} variant="outline" className="gap-1.5 font-normal">
                  <span className="size-1.5 rounded-full" style={{ background: SUBJECT_SWATCH[x.color] }} aria-hidden />
                  {x.name}
                </Badge>
              ))
            )}
            <Pencil className="size-3 text-muted-foreground" aria-hidden />
          </Button>
        );
      },
    },
    {
      id: "rates",
      accessorFn: (p) => ratedBy(detail, p.id).length,
      header: "Rates",
      meta: { className: "whitespace-normal text-muted-foreground" },
      cell: ({ row: { original: p } }) => ratedBy(detail, p.id).map((a) => a.name).join(", ") || "—",
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-12" },
      cell: ({ row: { original: p } }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Options for ${p.name}`} disabled={busy}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setSetting(p)}>Change subjects</DropdownMenuItem>
            {p.role === "teacher" && <DropdownMenuItem onSelect={() => makeLead(p)}>Make lead teacher</DropdownMenuItem>}
            {p.role !== "subject" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => remove(p)}>
                  Remove from class
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const taughtIn = (t: StaffRef) => classes.filter((k) => k.id !== detail.id && (k.lead?.id === t.id || k.co.some((c) => c.id === t.id))).map((k) => k.name);
  const options = teachers
    .filter((t) => !here.has(t.id) && t.name.toLowerCase().includes(q.trim().toLowerCase()))
    .map((t) => ({ t, in: taughtIn(t) }))
    .sort((a, b) => a.in.length - b.in.length);

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">Teachers can rate the children and write their learning reports. Changes save as you go.</p>
        {teachers.length > 0 && (
          <Popover open={picker} onOpenChange={(o) => (setPicker(o), !o && setQ(""))}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <Plus /> Add teacher
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-1.5">
              <div className="relative mb-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a teacher" aria-label="Find a teacher" className="pl-8" autoFocus />
              </div>
              {options.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">{q ? "Nobody matches." : "Every teacher is already in this class."}</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {options.map(({ t, in: classesTaught }) => (
                    <li key={t.id}>
                      <button type="button" className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" onClick={() => add(t)}>
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[11px] font-semibold">{initials(t.name)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-sm font-medium">{t.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{classesTaught.length === 0 ? "Not in a class yet" : `Teaches ${classesTaught.join(", ")}`}</span>
                        </span>
                        <Plus className="size-4 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/settings/people" className="mt-1 flex items-center justify-between gap-2 border-t px-2 pb-1 pt-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                Teacher not here? Add them in People and sign-ins <ArrowRight className="size-3.5 shrink-0" aria-hidden />
              </Link>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {teachers.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          There are no teacher accounts yet.{" "}
          <Link href="/settings/people" className="underline underline-offset-4">
            Add them in People and sign-ins
          </Link>
          .
        </p>
      ) : people.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nobody teaches this class yet, so only administrators can see it.</p>
      ) : (
        <DataTable columns={teacherColumns} data={people} getRowId={(p) => p.id} />
      )}
      {setting && <SubjectTeacherDialog key={setting.id} detail={detail} teacher={setting} isStaff={setting.role !== "subject"} onClose={() => setSetting(null)} />}
    </Card>
  );
}

/** Which subjects one teacher teaches in this class. For a class teacher, nothing ticked means all of them. */
function SubjectTeacherDialog({ detail, teacher, isStaff, onClose }: { detail: ClassDetail; teacher: StaffRef & { subjectIds: number[] }; isStaff: boolean; onClose: () => void }) {
  const { busy, act } = useAct();
  const [picked, setPicked] = useState<number[]>(teacher.subjectIds);
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const dropping = !isStaff && picked.length === 0;
  const save = async () => {
    const ok = await act(
      () => adminSend("PUT", `/classes/${detail.id}/subject-teachers/${teacher.id}`, { subjectIds: picked }),
      dropping ? `${teacher.name} is taken off ${detail.name}.` : picked.length === 0 ? `${teacher.name} teaches every subject in ${detail.name}.` : `${teacher.name}’s subjects in ${detail.name} are saved.`,
    );
    if (ok) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{teacher.name}’s subjects</DialogTitle>
          <DialogDescription>The subjects they teach in {detail.name}. They rate the matching learning areas unless you choose someone else.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-0.5">
          {detail.subjects.map((x) => (
            <li key={x.id}>
              <Label htmlFor={`sub-${x.id}`} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 font-normal hover:bg-accent">
                <Checkbox id={`sub-${x.id}`} checked={picked.includes(x.id)} onCheckedChange={() => toggle(x.id)} />
                <span className="size-2 rounded-full" style={{ background: SUBJECT_SWATCH[x.color] }} aria-hidden />
                {x.name}
              </Label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {dropping ? `With nothing ticked, ${teacher.name} is taken off this class.` : picked.length === 0 ? "Nothing ticked, so they teach all subjects." : `${picked.length} of ${detail.subjects.length} subjects.`}
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant={dropping ? "destructive" : "default"} disabled={busy} onClick={save}>
            {dropping ? "Take off class" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Area = ClassDetail["areaTeachers"][number];

/** Why this person rates the area, in a few words. */
function AreaReason({ area }: { area: Area }) {
  if (area.source === "set") return <Badge className="border-transparent bg-[#e6effc] font-medium text-[#1e3a8a]">Set by you</Badge>;
  if (area.teachers.length > 1)
    return (
      <Badge variant="outline" className="gap-1.5 border-warn/60 font-medium text-warn-foreground">
        <TriangleAlert className="size-3" aria-hidden /> {area.teachers.length} teach {area.subject}
      </Badge>
    );
  if (area.source === "subject") return <Badge variant="secondary" className="font-medium">Teaches {area.subject}</Badge>;
  return (
    <Badge variant="outline" className="font-medium text-muted-foreground">
      {area.teacher ? "Lead teacher" : "No teacher yet"}
    </Badge>
  );
}

/** The "Rated by" box: who rates an area, and the choice of anyone on the team or Automatic. */
function RaterPicker({ detail, area, people, busy, onPick }: { detail: ClassDetail; area: Area; people: Person[]; busy: boolean; onPick: (userId: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (userId: number | null) => {
    setOpen(false);
    onPick(userId);
  };
  const current = area.source === "set" ? area.teacher?.id : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy || people.length === 0} aria-label={`Who rates ${area.name}`} className="w-full max-w-64 justify-start gap-2 font-normal">
          {area.teacher ? (
            <>
              <Avatar className="size-5">
                <AvatarFallback className="text-[9px] font-semibold">{initials(area.teacher.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{area.teacher.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Any class teacher</span>
          )}
          <ChevronsUpDown className="ml-auto text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <ul role="listbox" aria-label={`Who rates ${area.name}`}>
          <PickerOption selected={current === null} title="Automatic" meta={`Whoever teaches ${area.subject ?? "it"}, else the lead`} onClick={() => pick(null)} />
          <li role="separator" className="my-1 h-px bg-border" />
          {people.map((p) => {
            const subs = subjectNames(detail, p.subjectIds).map((x) => x.name);
            const n = ratedBy(detail, p.id).length;
            const meta = [p.role === "lead" ? "Lead" : null, subs.length ? `Teaches ${subs.join(", ")}` : p.role !== "subject" ? "All subjects" : null, `rates ${n}`].filter(Boolean).join(" · ");
            return <PickerOption key={p.id} selected={current === p.id} title={p.name} meta={meta} onClick={() => pick(p.id)} />;
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function PickerOption({ selected, title, meta, onClick }: { selected: boolean; title: string; meta: string; onClick: () => void }) {
  return (
    <li role="option" aria-selected={selected}>
      <button type="button" onClick={onClick} className={cn("flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none", selected && "bg-accent/60")}>
        <Check className={cn("mt-0.5 size-4 shrink-0", !selected && "invisible")} aria-hidden />
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{meta}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * Who rates each learning area of this class's reports. Starts on the teacher tagged with that subject, otherwise the
 * lead; an admin can pin an area to anyone on the team. Each teacher rates their areas and sends them to the lead.
 */
export function AreaTeachers({ detail }: { detail: ClassDetail }) {
  const { busy, act } = useAct();
  const people = classPeople(detail);
  const clashes = areaClashes(detail);
  const choose = (a: Area, userId: number | null) => {
    const who = userId ? people.find((p) => p.id === userId)?.name : null;
    void act(() => adminSend("PUT", `/classes/${detail.id}/area-teachers/${a.key}`, { userId }), who ? `${who} rates ${a.name} now.` : `${a.name} is back on automatic.`);
  };
  const areaColumns: ColumnDef<Area>[] = [
    { id: "area", accessorFn: (a) => a.name, header: "Learning area", meta: { className: "font-medium" } },
    {
      id: "rater",
      accessorFn: (a) => a.teacher?.name ?? "",
      header: "Rated by",
      cell: ({ row: { original: a } }) => <RaterPicker detail={detail} area={a} people={people} busy={busy} onPick={(id) => choose(a, id)} />,
    },
    {
      id: "why",
      accessorFn: (a) => (a.teachers.length > 1 && a.source !== "set" ? 0 : a.source === "set" ? 1 : a.source === "subject" ? 2 : 3),
      header: "Why",
      cell: ({ row: { original: a } }) => (
        <span className="flex items-center gap-2">
          <AreaReason area={a} />
          {a.source === "set" && (
            <Button variant="link" size="sm" disabled={busy} className="h-auto p-0 text-xs text-muted-foreground" onClick={() => choose(a, null)}>
              Reset
            </Button>
          )}
        </span>
      ),
    },
  ];
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="grid gap-4">
        {clashes.map((a) => (
          <Alert key={a.key} className="border-warn/50 bg-warn/10">
            <TriangleAlert className="text-warn-foreground" />
            <AlertTitle>
              {a.teachers.map((t) => t.name).join(" and ")} both teach {a.subject}
            </AlertTitle>
            <AlertDescription>{a.teacher ? `${a.teacher.name} rates ${a.name} for now.` : `Nobody rates ${a.name} yet.`} Choose who rates it below so it is clear.</AlertDescription>
          </Alert>
        ))}
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
          <p className="border-b px-4 py-3 text-sm text-muted-foreground">The person on each row rates that area for every child in this class, then sends it to the lead teacher.</p>
          <DataTable columns={areaColumns} data={detail.areaTeachers} getRowId={(a) => a.key} />
        </Card>
      </div>

      <Card className="gap-0 py-0 shadow-none">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-muted-foreground">
              <Icon name="teachers" size={16} />
            </span>
            By teacher
          </CardTitle>
          <CardDescription className="text-xs">What each person rates.</CardDescription>
        </CardHeader>
        {people.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Nobody teaches this class yet.</p>
        ) : (
          <ul className="divide-y">
            {people.map((p) => {
              const rates = ratedBy(detail, p.id);
              return (
                <li key={p.id} className="grid gap-0.5 px-4 py-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {p.name} {p.role === "lead" && <span className="font-normal text-muted-foreground">Lead</span>}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {rates.length} {rates.length === 1 ? "area" : "areas"}
                    </span>
                  </span>
                  <span className="text-[13px] text-muted-foreground">{rates.length ? rates.map((a) => a.name).join(", ") : "Nothing to rate"}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">The lead also checks every area and sends the whole report for review.</p>
      </Card>
    </div>
  );
}

/** The stages that count as done (sent for review), furthest along first. */
const SENT: ReportStage[] = ["approved", "submitted", "changes_requested"];

/** The class in one strip: children, teachers, reports waiting for review and how far the reports are. */
export function ClassGlance({ detail }: { detail: ClassDetail }) {
  const active = detail.pupils.filter((p) => !p.left);
  const counts = Object.fromEntries(REPORT_STAGES.map((s) => [s, active.filter((p) => stageOf(p.status) === s).length])) as Record<ReportStage, number>;
  const written = counts.submitted + counts.changes_requested + counts.approved;
  const cell = "grid content-start gap-1 bg-card px-5 py-4";
  const label = "flex items-center gap-1.5 text-xs text-muted-foreground";
  const value = "text-xl font-semibold tabular-nums";
  return (
    <section aria-label="This class at a glance" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
      <div className={cell}>
        <p className={label}>
          <Icon name="children" size={14} /> Children
        </p>
        <p className={value}>{active.length}</p>
      </div>
      <div className={cell}>
        <p className={label}>
          <Icon name="teachers" size={14} /> Teachers
        </p>
        <p className={value}>{classPeople(detail).length}</p>
      </div>
      <div className={cell}>
        <p className={label}>
          <Icon name="reviews" size={14} /> {STAGE_LABEL.submitted}
        </p>
        <p className={value}>{counts.submitted}</p>
      </div>
      <div className={cn(cell, "gap-2")}>
        <p className="flex justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Icon name="reports" size={14} /> Reports sent
          </span>
          <span className="font-medium tabular-nums">
            {written} / {active.length} · {active.length ? Math.round((written / active.length) * 100) : 0}%
          </span>
        </p>
        <Progress value={active.length ? (written / active.length) * 100 : 0} className="h-1.5" aria-label={`${written} of ${active.length} learning reports sent for review`} />
        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {SENT.filter((s) => counts[s] > 0).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ background: STAGE_FILL[s] }} aria-hidden />
              {counts[s]} {STAGE_LABEL[s].toLowerCase()}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/** Moves a child to another class of their level this year. Children never change age group. */
function MoveChild({ child, classes, detail, open, onOpenChange }: { child: ClassChild; classes: ClassSummary[]; detail: ClassDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { busy, act } = useAct();
  // A child in the wrong class by birthday moves to a class of the level their birthday gives.
  const level = child.level ?? detail.level;
  const others = classes.filter((k) => k.id !== detail.id && k.level === level);
  const [to, setTo] = useState<number | null>(null);
  const target = others.find((k) => k.id === to) ?? null;
  const wrongLevel = level !== detail.level;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!target) return;
            if (await act(() => adminSend("POST", `/reviews/${child.reviewId}/move`, { classId: target.id }), `${child.name} moved to ${target.name}.`)) onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Move {child.name}</DialogTitle>
            <DialogDescription>{wrongLevel ? "Choose their new class." : `To another ${detail.level} class.`}</DialogDescription>
          </DialogHeader>
          {wrongLevel && (
            <p className="flex items-start gap-2.5 rounded-lg border border-warn/50 bg-warn/10 px-3.5 py-3 text-sm text-warn-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {child.name} was born on {birthday(child.dateOfBirth)}, so this year they are {level}.
              </span>
            </p>
          )}
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">There is no other {level} class this semester. Create one on the Classes page first.</p>
          ) : (
            <RadioGroup value={target ? String(target.id) : ""} onValueChange={(v) => setTo(Number(v))} aria-label="New class" className="grid gap-2.5">
              {others.map((k) => {
                const teachers = [...(k.lead ? [k.lead] : []), ...k.co].map((t) => t.name).join(", ");
                return (
                  <Label
                    key={k.id}
                    htmlFor={`mv-${child.reviewId}-${k.id}`}
                    className="flex cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-3.5 font-normal has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-foreground"
                  >
                    <RadioGroupItem id={`mv-${child.reviewId}-${k.id}`} value={String(k.id)} />
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="block font-heading text-lg font-semibold">{k.name}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">{teachers || "No teacher yet"}</span>
                    </span>
                    <span className="text-sm font-semibold">
                      {k.children} {k.children === 1 ? "child" : "children"}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          )}
          <p className="text-sm text-muted-foreground">Their ratings, comments, photos and report move with them.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={busy || !target}>{target ? `Move to ${target.name}` : "Move"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const itemCls = "items-start gap-3 py-2";
const itemTitle = "block font-medium leading-tight";
const itemHint = "block text-xs font-normal text-muted-foreground";

/** The buttons at the end of a child's row, and the dialogs they open. */
function ChildActions({ child, detail, classes, misplaced }: { child: ClassChild; detail: ClassDetail; classes: ClassSummary[]; misplaced: boolean }) {
  const { busy, act } = useAct();
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "move" | "remove" | null>(null);
  return (
    <>
      <span className="flex items-center justify-end gap-1">
        {child.left ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => act(() => adminSend("POST", `/reviews/${child.reviewId}/left`, { left: false }), `${child.name} is back in ${detail.name}.`)}>
            Return to class
          </Button>
        ) : (
          <>
            {misplaced && child.level ? (
              <Button variant="outline" size="sm" className="border-warn/60 text-warn-foreground hover:bg-warn/20" onClick={() => setDialog("move")}>
                Move to {child.level} <ArrowRight />
              </Button>
            ) : child.hasReport ? (
              <Button asChild variant="ghost" size="sm" className="text-foreground hover:text-foreground">
                <Link href={`/child/${child.reviewId}/report`}>Open report</Link>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Options for ${child.name}`}>
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem className={itemCls} asChild>
                  <Link href={`/children/${child.childId}`}>
                    <UserRound className="mt-0.5" />
                    <span>
                      <span className={itemTitle}>View profile</span>
                      <span className={itemHint}>Parents, past reports, notes</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className={itemCls} onSelect={() => setDialog("edit")}>
                  <Pencil className="mt-0.5" />
                  <span>
                    <span className={itemTitle}>Edit details</span>
                    <span className={itemHint}>Name, birthday, pronouns</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className={itemCls} onSelect={() => setDialog("move")}>
                  <ArrowRightLeft className="mt-0.5" />
                  <span>
                    <span className={itemTitle}>Move to another class</span>
                    <span className={itemHint}>Ratings and report go with them</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className={itemCls} onSelect={() => act(() => adminSend("POST", `/reviews/${child.reviewId}/left`, { left: true }), `${child.name} is marked as left. Their reports are kept.`)}>
                  <LogOut className="mt-0.5" />
                  <span>
                    <span className={itemTitle}>Mark as left the school</span>
                    <span className={itemHint}>Their report is kept</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className={cn(itemCls, "text-destructive focus:text-destructive")} onSelect={() => setDialog("remove")}>
                  <Trash2 className="mt-0.5 text-destructive" />
                  <span>
                    <span className={itemTitle}>Remove (added by mistake)</span>
                    <span className={itemHint}>Deletes them and their reports</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </span>
      {dialog === "edit" && <EditChild child={child} detail={detail} classes={classes} open onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "move" && <MoveChild child={child} classes={classes} detail={detail} open onOpenChange={(o) => !o && setDialog(null)} />}
      <AlertDialog open={dialog === "remove"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {child.name}?</AlertDialogTitle>
            <AlertDialogDescription>This deletes {child.name} and every report of theirs. It cannot be undone. If they left the school, mark them as left instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep {child.name}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                const res = await removeChildAction(child.reviewId);
                if (!res.ok) return void toast.error(res.error);
                toast.success(`${child.name} and their reports are removed.`);
                router.refresh();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ChildTable({ rows, detail, classes, empty }: { rows: ClassChild[]; detail: ClassDetail; classes: ClassSummary[]; empty?: string }) {
  const misplaced = (c: ClassChild) => !c.left && (!!c.levelProblem || c.level !== detail.level);
  const columns: ColumnDef<ClassChild>[] = [
    {
      id: "name",
      accessorFn: (c) => c.name,
      header: "Child",
      cell: ({ row: { original: c } }) => (
        <span className="flex items-center gap-3">
          <ChildAvatar src={c.photo} name={c.name} size={32} />
          <span className="min-w-0 leading-tight">
            <span className="flex flex-wrap items-baseline gap-x-2">
              {c.left ? (
                <span className="font-medium">{c.name}</span>
              ) : (
                <Link href={`/children/${c.childId}`} className="font-medium text-foreground underline-offset-4 hover:text-foreground hover:underline">
                  {c.name}
                </Link>
              )}
              {c.chineseName && <span className="text-muted-foreground">{c.chineseName}</span>}
            </span>
            {misplaced(c) && (
              <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-warn-foreground">
                <TriangleAlert className="size-3 shrink-0" aria-hidden /> {c.levelProblem ? `${LEVEL_PROBLEM_TEXT[c.levelProblem]}.` : `Born ${c.dateOfBirth.slice(0, 4)}, so ${c.level} this year.`}
              </span>
            )}
          </span>
        </span>
      ),
    },
    {
      id: "birthday",
      accessorFn: (c) => c.dateOfBirth,
      header: "Birthday",
      meta: { className: "text-muted-foreground" },
      cell: ({ row: { original: c } }) => `${birthday(c.dateOfBirth)} · ${c.pronoun}`,
    },
    {
      id: "status",
      accessorFn: (c) => (c.left ? 99 : REPORT_STAGES.indexOf(stageOf(c.status))),
      header: "Learning report",
      cell: ({ row: { original: c } }) => <StatusBadge status={c.status} left={c.left} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row: { original: c } }) => <ChildActions child={c} detail={detail} classes={classes} misplaced={misplaced(c)} />,
    },
  ];
  return <DataTable columns={columns} data={rows} getRowId={(c) => c.reviewId} rowClassName={(c) => misplaced(c) && "bg-warn/10 hover:bg-warn/15"} empty={empty} />;
}

const ALL = "all";

export function ClassChildren({ detail, classes }: { detail: ClassDetail; classes: ClassSummary[] }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const needle = q.trim().toLowerCase();
  const matches = (p: ClassChild) => (!needle || p.name.toLowerCase().includes(needle) || p.chineseName.includes(needle)) && (stage === ALL || stageOf(p.status) === stage);
  const active = detail.pupils.filter((p) => !p.left);
  const shown = active.filter(matches);
  const left = detail.pupils.filter((p) => p.left);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <TableSearch value={q} onChange={setQ} label="Find a child" placeholder="Filter children…" />
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-48 bg-card" aria-label="Filter by report status">
              <SelectValue>{stage === ALL ? "All statuses" : STAGE_LABEL[stage as ReportStage]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {REPORT_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STAGE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {shown.length === active.length ? `${active.length} ${active.length === 1 ? "child" : "children"}` : `${shown.length} of ${active.length} children`}
        </p>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <ChildTable rows={shown} detail={detail} classes={classes} empty={active.length === 0 ? "No children in this class yet. Use “Add a child” to place the first one." : "Nobody matches these filters."} />
        {left.length > 0 && (
          <Collapsible className="group/left border-t">
            <CollapsibleTrigger className="flex h-11 w-full items-center gap-2 px-4 text-left text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50">
              <ChevronRight className="size-4 transition-transform group-data-[state=open]/left:rotate-90" aria-hidden />
              Children who have left the school ({left.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t">
              <ChildTable rows={left} detail={detail} classes={classes} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </Card>
    </div>
  );
}
