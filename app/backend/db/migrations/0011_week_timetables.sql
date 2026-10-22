-- A class's normal week lives in `lessons` and repeats all semester. A week that differs gets its own full set of
-- lessons here: `timetable_weeks` marks the Monday of a changed week, `week_lessons` holds that week's lessons.
-- A week without a marker uses the normal timetable.
CREATE TABLE timetable_weeks (
  class_id bigint NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  week_of  date   NOT NULL,
  PRIMARY KEY (class_id, week_of)
);

CREATE TABLE week_lessons (
  id         bigserial PRIMARY KEY,
  class_id   bigint   NOT NULL,
  week_of    date     NOT NULL,
  subject_id bigint   NOT NULL REFERENCES subjects (id),
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time     NOT NULL,
  end_time   time     NOT NULL CHECK (end_time > start_time),
  teacher_id bigint REFERENCES users (id) ON DELETE SET NULL,
  room       text NOT NULL DEFAULT '',
  FOREIGN KEY (class_id, week_of) REFERENCES timetable_weeks (class_id, week_of) ON DELETE CASCADE
);
CREATE INDEX idx_week_lessons_week ON week_lessons (class_id, week_of);
