-- The class calendar (CHANGES-TO-MAKE change 5). The administrator manages it; staff can only see it.
-- Entries never hold a child's name, because each person's calendar link shares them with Google Calendar or Outlook.

-- Which days each class meets, and its hours. One row per class per weekday (1 = Monday … 7 = Sunday).
CREATE TABLE class_timetable (
  class_id   bigint NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time   time NOT NULL CHECK (end_time > start_time),
  PRIMARY KEY (class_id, weekday)
);

CREATE TABLE calendar_events (
  id         bigserial PRIMARY KEY,
  -- event: something happening; closure: no school (hides the timetable); deadline: reports due for review.
  kind       text NOT NULL CHECK (kind IN ('event', 'closure', 'deadline')),
  title      text NOT NULL,
  starts_on  date NOT NULL,
  ends_on    date NOT NULL CHECK (ends_on >= starts_on),
  start_time time,
  end_time   time,
  place      text NOT NULL DEFAULT '',
  note       text NOT NULL DEFAULT '',
  -- school: everyone; levels: the classes of these levels; classes: the classes in calendar_event_classes.
  audience   text NOT NULL CHECK (audience IN ('school', 'levels', 'classes')),
  levels     text[] NOT NULL DEFAULT '{}',
  created_by bigint REFERENCES users (id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((start_time IS NULL) = (end_time IS NULL)),
  CHECK (end_time IS NULL OR starts_on < ends_on OR end_time > start_time)
);
CREATE INDEX idx_calendar_events_dates ON calendar_events (starts_on, ends_on);

CREATE TABLE calendar_event_classes (
  event_id bigint NOT NULL REFERENCES calendar_events (id) ON DELETE CASCADE,
  class_id bigint NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, class_id)
);

-- Each person's private calendar link. Only a hash is kept for the lookup; the link itself is encrypted so the
-- Calendar page can show it again. Resetting replaces both, and the old link stops working.
ALTER TABLE users
  ADD COLUMN calendar_token      text,                          -- ENC
  ADD COLUMN calendar_token_hash text UNIQUE;
