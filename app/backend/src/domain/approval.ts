// Teachers own the report; the administrator reviews it (CHANGES-TO-MAKE changes 1 and 3).
// A teacher submits a written report; each submission is frozen as a numbered version. The administrator approves it,
// sends it back with a note, or takes it over to change it themselves (logged, and marked "edited by admin" to staff).
import type { ApprovalDetail, ApprovalItem, ApprovalStatusFilter, ApprovalsView, Draft, ReviewStatus, SessionUser, Workflow } from "@peterhouse/shared";
import { fillTemplate, levelWord, scoreOf } from "@peterhouse/shared";
import { many, one, run, tx } from "../db";
import { HttpError } from "../http";
import { openJson, openText, sealJson, sealText } from "./records";
import { getReviewForUser, getReviewRow, loadAnswers, lockReason, type ReviewRow } from "./reviews";
import { workspace } from "./workspace";

const names = async (ids: (number | null)[]) => {
  const wanted = [...new Set(ids.filter((x): x is number => !!x))];
  const rows = await many<{ id: number; name: string }>("SELECT id, name FROM users WHERE id = ANY($1::bigint[])", [wanted]);
  return new Map(rows.map((r) => [r.id, r.name]));
};

const versionCount = async (reviewId: number) => (await one<{ n: number }>("SELECT count(*)::int AS n FROM report_versions WHERE review_id = $1", [reviewId]))!.n;

/** Where the report is, and what this person can do with it. */
export async function workflowFor(user: SessionUser, r: ReviewRow): Promise<Workflow> {
  const who = await names([r.change_note_by, r.submitted_by, r.approved_by, r.taken_over_by]);
  const teacherCan = user.role !== "admin" && !r.taken_over_by && r.term_status === "open";
  return {
    status: r.status,
    locked: lockReason(user, r),
    changeNote: r.status === "changes_requested" && r.change_note_at ? { text: r.change_note, by: who.get(r.change_note_by!) ?? null, at: r.change_note_at } : null,
    submitted: r.submitted_at ? { by: who.get(r.submitted_by!) ?? null, at: r.submitted_at } : null,
    approved: r.status === "approved" && r.approved_at ? { by: who.get(r.approved_by!) ?? null, at: r.approved_at } : null,
    takenOver: r.taken_over_by && r.taken_over_at ? { by: who.get(r.taken_over_by) ?? null, at: r.taken_over_at } : null,
    adminEdited: r.admin_edited,
    versions: await versionCount(r.id),
    canSubmit: teacherCan && !!r.draft && (r.status === "written" || r.status === "changes_requested"),
    canTakeBack: teacherCan && r.status === "submitted",
    canDownload: r.status === "approved",
  };
}

async function openReview(user: SessionUser, id: number, adminOnly = false) {
  if (adminOnly && user.role !== "admin") throw new HttpError(403, "Only an administrator can do that.");
  const r = await getReviewForUser(user, id);
  if (r.term_status !== "open") throw new HttpError(409, "That review belongs to a finished semester.");
  return r;
}

/** The teacher sends the written report for review; it is frozen as the next version. */
export async function submitForReview(user: SessionUser, id: number) {
  const r = await openReview(user, id);
  if (user.role === "admin") throw new HttpError(403, "Teachers submit their reports. An administrator approves them.");
  if (r.taken_over_by) throw new HttpError(409, "An administrator has taken this report over.");
  if (!r.draft || (r.status !== "written" && r.status !== "changes_requested")) throw new HttpError(409, "Write the report before sending it for review.");
  const stale = r.draft.paragraphs.filter((p) => p.stale).map((p) => p.title);
  if (stale.length) throw new HttpError(409, `Check ${stale.join(", ")} first: the ratings changed after it was written.`);
  return tx(async (c) => {
    const n = (await one<{ n: number }>("SELECT coalesce(max(version), 0)::int + 1 AS n FROM report_versions WHERE review_id = $1", [id], c))!.n;
    await run("INSERT INTO report_versions (review_id, version, draft, submitted_by) VALUES ($1, $2, $3, $4)", [id, n, sealJson(r.draft, "report_versions.draft"), user.id], c);
    await run("UPDATE reviews SET status = 'submitted', submitted_by = $2, submitted_at = now(), updated_at = now() WHERE id = $1", [id, user.id], c);
    return { version: n, childId: r.child_id };
  });
}

/** The teacher takes a submitted report back to change something before it is reviewed. */
export async function takeBack(user: SessionUser, id: number) {
  const r = await openReview(user, id);
  if (r.status !== "submitted") throw new HttpError(409, "Only a report waiting for review can be taken back.");
  if (r.taken_over_by) throw new HttpError(409, "An administrator has taken this report over.");
  await tx(async (c) => {
    await run("UPDATE report_versions SET decision = 'taken_back', decided_by = $2, decided_at = now() WHERE review_id = $1 AND decision IS NULL", [id, user.id], c);
    await run("UPDATE reviews SET status = 'written', updated_at = now() WHERE id = $1", [id], c);
  });
  return { childId: r.child_id };
}

/** The administrator approves the report: the version families receive. */
export async function approve(user: SessionUser, id: number) {
  const r = await openReview(user, id, true);
  if (!r.draft) throw new HttpError(409, "There is no report to approve yet.");
  // A report the administrator took over may be approved straight away; otherwise it must have been submitted.
  if (r.status !== "submitted" && !(r.taken_over_by && r.status !== "approved")) throw new HttpError(409, "Only a report waiting for review can be approved.");
  await tx(async (c) => {
    if (r.taken_over_by) {
      // The administrator changed it, so the teacher's version is not what families get: their own edit becomes the
      // version that is approved, and the record shows exactly what was approved.
      await run(
        "UPDATE report_versions SET decision = 'changes_requested', decided_by = $2, decided_at = now(), note = $3 WHERE review_id = $1 AND decision IS NULL",
        [id, user.id, sealText("Taken over and changed by an administrator.", "report_versions.note")],
        c,
      );
      const n = (await one<{ n: number }>("SELECT coalesce(max(version), 0)::int + 1 AS n FROM report_versions WHERE review_id = $1", [id], c))!.n;
      await run("INSERT INTO report_versions (review_id, version, draft, submitted_by) VALUES ($1, $2, $3, $4)", [id, n, sealJson(r.draft, "report_versions.draft"), user.id], c);
    }
    await run("UPDATE report_versions SET decision = 'approved', decided_by = $2, decided_at = now() WHERE review_id = $1 AND decision IS NULL", [id, user.id], c);
    await run(
      `UPDATE reviews SET status = 'approved', approved_by = $2, approved_at = now(), approved_snapshot = $3,
              taken_over_by = NULL, taken_over_at = NULL, change_note = '', change_note_by = NULL, change_note_at = NULL, updated_at = now()
        WHERE id = $1`,
      [id, user.id, sealJson(r.draft, "reviews.approved_snapshot")],
      c,
    );
  });
  return { childId: r.child_id };
}

/** Sends the report back to its teacher with a note. Works on a submitted report, a taken-over one, or an approved one. */
export async function requestChanges(user: SessionUser, id: number, note: string) {
  const r = await openReview(user, id, true);
  const text = note.trim().slice(0, 1000);
  if (!text) throw new HttpError(400, "Write a short note so the teacher knows what to change.");
  if (!r.draft || !["submitted", "approved", "written", "changes_requested"].includes(r.status)) throw new HttpError(409, "There is no written report to send back yet.");
  if (r.status !== "submitted" && r.status !== "approved" && !r.taken_over_by) throw new HttpError(409, "This report is with its teacher already.");
  await tx(async (c) => {
    await run(
      "UPDATE report_versions SET decision = 'changes_requested', decided_by = $2, decided_at = now(), note = $3 WHERE review_id = $1 AND decision IS NULL",
      [id, user.id, sealText(text, "report_versions.note")],
      c,
    );
    await run(
      `UPDATE reviews SET status = 'changes_requested', change_note = $2, change_note_by = $3, change_note_at = now(),
              taken_over_by = NULL, taken_over_at = NULL, approved_by = NULL, approved_at = NULL, updated_at = now()
        WHERE id = $1`,
      [id, sealText(text, "reviews.change_note"), user.id],
      c,
    );
  });
  return { childId: r.child_id };
}

/** For the last-minute case: the administrator edits the report themselves. The teacher cannot edit it meanwhile. */
export async function takeOver(user: SessionUser, id: number) {
  const r = await openReview(user, id, true);
  if (r.status === "approved") throw new HttpError(409, "This report is approved. Send it back first if something must change.");
  if (r.taken_over_by) return { childId: r.child_id };
  await run("UPDATE reviews SET taken_over_by = $2, taken_over_at = now(), updated_at = now() WHERE id = $1", [id, user.id]);
  return { childId: r.child_id };
}

const FILTER_STATUSES: Record<ApprovalStatusFilter, ReviewStatus[]> = {
  waiting: ["submitted"],
  changes: ["changes_requested"],
  approved: ["approved"],
  not_submitted: ["not_started", "draft", "ready", "written"],
};

/** Every report this semester, for the administrator's Approvals page. */
export async function approvalsView(filter: { status?: ApprovalStatusFilter; classId?: number; teacherId?: number }): Promise<ApprovalsView> {
  const { termId } = await workspace();
  const rows = await many<{
    id: number;
    status: ReviewStatus;
    updated_at: string;
    admin_edited: boolean;
    preferred_name: string;
    chinese_name: string;
    class_id: number;
    class_name: string;
    submitted_by: number | null;
    lead_id: number | null;
    staff: number[];
    versions: number;
  }>(
    `SELECT r.id, r.status, r.updated_at, r.admin_edited, c.preferred_name, c.chinese_name, k.id AS class_id, k.name AS class_name, r.submitted_by,
            (SELECT s.user_id FROM class_staff s WHERE s.class_id = k.id AND s.role = 'lead') AS lead_id,
            coalesce((SELECT array_agg(s.user_id) FROM class_staff s WHERE s.class_id = k.id), '{}') AS staff,
            (SELECT count(*)::int FROM report_versions v WHERE v.review_id = r.id) AS versions
       FROM reviews r JOIN children c ON c.id = r.child_id JOIN classes k ON k.id = r.class_id
      WHERE r.term_id = $1 AND c.status = 'active'`,
    [termId],
  );
  const who = await names(rows.flatMap((r) => [r.submitted_by, r.lead_id]));
  const counts: Record<ApprovalStatusFilter, number> = { waiting: 0, changes: 0, approved: 0, not_submitted: 0 };
  const inFilter = (r: (typeof rows)[number]) =>
    (!filter.classId || r.class_id === filter.classId) && (!filter.teacherId || r.submitted_by === filter.teacherId || r.staff.map(Number).includes(filter.teacherId));
  for (const r of rows.filter(inFilter)) for (const [k, list] of Object.entries(FILTER_STATUSES)) if (list.includes(r.status)) counts[k as ApprovalStatusFilter]++;
  const wanted = FILTER_STATUSES[filter.status ?? "waiting"];
  const items: ApprovalItem[] = rows
    .filter((r) => inFilter(r) && wanted.includes(r.status))
    .map((r) => ({
      reviewId: r.id,
      childName: openText(r.preferred_name, "children.preferred_name"),
      chineseName: openText(r.chinese_name, "children.chinese_name"),
      classId: r.class_id,
      className: r.class_name,
      teacher: who.get(r.submitted_by ?? r.lead_id ?? 0) ?? null,
      status: r.status,
      version: r.versions,
      updatedAt: r.updated_at,
      adminEdited: r.admin_edited,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const classes = await many<{ id: number; name: string }>("SELECT id, name FROM classes WHERE term_id = $1 ORDER BY name", [termId]);
  const teachers = await many<{ id: number; name: string }>("SELECT id, name FROM users WHERE role = 'teacher' AND active ORDER BY name");
  return { items, counts, classes, teachers };
}

export async function waitingCount(): Promise<number> {
  const { termId } = await workspace();
  return (await one<{ n: number }>("SELECT count(*)::int AS n FROM reviews r JOIN children c ON c.id = r.child_id WHERE r.term_id = $1 AND r.status = 'submitted' AND c.status = 'active'", [termId]))!.n;
}

/** The parts of the review page that sit beside the report: ratings, comments, versions and what changed. */
export async function approvalExtras(id: number): Promise<Omit<ApprovalDetail, "report">> {
  const r = (await getReviewRow(id))!;
  const { answers } = await loadAnswers(id, r.rubric);
  const fill = (t: string) => fillTemplate(t, r.preferred_name, r.pronoun);
  const areas = r.rubric.areas.map((a) => ({
    key: a.key,
    name: a.name,
    note: answers[a.key]?.note ?? "",
    ratings: a.skills.map((s) => {
      const level = scoreOf(answers[a.key], s.key);
      const touched = !!answers[a.key]?.skills[s.key]?.touched;
      return { text: fill(s.text), word: !touched ? "Not rated" : level === 0 ? "Not seen yet" : levelWord(level) };
    }),
  }));
  const vs = await many<{ version: number; draft: string; submitted_by: number | null; submitted_at: string; decision: string | null; decided_by: number | null; note: string }>(
    "SELECT version, draft, submitted_by, submitted_at, decision, decided_by, note FROM report_versions WHERE review_id = $1 ORDER BY version DESC",
    [id],
  );
  const who = await names(vs.flatMap((v) => [v.submitted_by, v.decided_by]));
  // Compare the newest version with the one before it, paragraph by paragraph.
  let changedSinceLast: string[] = [];
  if (vs.length >= 2) {
    const [now, before] = [openJson<Draft>(vs[0].draft, "report_versions.draft"), openJson<Draft>(vs[1].draft, "report_versions.draft")];
    const old = new Map(before.paragraphs.map((p) => [p.key, p.text]));
    changedSinceLast = now.paragraphs.filter((p) => old.get(p.key) !== p.text).map((p) => p.title);
    if (now.homeIdeas.join("\n") !== before.homeIdeas.join("\n")) changedSinceLast.push("Ideas to try at home");
  }
  const lead = await one<{ name: string }>("SELECT u.name FROM class_staff s JOIN users u ON u.id = s.user_id WHERE s.class_id = $1 AND s.role = 'lead'", [r.class_id]);
  return {
    areas,
    versions: vs.map((v) => ({
      version: v.version,
      submittedBy: who.get(v.submitted_by ?? 0) ?? null,
      submittedAt: v.submitted_at,
      decision: v.decision,
      decidedBy: who.get(v.decided_by ?? 0) ?? null,
      note: openText(v.note, "report_versions.note"),
    })),
    changedSinceLast,
    className: r.class_name,
    teacher: who.get(r.submitted_by ?? 0) ?? lead?.name ?? null,
  };
}
