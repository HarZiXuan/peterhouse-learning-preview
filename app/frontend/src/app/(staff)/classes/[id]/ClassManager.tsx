"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ArrowRightLeft, ChevronRight, Ellipsis, Info, LogOut, Pencil, Plus, Search, Trash2, TriangleAlert, UserRound } from "lucide-react";
import type { ClassChild, ClassDetail, ClassSummary, LevelProblem, Pronoun, ReviewStatus, StaffRef, SubjectTeacher } from "@peterhouse/shared";
import { LEVEL_PROBLEM_TEXT, STATUS_LABEL, birthdayRange, classLevel, levelForBirthday } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { ChildAvatar, initials } from "@/components/ui";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SUBJECT_SWATCH } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { SELECT } from "../../AddChild";
import { removeChildAction } from "../../actions";
import { Meter, STATUS_FILL, STATUS_ORDER, STATUS_TONE, TeacherStack, capacityOf, personTint } from "../shared";

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
  child: Pick<ClassChild, "reviewId" | "name" | "firstName" | "lastName" | "chineseName" | "pronoun" | "dateOfBirth">;
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
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
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
          <DialogHeader>
            <DialogTitle>Edit {child.name}</DialogTitle>
            <DialogDescription>Changes show on their form and report straight away.</DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button disabled={busy || blocked}>{target ? "Save and move" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClassTeachers({ detail, teachers, classes }: { detail: ClassDetail; teachers: StaffRef[]; classes: ClassSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const [setting, setSetting] = useState<SubjectTeacher | null>(null);
  const ratio = classLevel(detail.level).ratio;
  const people = [...(detail.lead ? [{ ...detail.lead, isLead: true }] : []), ...detail.co.map((c) => ({ ...c, isLead: false }))];
  const here = new Set(people.map((p) => p.id));
  const prev = { leadId: detail.lead?.id ?? null, coIds: detail.co.map((c) => c.id) };

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
  const remove = (t: StaffRef & { isLead: boolean }) =>
    save(t.isLead ? { leadId: null, coIds: prev.coIds } : { leadId: prev.leadId, coIds: prev.coIds.filter((id) => id !== t.id) }, people.length === 1 ? `${t.name} removed. Only administrators see ${detail.name} now.` : `${t.name} removed from ${detail.name}.`);

  const subjectsOf = (id: number) => (detail.teacherSubjects[id] ?? []).flatMap((sid) => detail.subjects.filter((x) => x.id === sid));
  const taughtIn = (t: StaffRef) => classes.filter((k) => k.id !== detail.id && (k.lead?.id === t.id || k.co.some((c) => c.id === t.id))).map((k) => k.name);
  const options = teachers
    .filter((t) => !here.has(t.id) && t.name.toLowerCase().includes(q.trim().toLowerCase()))
    .map((t) => ({ t, in: taughtIn(t) }))
    .sort((a, b) => a.in.length - b.in.length);
  const full = detail.capacity > 0 && detail.children >= detail.capacity;

  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle className="font-heading text-[22px] font-semibold">Teachers</CardTitle>
        <CardDescription>These teachers can rate the children and write their learning reports. Changes save as you go.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no teacher accounts yet.{" "}
            <Link href="/settings/people" className="underline underline-offset-4">
              Add them in People and sign-ins
            </Link>
            .
          </p>
        ) : (
          <>
            {people.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Nobody teaches this class yet, so only administrators can see it.</p>
            ) : (
              <ul className="divide-y border-y">
                {people.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <Avatar className={cn("size-11", personTint(i))}>
                      <AvatarFallback className={cn("text-sm font-bold", personTint(i))}>{initials(p.name)}</AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 gap-1 leading-snug">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-bold">{p.name}</span>
                        <Badge className={cn("border-transparent px-2.5 font-bold", p.isLead ? "bg-[#dbeef9] text-[#0a3a57]" : "bg-secondary text-muted-foreground")}>{p.isLead ? "Lead teacher" : "Teacher"}</Badge>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted-foreground">
                        Teaches
                        {subjectsOf(p.id).length === 0 ? (
                          <b className="font-bold text-foreground">all subjects</b>
                        ) : (
                          subjectsOf(p.id).map((x) => (
                            <span key={x.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-bold text-foreground">
                              <span className="size-2 rounded-full" style={{ background: SUBJECT_SWATCH[x.color] }} aria-hidden />
                              {x.name}
                            </span>
                          ))
                        )}
                      </span>
                      <button type="button" disabled={busy} className="w-fit text-[13.5px] font-bold text-primary underline-offset-4 hover:underline" onClick={() => setSetting({ id: p.id, name: p.name, subjectIds: detail.teacherSubjects[p.id] ?? [] })}>
                        {subjectsOf(p.id).length ? "Change subjects" : "Choose subjects"}
                      </button>
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="-mr-2 text-muted-foreground" aria-label={`Options for ${p.name}`} disabled={busy}>
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setSetting({ id: p.id, name: p.name, subjectIds: detail.teacherSubjects[p.id] ?? [] })}>Set subjects</DropdownMenuItem>
                        {!p.isLead && <DropdownMenuItem onSelect={() => makeLead(p)}>Make lead</DropdownMenuItem>}
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => remove(p)}>
                          Remove from class
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}

            <p className="flex items-start gap-2.5 rounded-lg bg-[#eef6fb] px-3.5 py-3 text-sm text-[#0a3a57]">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <b>Why does this matter?</b> Every teacher adds room for {ratio} children in {classLevel(detail.level).name}.{" "}
                {people.length > 0 ? `With ${people.length === 1 ? "1 teacher" : `${people.length} teachers`}, this class can take up to ${ratio * people.length}.` : "Add a teacher to give this class room for children."}
                {full ? " It is full now, so add a teacher to take another child." : ""}
              </span>
            </p>

            <Popover open={picker} onOpenChange={(o) => (setPicker(o), !o && setQ(""))}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 font-semibold" disabled={busy}>
                  <Plus /> Add a teacher
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-80 p-2">
                <div className="relative mb-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a teacher" aria-label="Find a teacher" className="h-10 pl-9" autoFocus />
                </div>
                {options.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">{q ? "Nobody matches." : "Every teacher is already in this class."}</p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto">
                    {options.map(({ t, in: classesTaught }, i) => (
                      <li key={t.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/60">
                        <Avatar className={cn("size-9", personTint(i))}>
                          <AvatarFallback className={cn("text-xs font-bold", personTint(i))}>{initials(t.name)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="block truncate text-sm font-semibold">{t.name}</span>
                          <span className={cn("block truncate text-[13px]", classesTaught.length === 0 ? "font-semibold text-success" : "text-muted-foreground")}>{classesTaught.length === 0 ? "Not in a class yet" : `Teaches ${classesTaught.join(", ")}`}</span>
                        </span>
                        <Button size="sm" variant="outline" className="h-9 px-3.5 font-semibold" onClick={() => add(t)}>
                          Add
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/settings/people" className="mt-1.5 flex items-center justify-between gap-2 border-t px-2 pb-1 pt-3 text-[13px] font-semibold text-primary">
                  Teacher not here? Add them in People and sign-ins <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Link>
              </PopoverContent>
            </Popover>
          </>
        )}
      </CardContent>
      {setting && <SubjectTeacherDialog key={setting.id} detail={detail} teacher={setting} isStaff available={[]} onClose={() => setSetting(null)} />}
    </Card>
  );
}

function SubjectTeacherDialog({ detail, teacher, available, isStaff = false, onClose }: { detail: ClassDetail; teacher: SubjectTeacher | null; available: StaffRef[]; isStaff?: boolean; onClose: () => void }) {
  const { busy, act } = useAct();
  const [userId, setUserId] = useState<number>(teacher?.id ?? 0);
  const [picked, setPicked] = useState<number[]>(teacher?.subjectIds ?? []);
  const name = teacher?.name ?? available.find((t) => t.id === userId)?.name ?? "";
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const save = async () => {
    const ok = await act(
      () => adminSend("PUT", `/classes/${detail.id}/subject-teachers/${userId}`, { subjectIds: picked }),
      teacher ? (picked.length === 0 && isStaff ? `${name} teaches every subject in ${detail.name}.` : `${name}’s subjects in ${detail.name} are saved.`) : `${name} now teaches ${picked.map((id) => detail.subjects.find((x) => x.id === id)?.name).join(" and ")} in ${detail.name}.`,
    );
    if (ok) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{teacher ? `${teacher.name}’s subjects` : "Add a subject teacher"}</DialogTitle>
          <DialogDescription>{isStaff ? `The subjects they teach in ${detail.name}. With none chosen they teach every subject.` : `They see ${detail.name}’s children and rate them. They cannot write or send the reports.`}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {!teacher && (
            <div className="grid gap-1.5">
              <Label htmlFor="st-teacher">Teacher</Label>
              <select id="st-teacher" className={SELECT} value={userId || ""} onChange={(e) => setUserId(Number(e.target.value))}>
                <option value="">Choose a teacher</option>
                {available.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Subjects they teach here</legend>
            <div className="flex flex-wrap gap-2">
              {detail.subjects.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={picked.includes(x.id)}
                  onClick={() => toggle(x.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold text-muted-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
                >
                  <span className="size-2.5 rounded-full" style={{ background: SUBJECT_SWATCH[x.color] }} aria-hidden />
                  {x.name}
                </button>
              ))}
            </div>
            {teacher && !isStaff && picked.length === 0 && <p className="text-[13px] text-muted-foreground">With no subjects, {teacher.name} is taken off this class and its lessons.</p>}
          </fieldset>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={busy || !userId || (!teacher && picked.length === 0)} onClick={save}>
            {teacher && !isStaff && picked.length === 0 ? "Remove from class" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The class in three plain boxes: how many children, who teaches, how far the learning reports are. */
export function ClassGlance({ detail }: { detail: ClassDetail }) {
  const active = detail.pupils.filter((p) => !p.left);
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, active.filter((p) => p.status === s).length])) as Record<ReviewStatus, number>;
  const written = counts.written + counts.submitted + counts.changes_requested + counts.approved;
  const cap = capacityOf({ children: active.length, capacity: detail.capacity });
  const ratio = classLevel(detail.level).ratio;
  const people = [...(detail.lead ? [detail.lead] : []), ...detail.co];
  const co = detail.co.map((c) => c.name);
  const label = "text-xs font-extrabold uppercase tracking-widest text-muted-foreground";
  const roomText =
    cap.state === "none" ? "No teacher yet, so the class has no room set." : cap.state === "over" ? `${active.length - detail.capacity} more than the class can take.` : cap.state === "full" ? "This class is full." : `Room for ${detail.capacity - active.length} more.`;
  const breakdown = [...STATUS_ORDER].reverse().filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${STATUS_LABEL[s].toLowerCase()}`);
  return (
    <section aria-label="This class at a glance" className="grid gap-4 md:grid-cols-3">
      <Card className="gap-2.5 rounded-[20px] px-[22px] py-5 shadow-none">
        <p className={label}>Children</p>
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-[44px] font-bold leading-none">{active.length}</span>
          <span className="font-bold text-foreground/80">in this class</span>
        </p>
        <Meter value={active.length} max={detail.capacity} tone={cap.state === "over" ? "over" : "default"} label={`${active.length} children, room for ${detail.capacity}`} className="h-2" />
        <p className="text-sm">
          <b className={cn(cap.state === "over" && "text-destructive")}>{roomText}</b>{" "}
          <span className="text-muted-foreground">
            Each teacher can look after {ratio} children{people.length > 0 ? `, and this class has ${people.length === 1 ? "1 teacher" : `${people.length} teachers`}.` : "."}
          </span>
        </p>
      </Card>

      <Card className="gap-2.5 rounded-[20px] px-[22px] py-5 shadow-none">
        <p className={label}>Teachers</p>
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-[44px] font-bold leading-none">{people.length}</span>
          <span className="font-bold text-foreground/80">{people.length === 1 ? "teacher" : "teaching this class"}</span>
        </p>
        <div className="flex min-h-2 items-center">{people.length > 0 && <TeacherStack people={people} />}</div>
        <p className="text-sm">
          {detail.lead ? (
            <>
              <b>{detail.lead.name}</b> is the lead teacher{co.length ? <>, with <b>{co.join(", ")}</b></> : ""}.
            </>
          ) : people.length > 0 ? (
            <>
              <b>{co.join(", ")}</b> teach{co.length === 1 ? "es" : ""} this class. It has no lead teacher yet.
            </>
          ) : (
            <span className="font-bold text-warn-foreground">Nobody teaches this class yet, so only administrators can see it.</span>
          )}
        </p>
      </Card>

      <Card className="gap-2.5 rounded-[20px] px-[22px] py-5 shadow-none">
        <p className={label}>Learning reports</p>
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-[44px] font-bold leading-none">
            {written} <span className="text-2xl text-muted-foreground">of {active.length}</span>
          </span>
          <span className="font-bold text-foreground/80">written</span>
        </p>
        <div role="img" aria-label={STATUS_ORDER.map((s) => `${counts[s]} ${STATUS_LABEL[s].toLowerCase()}`).join(", ")} className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-border">
          {[...STATUS_ORDER].reverse().filter((s) => counts[s] > 0 && s !== "not_started").map((s) => (
            <div key={s} className="h-full" style={{ width: `${(counts[s] / Math.max(1, active.length)) * 100}%`, background: STATUS_FILL[s] }} />
          ))}
        </div>
        <p className="text-sm">
          <b>{breakdown.length ? breakdown.join(" · ") : "No reports yet"}</b> <span className="text-muted-foreground">Each child gets one learning report every semester.</span>
        </p>
      </Card>
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
                const cap = capacityOf({ children: k.children + 1, capacity: k.capacity });
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
                    <span className="text-right leading-snug">
                      <span className="block text-sm font-semibold">
                        {k.children} of {k.capacity || "—"}
                      </span>
                      <span className={cn("block text-[13px] font-bold", cap.state === "over" ? "text-destructive" : "text-muted-foreground")}>{cap.state === "over" ? `Would be ${k.children + 1 - k.capacity} over` : cap.state === "none" ? "No teacher yet" : `${k.capacity - k.children} free`}</span>
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
const itemTitle = "block font-semibold leading-tight";
const itemHint = "block text-xs font-normal text-muted-foreground";

/** What the button beside a child says, from how far their learning report is. */
const reportAction = (c: ClassChild) => (c.hasReport ? "Open report" : c.status === "not_started" ? "Start report" : c.status === "ready" ? "Write report" : "Continue");

function ChildRow({ child, detail, classes }: { child: ClassChild; detail: ClassDetail; classes: ClassSummary[] }) {
  const { busy, act } = useAct();
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "move" | "remove" | null>(null);
  const misplaced = !child.left && (!!child.levelProblem || child.level !== detail.level);
  const flagText = child.levelProblem ? `${LEVEL_PROBLEM_TEXT[child.levelProblem]}.` : `Born ${child.dateOfBirth.slice(0, 4)}, so ${child.level} this year.`;

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3.5 sm:px-6", misplaced && "bg-warn/10")}>
      <ChildAvatar name={child.name} size={44} />
      <div className="min-w-0 flex-1 basis-48 leading-snug">
        <p className="flex flex-wrap items-baseline gap-x-2.5">
          {child.left ? (
            <span className="text-base font-bold">{child.name}</span>
          ) : (
            <Link href={child.hasReport ? `/child/${child.reviewId}/report` : `/child/${child.reviewId}`} className="text-base font-bold text-foreground underline-offset-4 hover:text-foreground hover:underline">
              {child.name}
            </Link>
          )}
          {child.chineseName && <span className="text-muted-foreground">{child.chineseName}</span>}
        </p>
        <p className="text-[13px] text-muted-foreground">
          {birthday(child.dateOfBirth)} · {child.pronoun}
        </p>
        {misplaced && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-warn-foreground">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {flagText}
          </p>
        )}
      </div>
      <span className="md:w-[150px] md:shrink-0">
        <Badge className={cn("h-7 px-3 text-[13px] font-bold", child.left ? "border-transparent bg-secondary text-muted-foreground" : STATUS_TONE[child.status])}>{child.left ? "Left" : STATUS_LABEL[child.status]}</Badge>
      </span>
      {child.left ? (
        <Button variant="outline" disabled={busy} className="h-10 font-semibold" onClick={() => act(() => adminSend("POST", `/reviews/${child.reviewId}/left`, { left: false }), `${child.name} is back in ${detail.name}.`)}>
          Return to class
        </Button>
      ) : (
        <>
          <span className="md:w-[140px] md:shrink-0">
            {misplaced && child.level ? (
              <Button variant="outline" className="h-10 w-full border-warn/60 bg-warn/10 font-semibold text-warn-foreground hover:bg-warn/20" onClick={() => setDialog("move")}>
                Move to {child.level} <ArrowRight />
              </Button>
            ) : (
              <Button asChild variant="outline" className="h-10 w-full font-semibold text-foreground hover:text-foreground">
                <Link href={child.hasReport ? `/child/${child.reviewId}/report` : `/child/${child.reviewId}`}>{reportAction(child)}</Link>
              </Button>
            )}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 text-muted-foreground" aria-label={`Options for ${child.name}`}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
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
    </li>
  );
}

export function ClassChildren({ detail, classes, className }: { detail: ClassDetail; classes: ClassSummary[]; className?: string }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = (p: ClassChild) => !needle || p.name.toLowerCase().includes(needle) || p.chineseName.includes(needle);
  const active = detail.pupils.filter((p) => !p.left);
  const shown = active.filter(matches);
  const left = detail.pupils.filter((p) => p.left);

  return (
    <Card className={cn("gap-0 overflow-hidden py-0 shadow-none", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-5 sm:px-6">
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading text-2xl font-semibold">Children in this class</h2>
            <Badge variant="secondary" className="h-7 min-w-7 px-2 text-[13px] font-bold">
              {active.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Click a child’s name to open their learning report.</p>
        </div>
        {active.length > 5 && (
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a child" aria-label="Find a child" className="h-10 pl-9" />
          </div>
        )}
      </div>
      {active.length > 0 && (
        <div className="hidden items-center gap-4 border-y bg-secondary/40 px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground md:flex" aria-hidden>
          <span className="flex-1">Child</span>
          <span className="w-[150px]">Learning report</span>
          <span className="w-[140px]" />
          <span className="w-10" />
        </div>
      )}
      {active.length === 0 ? (
        <p className="border-t px-6 py-8 text-center text-sm text-muted-foreground">No children in this class yet. Use “Add a child” to place the first one.</p>
      ) : shown.length === 0 ? (
        <p className="border-t px-6 py-8 text-center text-sm text-muted-foreground">Nobody matches “{q}”.</p>
      ) : (
        <ul>
          {shown.map((p) => (
            <ChildRow key={p.reviewId} child={p} detail={detail} classes={classes} />
          ))}
        </ul>
      )}
      {left.length > 0 && (
        <Collapsible className="group/left border-t">
          <CollapsibleTrigger className="flex min-h-13 w-full items-center gap-2 px-4 text-left text-sm font-semibold text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-6">
            <ChevronRight className="size-4 transition-transform group-data-[state=open]/left:rotate-90" aria-hidden />
            Children who have left the school ({left.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul>
              {left.map((p) => (
                <ChildRow key={p.reviewId} child={p} detail={detail} classes={classes} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
