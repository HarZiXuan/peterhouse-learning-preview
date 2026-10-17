-- Peterhouse Learning Review: initial schema.
--
-- Columns marked "-- ENC" hold application-level ciphertext (AES-256-GCM, see backend/src/crypto.ts):
-- the database never sees a child's name, birthday, notes or written report in the clear.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id                   bigserial PRIMARY KEY,
  email                citext NOT NULL UNIQUE,
  name                 text NOT NULL,
  role                 text NOT NULL CHECK (role IN ('admin', 'teacher')),
  password_hash        text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  active               boolean NOT NULL DEFAULT true,
  failed_attempts      integer NOT NULL DEFAULT 0,
  locked_until         timestamptz,
  last_login_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Only a SHA-256 of the session token is stored, so a leaked table cannot be replayed as cookies.
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip         text,
  user_agent text
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- A term is one portfolio period. Semester 1 = January to June, Semester 2 = July to December.
-- Ratings are stored per review (one per child per term), so Semester 2 can show Semester 1 beside it.
CREATE TABLE terms (
  id       bigserial PRIMARY KEY,
  semester smallint NOT NULL CHECK (semester IN (1, 2)),
  year     integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  status   text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
  UNIQUE (year, semester)
);

CREATE TABLE classes (
  id      bigserial PRIMARY KEY,
  term_id bigint NOT NULL REFERENCES terms (id),
  name    text NOT NULL,
  level   text NOT NULL CHECK (level IN ('Nursery', 'K1', 'K2')),
  UNIQUE (term_id, name)
);

-- Who may see a class. Admins see every class; teachers see only the classes listed here.
CREATE TABLE class_staff (
  class_id bigint NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  user_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role     text NOT NULL CHECK (role IN ('lead', 'co')),
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE children (
  id            bigserial PRIMARY KEY,
  preferred_name text NOT NULL,                 -- ENC
  legal_name    text NOT NULL,                  -- ENC
  date_of_birth text NOT NULL,                  -- ENC
  pronoun       text NOT NULL CHECK (pronoun IN ('she', 'he', 'they')),
  photo_consent boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  left_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One review per child per term. The review is also the child's enrolment in a class for that term.
CREATE TABLE reviews (
  id               bigserial PRIMARY KEY,
  child_id         bigint NOT NULL REFERENCES children (id) ON DELETE CASCADE,
  term_id          bigint NOT NULL REFERENCES terms (id),
  class_id         bigint NOT NULL REFERENCES classes (id),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('not_started', 'draft', 'ready', 'written', 'approved')),
  rubric           jsonb,                       -- frozen copy of the questions used for this review
  highlight        text NOT NULL DEFAULT '',    -- ENC
  highlight_by     bigint REFERENCES users (id),
  highlight_at     timestamptz,
  no_photo         boolean NOT NULL DEFAULT true,
  staff_note       text NOT NULL DEFAULT '',    -- ENC
  strengths        jsonb,
  next_steps       jsonb,
  draft            text,                        -- ENC (JSON of the written report)
  report_version   integer NOT NULL DEFAULT 0,
  approved_by      bigint REFERENCES users (id),
  approved_at      timestamptz,
  approved_snapshot text,                       -- ENC
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, term_id)
);
CREATE INDEX idx_reviews_class ON reviews (class_id);
CREATE INDEX idx_reviews_child ON reviews (child_id);

-- The photo itself is stored encrypted (AES-256-GCM, see backend/src/crypto.ts), so one database backup holds everything.
CREATE TABLE review_photos (
  id        bigserial PRIMARY KEY,
  review_id bigint NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  data      bytea NOT NULL,                     -- ENC
  position  integer NOT NULL DEFAULT 0,
  added_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_photos_review ON review_photos (review_id);

-- Whole-child answers beyond the skill ratings (favourites, friends, what they are working on).
CREATE TABLE review_notes (
  review_id bigint NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  key       text NOT NULL,
  text      text NOT NULL,                      -- ENC
  PRIMARY KEY (review_id, key)
);

-- Ratings and comments for one learning area of one review.
CREATE TABLE review_areas (
  review_id  bigint NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  area_key   text NOT NULL,
  data       text NOT NULL,                     -- ENC (JSON: ratings, ticked moments, note)
  updated_by bigint REFERENCES users (id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, area_key)
);

-- Previous drafts, kept whenever the whole draft is rewritten.
CREATE TABLE draft_versions (
  id          bigserial PRIMARY KEY,
  review_id   bigint NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  draft       text NOT NULL,                    -- ENC
  replaced_by bigint REFERENCES users (id),
  replaced_at timestamptz NOT NULL DEFAULT now()
);

-- Who did what. Details never contain a child's name.
CREATE TABLE activity_log (
  id        bigserial PRIMARY KEY,
  at        timestamptz NOT NULL DEFAULT now(),
  user_id   bigint REFERENCES users (id) ON DELETE SET NULL,
  action    text NOT NULL,
  review_id bigint,
  child_id  bigint,
  detail    text NOT NULL DEFAULT '',
  ip        text
);
CREATE INDEX idx_activity_at ON activity_log (at);
