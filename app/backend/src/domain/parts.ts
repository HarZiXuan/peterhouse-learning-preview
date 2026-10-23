// A report in parts. Each learning area of a class has one teacher (class_area_teachers; none set means the lead
// teacher). That teacher rates the area, has its paragraph written, checks it and sends it to the lead. Once every
// other teacher's part is in, the lead writes the report around the parts, checks the whole of it and sends it for
// review. The lead may change any part.
import type { PartView, SessionUser, StaffRef } from "@peterhouse/shared";
import { many, one, run, type Db } from "../db";
import { HttpError } from "../http";
import { openText, sealText } from "./records";


/** The lead teacher of each class, or none. */
export async function leadsOf(classIds: number[], c?: Db): Promise<Map<number, StaffRef>> {
  const rows = await many<{ class_id: number; id: number; name: string }>(
    "SELECT s.class_id, u.id, u.name FROM class_staff s JOIN users u ON u.id = s.user_id WHERE s.class_id = ANY($1::bigint[]) AND s.role = 'lead'",
    [classIds],
    c,
  );
  return new Map(rows.map((r) => [Number(r.class_id), { id: Number(r.id), name: r.name }]));
}

/** How an area got its teacher: set on the class page, from the subject they are tagged with, or the lead by default. */
export type OwnerSource = "set" | "subject" | "lead";
type Owner = (StaffRef & { source: OwnerSource }) | null;

const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Does a subject ("Chinese 华文", "Maths") teach this learning area (Chinese / 华文, Mathematics / Maths)? */
export function subjectFits(subject: string, area: { name: string; short_name: string; sub_name: string | null }) {
  const words = new Set(norm(subject).split(" "));
  const names = [area.name, area.short_name, area.sub_name].filter((x): x is string => !!x).map(norm);
  return names.some((n) => n === norm(subject) || n.split(" ").every((w) => words.has(w)));
}

/**
 * Who rates each area in each class: the teacher set on the class page; otherwise the teacher tagged there with the
 * matching subject (a co-teacher or subject teacher before the lead, who may change any area anyway); otherwise the
 * lead. A teacher who no longer teaches the class is skipped. With no lead either, nobody in particular (any of the
 * class's teachers).
 */
export async function ownersOf(classIds: number[], areaKeys: string[], c?: Db): Promise<Map<number, Record<string, Owner>>> {
  const leads = await leadsOf(classIds, c);
  const set = await many<{ class_id: number; area_key: string; id: number; name: string }>(
    `SELECT a.class_id, a.area_key, u.id, u.name FROM class_area_teachers a JOIN users u ON u.id = a.user_id
      WHERE a.class_id = ANY($1::bigint[]) AND u.active
        AND (EXISTS (SELECT 1 FROM class_staff s WHERE s.class_id = a.class_id AND s.user_id = a.user_id)
             OR EXISTS (SELECT 1 FROM class_subject_teachers x WHERE x.class_id = a.class_id AND x.user_id = a.user_id))`,
    [classIds],
    c,
  );
  const tags = await many<{ class_id: number; id: number; name: string; subject: string }>(
    `SELECT x.class_id, u.id, u.name, s.name AS subject FROM class_subject_teachers x
       JOIN users u ON u.id = x.user_id JOIN subjects s ON s.id = x.subject_id
      WHERE x.class_id = ANY($1::bigint[]) AND u.active ORDER BY u.name`,
    [classIds],
    c,
  );
  const areas = await many<{ key: string; name: string; short_name: string; sub_name: string | null }>("SELECT key, name, short_name, sub_name FROM domains", [], c);
  const out = new Map<number, Record<string, Owner>>();
  for (const id of classIds) {
    const lead = leads.get(id);
    const mine = set.filter((s) => Number(s.class_id) === id);
    const tagged = tags.filter((t) => Number(t.class_id) === id);
    out.set(
      id,
      Object.fromEntries(
        areaKeys.map((k): [string, Owner] => {
          const s = mine.find((x) => x.area_key === k);
          if (s) return [k, { id: Number(s.id), name: s.name, source: "set" }];
          const area = areas.find((a) => a.key === k);
          const fits = area ? tagged.filter((t) => subjectFits(t.subject, area)) : [];
          const t = fits.find((x) => Number(x.id) !== lead?.id) ?? fits[0];
          if (t) return [k, { id: Number(t.id), name: t.name, source: "subject" }];
          return [k, lead ? { ...lead, source: "lead" } : null];
        }),
      ),
    );
  }
  return out;
}

/** The lead brings the parts together: the class's lead teacher, or with no lead, any of its class teachers. */
export async function isLead(user: SessionUser, classId: number, c?: Db): Promise<boolean> {
  if (user.role === "admin") return false;
  const lead = (await leadsOf([classId], c)).get(classId);
  if (lead) return lead.id === user.id;
  return !!(await one("SELECT 1 FROM class_staff WHERE class_id = $1 AND user_id = $2", [classId, user.id], c));
}

export async function leadName(classId: number, c?: Db): Promise<string | null> {
  return (await leadsOf([classId], c)).get(classId)?.name ?? null;
}

type PartRow = { review_id: number; area_key: string; paragraph: string | null; done_at: string | null; done_by_name: string | null };

export async function partRows(reviewIds: number[], c?: Db) {
  const rows = await many<PartRow>(
    `SELECT a.review_id, a.area_key, a.paragraph, a.done_at, u.name AS done_by_name
       FROM review_areas a LEFT JOIN users u ON u.id = a.done_by WHERE a.review_id = ANY($1::bigint[])`,
    [reviewIds],
    c,
  );
  return rows.map((r) => ({ ...r, review_id: Number(r.review_id), paragraph: r.paragraph ? openText(r.paragraph, "review_areas.paragraph") : "" }));
}

/** Each area's part for one review, as the review page shows it to this person. */
export async function partsView(user: SessionUser, r: { id: number; class_id: number }, areaKeys: string[], c?: Db): Promise<Record<string, PartView>> {
  const owners = (await ownersOf([r.class_id], areaKeys, c)).get(r.class_id)!;
  const rows = await partRows([r.id], c);
  const lead = await isLead(user, r.class_id, c);
  const staff = !!(await one("SELECT 1 FROM class_staff WHERE class_id = $1 AND user_id = $2", [r.class_id, user.id], c));
  return Object.fromEntries(
    areaKeys.map((k) => {
      const row = rows.find((x) => x.area_key === k);
      const owner = owners[k];
      return [
        k,
        {
          owner,
          mine: owner ? owner.id === user.id : staff,
          // The lead changes another teacher's area only once that teacher has sent it; until then it is theirs.
          canEdit: user.role === "admin" || (owner ? owner.id === user.id || (lead && !!row?.done_at) : staff || lead),
          paragraph: row?.paragraph ?? "",
          done: row?.done_at ? { by: row.done_by_name, at: row.done_at } : null,
        },
      ];
    }),
  );
}

/** May this person rate this area and write its part? The lead and the administrator (on a report they took over) may change any. */
/**
 * May this person rate this area and write its part? Its own teacher may. The lead may change another teacher's area
 * only after that teacher has sent it (while they are working on it, it is theirs). An administrator who took the
 * report over may change any.
 */
export async function canEditArea(user: SessionUser, r: { id: number; class_id: number }, areaKey: string, c?: Db): Promise<boolean> {
  if (user.role === "admin") return true;
  const owner = (await ownersOf([r.class_id], [areaKey], c)).get(r.class_id)![areaKey];
  if (owner?.id === user.id) return true;
  const lead = await isLead(user, r.class_id, c);
  if (owner) return lead && (await partDone(r.id, areaKey, c));
  return lead || !!(await one("SELECT 1 FROM class_staff WHERE class_id = $1 AND user_id = $2", [r.class_id, user.id], c));
}

/** Who is still working on an area, when the lead may not change it yet. */
export async function workingOn(r: { id: number; class_id: number }, areaKey: string, c?: Db): Promise<string | null> {
  const owner = (await ownersOf([r.class_id], [areaKey], c)).get(r.class_id)![areaKey];
  return owner && !(await partDone(r.id, areaKey, c)) ? owner.name : null;
}

export async function partDone(reviewId: number, areaKey: string, c?: Db): Promise<boolean> {
  return !!(await one("SELECT 1 FROM review_areas WHERE review_id = $1 AND area_key = $2 AND done_at IS NOT NULL", [reviewId, areaKey], c));
}

export async function storePartParagraph(reviewId: number, areaKey: string, text: string, c?: Db) {
  const n = await run("UPDATE review_areas SET paragraph = $3 WHERE review_id = $1 AND area_key = $2", [reviewId, areaKey, sealText(text.slice(0, 3000), "review_areas.paragraph")], c);
  if (!n) throw new HttpError(409, "Rate this area first.");
}

export async function setPartDone(reviewId: number, areaKey: string, by: number | null, c?: Db) {
  await run("UPDATE review_areas SET done_by = $3, done_at = CASE WHEN $3::bigint IS NULL THEN NULL ELSE now() END WHERE review_id = $1 AND area_key = $2", [reviewId, areaKey, by], c);
}

/** The parts the lead is still waiting for: areas another teacher rates whose part is not sent yet. */
export async function waitingParts(r: { id: number; class_id: number }, areas: { key: string; name: string }[], leadId: number | null, c?: Db) {
  const owners = (await ownersOf([r.class_id], areas.map((a) => a.key), c)).get(r.class_id)!;
  const rows = await partRows([r.id], c);
  return areas
    .filter((a) => owners[a.key] && owners[a.key]!.id !== leadId && !rows.find((x) => x.area_key === a.key)?.done_at)
    .map((a) => ({ area: a.name, teacher: owners[a.key]!.name }));
}
