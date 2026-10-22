-- A class's teachers are chosen on the class, not on the timetable (CHANGES-TO-MAKE change 12).
-- Besides its lead and co-teachers, a class can have subject teachers: someone who teaches only some subjects there,
-- sees the class's children, and rates only those subjects' areas. Being named on a lesson no longer gives anyone a class.
CREATE TABLE class_subject_teachers (
  class_id   bigint NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subject_id bigint NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, user_id, subject_id)
);
CREATE INDEX idx_class_subject_teachers_user ON class_subject_teachers (user_id);

-- A lesson may only name one of its class's lead and co-teachers (or, from now on, a subject teacher of its subject).
-- Lessons that named anyone else keep their time and subject, with no teacher.
UPDATE lessons l SET teacher_id = NULL
 WHERE l.teacher_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM class_staff s WHERE s.class_id = l.class_id AND s.user_id = l.teacher_id);
