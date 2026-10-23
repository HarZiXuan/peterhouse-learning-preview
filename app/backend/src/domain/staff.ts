// Who teaches a class (BUILT.md change 12). A class's lead and co-teachers are in class_staff; its subject
// teachers are teachers who are not. The subjects any teacher teaches there are in class_subject_teachers: a lead or
// co-teacher with none teaches every subject. All of it is set on the class page only, and a lesson can name only a
// teacher of the class.
import { run, type Db } from "../db";

/** SQL: the classes a user ($n) teaches, as lead, co-teacher or subject teacher. */
export const TAUGHT_BY = (n: number) => `(SELECT class_id FROM class_staff WHERE user_id = $${n} UNION SELECT class_id FROM class_subject_teachers WHERE user_id = $${n})`;

/** SQL: may `teacher` be named on a lesson of `subject` in `cls`? (all three are SQL expressions) */
export const MAY_TEACH = (cls: string, teacher: string, subject: string) =>
  `(EXISTS (SELECT 1 FROM class_staff s WHERE s.class_id = ${cls} AND s.user_id = ${teacher}
              AND NOT EXISTS (SELECT 1 FROM class_subject_teachers y WHERE y.class_id = ${cls} AND y.user_id = ${teacher}))
    OR EXISTS (SELECT 1 FROM class_subject_teachers x WHERE x.class_id = ${cls} AND x.user_id = ${teacher} AND x.subject_id = ${subject}))`;

/** Takes the teacher off any lesson of this class they no longer teach. The lesson keeps its time and subject. */
export async function clearOutsideTeachers(classId: number, c?: Db) {
  for (const table of ["lessons", "week_lessons"]) {
    await run(`UPDATE ${table} l SET teacher_id = NULL WHERE l.class_id = $1 AND l.teacher_id IS NOT NULL AND NOT ${MAY_TEACH("l.class_id", "l.teacher_id", "l.subject_id")}`, [classId], c);
  }
}
