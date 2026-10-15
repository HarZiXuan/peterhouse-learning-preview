import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// All records live in one data folder: learning-review.db plus photos/.
// Backing up means copying this folder (see backup.ts).
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
export const PHOTO_DIR = path.join(DATA_DIR, "photos");
export const DB_PATH = path.join(DATA_DIR, "learning-review.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher')),
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY,
  season TEXT NOT NULL CHECK (season IN ('June','December')),
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('open','closed','locked')),
  targets TEXT NOT NULL DEFAULT '{}',
  UNIQUE (season, year)
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY,
  term_id INTEGER NOT NULL REFERENCES terms(id),
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('Nursery','K1','K2')),
  UNIQUE (term_id, name)
);

CREATE TABLE IF NOT EXISTS class_staff (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('lead','co')),
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY,
  preferred_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  pronoun TEXT NOT NULL CHECK (pronoun IN ('she','he','they')),
  photo_consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','left')),
  left_at TEXT
);

-- One review per child per term. The review is also the child's enrolment
-- in a class for that term; moving class moves the review.
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES terms(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  status TEXT NOT NULL DEFAULT 'not_started',
  rubric TEXT,
  highlight TEXT NOT NULL DEFAULT '',
  highlight_by INTEGER,
  highlight_at TEXT,
  photo_file TEXT,
  no_photo INTEGER NOT NULL DEFAULT 0,
  staff_note TEXT NOT NULL DEFAULT '',
  strengths TEXT,
  next_steps TEXT,
  draft TEXT,
  report_version INTEGER NOT NULL DEFAULT 0,
  approved_by INTEGER REFERENCES users(id),
  approved_at TEXT,
  approved_snapshot TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (child_id, term_id)
);

-- Photos teachers add for a child's report this term (shown only with photo consent).
CREATE TABLE IF NOT EXISTS review_photos (
  id INTEGER PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  file TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL
);

-- Whole-child answers beyond the skill scales (favourites, friends, what they are working on).
CREATE TABLE IF NOT EXISTS review_notes (
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (review_id, key)
);

CREATE TABLE IF NOT EXISTS review_areas (
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  area_key TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (review_id, area_key)
);

-- Previous drafts, kept whenever the whole draft is rewritten.
CREATE TABLE IF NOT EXISTS draft_versions (
  id INTEGER PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  draft TEXT NOT NULL,
  replaced_by INTEGER REFERENCES users(id),
  replaced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS presence (
  review_id INTEGER NOT NULL,
  area_key TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (review_id, area_key, user_id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  review_id INTEGER,
  child_id INTEGER,
  detail TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_reviews_class ON reviews(class_id);
CREATE INDEX IF NOT EXISTS idx_reviews_child ON reviews(child_id);
CREATE INDEX IF NOT EXISTS idx_photos_review ON review_photos(review_id);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_log(at);
`;

type GlobalWithDb = typeof globalThis & { __lrDb?: Database.Database; __lrSchema?: string };
const g = globalThis as GlobalWithDb;

export function openDb(file = DB_PATH): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const db = new Database(file);
  // The default rollback journal is used rather than WAL so the data folder
  // works on any disk format, including external drives.
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}

export function db(): Database.Database {
  // In dev, hot reload keeps the old connection alive; reopen it when the schema text has changed so new tables get created.
  if (g.__lrDb && g.__lrSchema !== SCHEMA) {
    g.__lrDb.close();
    g.__lrDb = undefined;
  }
  if (!g.__lrDb) {
    g.__lrDb = openDb(process.env.DB_FILE || DB_PATH);
    g.__lrSchema = SCHEMA;
  }
  return g.__lrDb;
}

/** Used by restore and tests: close the connection so the file can be replaced. */
export function closeDb() {
  g.__lrDb?.close();
  g.__lrDb = undefined;
}

export function getSetting<T>(key: string, fallback: T): T {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  db()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}

export function nowIso() {
  return new Date().toISOString();
}
