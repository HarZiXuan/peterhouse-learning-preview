// A child's profile: their details, every semester they were at school, and the school's information about them
// (parents, notes). Only an administrator reads or changes it.
import type { ChildInfo, ChildProfile, ChildSemester, ClassLevel, Guardian, Pronoun, ReviewStatus } from "@peterhouse/shared";
import { many, one, run } from "../db";
import { notFound } from "../http";
import { openJson, openText, sealJson, sealText } from "./records";
import { workspace } from "./workspace";

export async function childProfile(id: number): Promise<ChildProfile> {
  const c = await one<{
    id: number;
    preferred_name: string;
    last_name: string;
    legal_name: string;
    chinese_name: string;
    date_of_birth: string;
    pronoun: Pronoun;
    status: "active" | "left";
    left_at: string | null;
    joined_on: string;
    guardians: string;
    notes: string;
  }>("SELECT id, preferred_name, last_name, legal_name, chinese_name, date_of_birth, pronoun, status, left_at, joined_on::text AS joined_on, guardians, notes FROM children WHERE id = $1", [id]);
  if (!c) throw notFound("This child");
  const { termId } = await workspace();
  const rows = await many<{ id: number; term_id: number; year: number; semester: 1 | 2; class_id: number; class_name: string; level: ClassLevel; status: ReviewStatus; has_report: boolean; approved_at: string | null; teachers: string[] | null }>(
    `SELECT r.id, r.term_id, t.year, t.semester, k.id AS class_id, k.name AS class_name, k.level, r.status, r.draft IS NOT NULL AS has_report, r.approved_at,
            (SELECT array_agg(u.name ORDER BY s.role DESC, u.name) FROM class_staff s JOIN users u ON u.id = s.user_id WHERE s.class_id = k.id) AS teachers
       FROM reviews r JOIN terms t ON t.id = r.term_id JOIN classes k ON k.id = r.class_id
      WHERE r.child_id = $1
      ORDER BY t.year DESC, t.semester DESC`,
    [id],
  );
  const semesters = rows.map(
    (r): ChildSemester => ({
      reviewId: r.id,
      year: r.year,
      semester: r.semester,
      current: r.term_id === termId,
      classId: r.class_id,
      className: r.class_name,
      level: r.level,
      teachers: r.teachers ?? [],
      status: r.status,
      hasReport: r.has_report,
      approvedAt: r.approved_at,
    }),
  );
  return {
    id: c.id,
    name: openText(c.legal_name, "children.legal_name"),
    firstName: openText(c.preferred_name, "children.preferred_name"),
    lastName: openText(c.last_name, "children.last_name"),
    chineseName: openText(c.chinese_name, "children.chinese_name"),
    dateOfBirth: openText(c.date_of_birth, "children.date_of_birth"),
    pronoun: c.pronoun,
    left: c.status === "left",
    leftAt: c.left_at,
    joinedOn: c.joined_on,
    guardians: c.guardians ? openJson<Guardian[]>(c.guardians, "children.guardians") : [],
    notes: openText(c.notes, "children.notes"),
    semesters,
  };
}

const tidy = <T extends Record<string, string>>(o: T): T => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim()])) as T;

/** Replaces the school's information about a child. Blank guardians are dropped. */
export async function updateChildInfo(id: number, info: ChildInfo) {
  if (!(await one("SELECT 1 FROM children WHERE id = $1", [id]))) throw notFound("This child");
  const guardians = info.guardians.map(tidy).filter((g) => g.name || g.phone || g.email);
  const notes = info.notes.trim();
  await run("UPDATE children SET joined_on = $1, guardians = $2, notes = $3 WHERE id = $4", [
    info.joinedOn,
    guardians.length ? sealJson(guardians, "children.guardians") : "",
    notes ? sealText(notes, "children.notes") : "",
    id,
  ]);
}
