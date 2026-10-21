-- Teacher Questions v0.3: five domains on a fixed 1–5 scale, questions the administrator edits and publishes,
-- and a frozen question set per review.

ALTER TABLE children ADD COLUMN chinese_name text NOT NULL DEFAULT '';   -- ENC

-- The draft the administrator edits. Nothing here reaches a teacher until it is published into rubric_versions.
CREATE TABLE domains (
  id         bigserial PRIMARY KEY,
  key        text NOT NULL UNIQUE,
  name       text NOT NULL,
  short_name text NOT NULL,
  sub_name   text,
  icon       text,
  position   integer NOT NULL,
  love_key   text,                               -- the short text question ("What did {name} love most?")
  love_text  text,
  home_ideas jsonb                               -- ideas to try at home; the teacher picks up to two
);

-- `key` is the permanent hidden question ID: rewording keeps it, a different skill gets a new one,
-- so Semester 1 and Semester 2 scores line up only when they really measure the same thing.
CREATE TABLE questions (
  id            bigserial PRIMARY KEY,
  domain_id     bigint NOT NULL REFERENCES domains (id),
  key           text NOT NULL UNIQUE,
  text_template text NOT NULL,
  position      integer NOT NULL,
  active        boolean NOT NULL DEFAULT true,   -- false = retired: kept in history, not in new reviews
  retired_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_domain ON questions (domain_id);

-- Every published question set, frozen. A review copies one the first time it is opened.
CREATE TABLE rubric_versions (
  id         bigserial PRIMARY KEY,
  version    integer NOT NULL UNIQUE,
  snapshot   jsonb NOT NULL,
  created_by bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- NULL until the review is first opened; reviews.rubric holds the frozen copy itself.
ALTER TABLE reviews ADD COLUMN rubric_version_id bigint REFERENCES rubric_versions (id);

-- Photos now belong to a domain (up to three each). Older photos have none.
ALTER TABLE review_photos ADD COLUMN area_key text;

-- Reviews without a written report restart on the new domains; their old ratings and notes are discarded.
-- Written and approved reports keep their frozen questions and answers untouched.
DELETE FROM review_areas WHERE review_id IN (SELECT id FROM reviews WHERE draft IS NULL AND status <> 'approved');
DELETE FROM review_notes WHERE review_id IN (SELECT id FROM reviews WHERE draft IS NULL AND status <> 'approved');
UPDATE reviews SET rubric = NULL, status = 'draft', highlight = '', strengths = NULL, next_steps = NULL
WHERE draft IS NULL AND status <> 'approved';

-- The question set used to live in settings; domains/questions replace it.
DELETE FROM settings WHERE key = 'rubric';
