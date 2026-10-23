// Where a teacher's report for one child has got to, for the teacher's Reports page. Plain functions, used by the server
// page (filters and counts) and the client table alike.
import type { ChildListItem } from "@peterhouse/shared";

// A teacher who is not the class's lead does their own part only: their areas, sent to the lead.
export const partOnly = (c: ChildListItem) => !c.iAmLead;
// A part is only owed while the report is still being put together (not once it is written, sent or taken over).
export const partsLeft = (c: ChildListItem) => (c.partsOpen ? c.myParts.filter((p) => !p.done) : []);

export type StateKey = "approved" | "waiting" | "changes" | "written" | "send" | "ready" | "in_progress" | "not_started";

export const stateKey = (c: ChildListItem): StateKey =>
  c.status === "approved"
    ? "approved"
    : c.status === "submitted"
      ? "waiting"
      : c.status === "changes_requested" && !partOnly(c)
        ? "changes"
        : partOnly(c)
          ? partsLeft(c).length
            ? "in_progress"
            : "written"
          : c.hasReport
            ? c.status === "written" && !c.takenOver
              ? "send"
              : "written"
            : c.waitingFor.length
              ? "in_progress"
              : c.answered === c.total
                ? "ready"
                : c.answered === 0
                  ? "not_started"
                  : "in_progress";

/** Each state's badge, from the status palette (docs/DESIGN-SYSTEM.md): green done, red with the office, amber sent back, blue in progress, grey not started. */
export const STATE_TONE: Record<StateKey, string> = {
  approved: "bg-status-approved-soft text-status-approved-fg",
  written: "bg-status-approved-soft text-status-approved-fg",
  waiting: "bg-status-waiting-soft text-status-waiting-fg",
  changes: "bg-status-changes-soft text-status-changes-fg",
  send: "bg-status-progress-soft text-status-progress-fg",
  ready: "bg-status-progress-soft text-status-progress-fg",
  in_progress: "bg-status-progress-soft text-status-progress-fg",
  not_started: "bg-status-idle-soft text-status-idle-fg",
};

export const STATE_RANK: Record<StateKey, number> = { not_started: 0, in_progress: 1, ready: 2, send: 3, written: 3, changes: 4, waiting: 5, approved: 6 };

/** The lead has written the report but not sent it for review yet: the step that is easy to miss. */
export const readyToSend = (c: ChildListItem) => !partOnly(c) && !c.takenOver && c.hasReport && c.status === "written";
/** Nothing left for this person: the lead has written the report, another teacher has sent every part of theirs, or the office took it over. */
export const myWorkDone = (c: ChildListItem) => c.takenOver || (partOnly(c) ? partsLeft(c).length === 0 : c.hasReport);

// The areas that are this person's to rate: all of them for the lead, only their own for another teacher.
export const myAreas = (c: ChildListItem) => (partOnly(c) ? c.areas.filter((a) => c.myParts.some((p) => p.area === a.name)) : c.areas);
export const ratedAreas = (c: ChildListItem) => myAreas(c).filter((a) => a.answered === a.total).length;

export function stateLabel(c: ChildListItem, past: boolean) {
  if (c.status === "approved") return "Approved";
  if (c.status === "submitted") return "Sent for review";
  if (c.takenOver) return "Taken over by the office";
  if (partOnly(c)) {
    if (!c.myParts.length) return "Not your areas";
    if (!c.partsOpen && c.myParts.some((p) => !p.done)) return c.hasReport ? "Written by the lead" : "With the lead";
    const left = partsLeft(c);
    return left.length ? `Your part: ${left.map((p) => p.area).join(", ")}` : "Your part is sent";
  }
  if (c.status === "changes_requested") return "Changes requested";
  if (readyToSend(c) && !past) return "Ready to send";
  if (!c.hasReport && c.waitingFor.length) return `Waiting for ${[...new Set(c.waitingFor.map((w) => w.teacher))].join(", ")}`;
  if (c.hasReport) return "Report written";
  if (past) return "Not written";
  if (c.answered === c.total) return "Ready to write";
  return c.answered === 0 ? "Not started" : `${c.areas.filter((a) => a.answered === a.total).length} of ${c.areas.length} areas rated`;
}
