"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, X } from "lucide-react";
import type { ChildProfile, ChildSemester, ClassSummary, Guardian } from "@peterhouse/shared";
import { REPORT_STAGES, stageOf } from "@peterhouse/shared";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { adminSend } from "@/lib/admin-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { guardiansPhoneProblem } from "@/lib/phone";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROFILE_DIALOG, ProfileForm, ProfilePhoto } from "@/components/ProfileForm";
import { EditChild } from "../../classes/[id]/ClassManager";
import { StatusBadge } from "../../classes/shared";

/** Edit details (name, birthday) works on this semester's enrolment, so it shows only while the child is in a class now. */
export function ProfileActions({ child, current, classes, year }: { child: ChildProfile; current: ChildSemester | null; classes: ClassSummary[]; year: number }) {
  const [open, setOpen] = useState(false);
  if (!current || child.left) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil /> Edit details
      </Button>
      {open && (
        <EditChild
          child={{ reviewId: current.reviewId, childId: child.id, photo: child.photo, name: child.name, firstName: child.firstName, lastName: child.lastName, chineseName: child.chineseName, pronoun: child.pronoun, dateOfBirth: child.dateOfBirth }}
          detail={{ name: current.className, level: current.level, year }}
          classes={classes}
          open
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

const BLANK_GUARDIAN: Guardian = { name: "", relationship: "", phone: "", email: "" };

/** One form for everything the school keeps about the child: join date, photo consent, parents, notes. */
export function EditInfo({ child }: { child: ChildProfile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinedOn, setJoinedOn] = useState(child.joinedOn);
  const [guardians, setGuardians] = useState<Guardian[]>(child.guardians.length ? child.guardians : [BLANK_GUARDIAN]);
  const [notes, setNotes] = useState(child.notes);
  const [photoConsent, setPhotoConsent] = useState(child.photoConsent);

  function reset() {
    setJoinedOn(child.joinedOn);
    setGuardians(child.guardians.length ? child.guardians : [BLANK_GUARDIAN]);
    setNotes(child.notes);
    setPhotoConsent(child.photoConsent);
  }
  const setGuardian = (i: number, patch: Partial<Guardian>) => setGuardians((gs) => gs.map((g, n) => (n === i ? { ...g, ...patch } : g)));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Pencil /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={PROFILE_DIALOG}>
          <ProfileForm
            title={`${child.name}’s information`}
            description="Only administrators see and change this. It is stored encrypted."
            photo={<ProfilePhoto endpoint={`/api/children/${child.id}/photo`} photo={child.photo} name={child.firstName || child.name} okMessage={`Photo saved. It is also the cover of ${child.name}’s report.`} />}
            busy={busy}
            onSubmit={async (e) => {
              e.preventDefault();
              const badPhone = guardiansPhoneProblem(guardians);
              if (badPhone) return void toast.error(badPhone);
              setBusy(true);
              const err = await adminSend("PUT", `/children/${child.id}/info`, { joinedOn, guardians, notes, photoConsent });
              setBusy(false);
              if (err) return void toast.error(err);
              toast.success("Saved.");
              setOpen(false);
              router.refresh();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="joined">Joined Peterhouse</Label>
              <Input id="joined" type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} required className="w-auto justify-self-start" />
            </div>

            <Label htmlFor="consent" className="flex items-start gap-2 text-sm font-normal">
              <Checkbox id="consent" checked={photoConsent} onCheckedChange={(v) => setPhotoConsent(v === true)} className="mt-0.5" />
              <span>
                <span className="font-semibold">Parents gave photo consent.</span> Without it, teachers cannot add photos and none print on the report.
              </span>
            </Label>

            <fieldset className="grid gap-3">
              <legend className="mb-2 font-heading text-base font-semibold">Parents and guardians</legend>
              {guardians.map((g, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                  <Input aria-label="Name" placeholder="Name" value={g.name} onChange={(e) => setGuardian(i, { name: e.target.value })} maxLength={100} />
                  <div className="flex gap-2">
                    <Input aria-label="Relationship" placeholder="Mother, father, grandmother…" value={g.relationship} onChange={(e) => setGuardian(i, { relationship: e.target.value })} maxLength={40} />
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${g.name || "this person"}`} onClick={() => setGuardians((gs) => gs.filter((_, n) => n !== i))}>
                      <X />
                    </Button>
                  </div>
                  <PhoneInput label={`Phone of ${g.name || "this person"}`} value={g.phone} onChange={(phone) => setGuardian(i, { phone })} />
                  <Input aria-label="Email" placeholder="Email" type="email" value={g.email} onChange={(e) => setGuardian(i, { email: e.target.value })} maxLength={200} />
                </div>
              ))}
              {guardians.length < 6 && (
                <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setGuardians((gs) => [...gs, BLANK_GUARDIAN])}>
                  <Plus /> Add a parent or guardian
                </Button>
              )}
            </fieldset>


            <div className="grid gap-2">
              <Label htmlFor="notes" className="font-heading text-base font-semibold">Staff notes</Label>
              <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} placeholder="Pickup arrangements, things staff should know…" />
            </div>

          </ProfileForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

const semesterColumns: ColumnDef<ChildSemester>[] = [
  {
    id: "semester",
    accessorFn: (s) => s.year * 10 + s.semester,
    header: "Semester",
    meta: { className: "font-medium" },
    cell: ({ row: { original: s } }) => (
      <>
        {s.year} · Semester {s.semester}
        {s.current && (
          <Badge variant="secondary" className="ml-2">
            Now
          </Badge>
        )}
      </>
    ),
  },
  {
    id: "class",
    accessorFn: (s) => s.className,
    header: "Class",
    cell: ({ row: { original: s } }) => (
      <>
        <span className="text-muted-foreground">{s.level} ·</span> {s.className}
      </>
    ),
  },
  { id: "teachers", accessorFn: (s) => s.teachers.join(", "), header: "Teachers", meta: { className: "whitespace-normal text-muted-foreground" }, cell: ({ getValue }) => (getValue() as string) || "—" },
  { id: "status", accessorFn: (s) => REPORT_STAGES.indexOf(stageOf(s.status)), header: "Report", cell: ({ row: { original: s } }) => <StatusBadge status={s.status} /> },
  {
    id: "open",
    header: () => <span className="sr-only">Open</span>,
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row: { original: s } }) => (
      <Button asChild variant="ghost" size="sm" className="text-foreground hover:text-foreground">
        <Link href={s.hasReport ? `/child/${s.reviewId}/report` : `/child/${s.reviewId}`}>{s.hasReport ? "Open report" : "Open review"}</Link>
      </Button>
    ),
  },
];

/** Every semester the child was at school, newest first, with its report. */
export function SemestersTable({ semesters }: { semesters: ChildSemester[] }) {
  return <DataTable columns={semesterColumns} data={semesters} getRowId={(s) => s.reviewId} empty="No semesters yet." />;
}
