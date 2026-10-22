-- Subject timetable (CHANGES-TO-MAKE change 7): each class has a fixed weekly timetable of lessons.
-- A class's hours are now its first lesson to its last, so the hours-only table of change 5 goes.
DROP TABLE class_timetable;

-- The school's own subject list. A subject linked to a learning area (English, Chinese, Maths…) is rated in that area
-- by the teacher who teaches it.
CREATE TABLE subjects (
  id       bigserial PRIMARY KEY,
  name     text NOT NULL UNIQUE,
  color    text NOT NULL DEFAULT 'sky',
  area_key text,
  active   boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0
);
INSERT INTO subjects (name, color, area_key, position) VALUES
  ('English', 'sky', 'eng', 1),
  ('Chinese 华文', 'rose', 'chi', 2),
  ('Maths', 'sun', 'mat', 3),
  ('Happy Hour', 'leaf', NULL, 4);

-- One lesson in a class's week: the same day and time every week of the semester.
CREATE TABLE lessons (
  id         bigserial PRIMARY KEY,
  class_id   bigint NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  subject_id bigint NOT NULL REFERENCES subjects (id),
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time   time NOT NULL CHECK (end_time > start_time),
  -- The teacher who teaches it. A teacher outside the class's lead and co-teachers sees the class through their lessons
  -- and rates only the subject's area.
  teacher_id bigint REFERENCES users (id) ON DELETE SET NULL,
  room       text NOT NULL DEFAULT ''
);
CREATE INDEX idx_lessons_class ON lessons (class_id);
CREATE INDEX idx_lessons_teacher ON lessons (teacher_id);
