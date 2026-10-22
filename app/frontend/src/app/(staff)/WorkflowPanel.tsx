"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Workflow } from "@peterhouse/shared";
import { Icon } from "@/components/icons";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { approveAction, requestChangesAction, submitForReviewAction, takeBackAction, takeOverAction } from "./actions";

// Singapore time on the server and in every browser, so the page reads the same wherever it is drawn.
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

type Done = { ok: true } | { ok: false; error: string };

/** Sends the report back to the teacher with a short note. */
export function RequestChanges({ reviewId, childName, teacher, busy, run }: { reviewId: number; childName: string; teacher: string | null; busy: boolean; run: (fn: () => Promise<Done>, ok: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={busy}>Request changes</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => requestChangesAction(reviewId, note), `Sent back to ${teacher ?? "the teacher"} with your note.`)) {
              setOpen(false);
              setNote("");
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Send {childName}’s report back</DialogTitle>
            <DialogDescription>{teacher ?? "The teacher"} sees your note at the top of the report, changes it, and sends it again.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`note-${reviewId}`}>What should change?</Label>
            <Textarea id={`note-${reviewId}`} rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please make the maths paragraph a little warmer." required />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button disabled={busy || !note.trim()}>Send back</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Lets an administrator edit the report themselves, after a confirm box. */
export function TakeOver({ reviewId, childName, busy, run, then }: { reviewId: number; childName: string; busy: boolean; run: (fn: () => Promise<Done>, ok: string) => Promise<boolean>; then?: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" disabled={busy}>Take over</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit {childName}’s report yourself?</AlertDialogTitle>
          <AlertDialogDescription>
            For the last-minute case, such as a teacher being away. The teacher cannot change it while you have it. Staff will see “edited by admin” on it, and the activity log records it. Families never see this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              if (await run(() => takeOverAction(reviewId), `You are editing ${childName}’s report. Approve it when it is ready.`)) then?.();
            }}
          >
            Take over
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useRun() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<Done>, ok: string) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const res = await fn();
        if (!res.ok) toast.error(res.error);
        else {
          toast.success(ok);
          router.refresh();
        }
        resolve(res.ok);
      }),
    );
  return { busy, run };
}

/**
 * The status box on a child's report: where the report is (written, waiting for review, changes requested,
 * approved, taken over) and the buttons for this person.
 */
export function WorkflowPanel({
  reviewId,
  childName,
  workflow: w,
  admin,
  teacher,
  inApprovals = false,
}: {
  reviewId: number;
  childName: string;
  workflow: Workflow;
  admin: boolean;
  teacher?: string | null;
  /** On the Approvals page itself, so no link back to it. */
  inApprovals?: boolean;
}) {
  const { busy, run } = useRun();
  const router = useRouter();
  const tone = w.status === "approved" ? "ok" : w.status === "changes_requested" ? "warn" : "info";

  let title = "";
  let body: React.ReactNode = null;
  const actions: React.ReactNode[] = [];

  if (w.status === "approved") {
    title = "Approved";
    body = `${w.approved?.by ?? "An administrator"} approved this report${w.approved ? ` on ${when(w.approved.at)}` : ""}. Download the PDF for the family.`;
    if (admin) actions.push(<RequestChanges key="rc" reviewId={reviewId} childName={childName} teacher={teacher ?? null} busy={busy} run={run} />);
  } else if (w.takenOver) {
    title = admin ? "You have taken this report over" : "An administrator is finishing this report";
    body = admin
      ? `Change anything below, then approve it. Staff will see “edited by admin”. ${w.takenOver.by ?? "An administrator"} took it over on ${when(w.takenOver.at)}.`
      : `${w.takenOver.by ?? "An administrator"} took it over on ${when(w.takenOver.at)}. You can read it, but not change it for now.`;
    if (admin) {
      actions.push(
        <Button key="ap" disabled={busy} onClick={() => run(() => approveAction(reviewId), `${childName}’s report is approved. It can now be downloaded for the family.`)}>
          Approve
        </Button>,
        <RequestChanges key="rc" reviewId={reviewId} childName={childName} teacher={teacher ?? null} busy={busy} run={run} />,
      );
    }
  } else if (w.status === "submitted") {
    title = "Waiting for review";
    body = admin
      ? `${w.submitted?.by ?? "The teacher"} sent this for review${w.submitted ? ` on ${when(w.submitted.at)}` : ""}.`
      : `You sent this for review${w.submitted ? ` on ${when(w.submitted.at)}` : ""}. An administrator will approve it or send it back with a note. Need to change something? Take it back first.`;
    if (admin) {
      actions.push(
        <Button key="ap" disabled={busy} onClick={() => run(() => approveAction(reviewId), `${childName}’s report is approved. It can now be downloaded for the family.`)}>
          Approve
        </Button>,
        <RequestChanges key="rc" reviewId={reviewId} childName={childName} teacher={teacher ?? null} busy={busy} run={run} />,
        <TakeOver key="to" reviewId={reviewId} childName={childName} busy={busy} run={run} then={() => router.push(`/child/${reviewId}/report`)} />,
      );
    } else if (w.canTakeBack) {
      actions.push(
        <Button key="tb" variant="outline" disabled={busy} onClick={() => run(() => takeBackAction(reviewId), "Taken back. Change what you need, then submit it again.")}>
          Take back
        </Button>,
      );
    }
  } else if (w.status === "changes_requested") {
    title = "Changes requested";
    body = (
      <>
        {w.changeNote && (
          <span className="mb-1 block rounded-md bg-card px-3 py-2 text-foreground">
            “{w.changeNote.text}”
            <span className="mt-1 block text-xs text-muted-foreground">
              {w.changeNote.by ?? "An administrator"}, {when(w.changeNote.at)}
            </span>
          </span>
        )}
        {admin ? "The teacher is making the changes." : "Make the changes, then submit it again."}
      </>
    );
  } else {
    title = admin ? "Not sent for review yet" : "Ready to send?";
    body = admin ? "The teacher is still writing this report." : "Read it through. When you are happy with it, send it to the administrator for approval. The PDF can be downloaded once it is approved.";
  }

  if (!admin && w.canSubmit) {
    actions.unshift(
      <Button key="sub" disabled={busy} onClick={() => run(() => submitForReviewAction(reviewId), `${childName}’s report is sent for review.`)}>
        <Icon name="publish" size={16} /> {w.versions > 0 ? "Submit again" : "Submit for review"}
      </Button>,
    );
  }
  if (admin && !w.takenOver && w.status !== "approved" && w.status !== "submitted") {
    actions.push(<TakeOver key="to" reviewId={reviewId} childName={childName} busy={busy} run={run} then={() => router.refresh()} />);
  }

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border px-5 py-4",
        tone === "ok" && "border-success/40 bg-success/5",
        tone === "warn" && "border-warn/60 bg-warn/10",
        tone === "info" && "bg-card",
      )}
      role="status"
    >
      <div className="grid min-w-0 max-w-2xl gap-1">
        <p className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold">
          {title}
          {w.versions > 0 && <Badge variant="outline" className="font-normal">v{w.versions}</Badge>}
          {w.adminEdited && <Badge variant="secondary" className="font-normal">Edited by admin</Badge>}
        </p>
        <div className="text-sm text-muted-foreground">{body}</div>
        {admin && !inApprovals && w.status === "submitted" && (
          <Link href={`/approvals/${reviewId}`} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Open in Reports, with the ratings beside it
          </Link>
        )}
      </div>
      {actions.length > 0 && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
