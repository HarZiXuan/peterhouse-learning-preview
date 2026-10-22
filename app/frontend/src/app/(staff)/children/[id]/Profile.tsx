"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, X } from "lucide-react";
import type { ChildProfile, ChildSemester, ClassSummary, Guardian } from "@peterhouse/shared";
import { adminSend } from "@/lib/admin-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditChild } from "../../classes/[id]/ClassManager";

/** Edit details (name, birthday) works on this semester's enrolment, so it shows only while the child is in a class now. */
export function ProfileActions({ child, current, classes, year }: { child: ChildProfile; current: ChildSemester | null; classes: ClassSummary[]; year: number }) {
  const [open, setOpen] = useState(false);
  if (!current || child.left) return null;
  return (
    <>
      <Button variant="outline" className="h-10 px-4 font-semibold" onClick={() => setOpen(true)}>
        <Pencil /> Edit details
      </Button>
      {open && (
        <EditChild
          child={{ reviewId: current.reviewId, name: child.name, firstName: child.firstName, lastName: child.lastName, chineseName: child.chineseName, pronoun: child.pronoun, dateOfBirth: child.dateOfBirth }}
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

/** One form for everything the school keeps about the child: join date, parents, notes. */
export function EditInfo({ child }: { child: ChildProfile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinedOn, setJoinedOn] = useState(child.joinedOn);
  const [guardians, setGuardians] = useState<Guardian[]>(child.guardians.length ? child.guardians : [BLANK_GUARDIAN]);
  const [notes, setNotes] = useState(child.notes);

  function reset() {
    setJoinedOn(child.joinedOn);
    setGuardians(child.guardians.length ? child.guardians : [BLANK_GUARDIAN]);
    setNotes(child.notes);
  }
  const setGuardian = (i: number, patch: Partial<Guardian>) => setGuardians((gs) => gs.map((g, n) => (n === i ? { ...g, ...patch } : g)));

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-mr-2 font-semibold text-primary hover:text-primary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <form
            className="grid gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const err = await adminSend("PUT", `/children/${child.id}/info`, { joinedOn, guardians, notes });
              setBusy(false);
              if (err) return void toast.error(err);
              toast.success("Saved.");
              setOpen(false);
              router.refresh();
            }}
          >
            <DialogHeader>
              <DialogTitle>{child.name}’s information</DialogTitle>
              <DialogDescription>Only administrators see and change this. It is stored encrypted.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="joined">Joined Peterhouse</Label>
              <Input id="joined" type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} required className="w-auto justify-self-start" />
            </div>

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
                  <Input aria-label="Phone" placeholder="Phone" type="tel" value={g.phone} onChange={(e) => setGuardian(i, { phone: e.target.value })} maxLength={40} />
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

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button disabled={busy}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
