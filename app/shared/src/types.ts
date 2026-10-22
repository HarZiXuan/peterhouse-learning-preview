import type { ClassLevel } from "./classes";

/**
 * The fixed rating scale (Teacher Questions v0.3, section 1). It is not admin-editable, so the writer
 * always reads a score the same way. Numbers are stored but never shown to families.
 */
export const SCALE = [
  { score: 1, label: "Still learning", meaning: "Just starting; needs a lot of help" },
  { score: 2, label: "Sometimes", meaning: "Shows it sometimes, usually with help" },
  { score: 3, label: "Regularly", meaning: "Shows it regularly in familiar situations" },
  { score: 4, label: "Confidently", meaning: "Shows it easily, in different situations" },
  { score: 5, label: "Really shines", meaning: "Does it independently and helps or inspires others" },
] as const;

export const NOT_SEEN = {
  label: "Not seen yet",
  meaning: "Joined late, was away, or no chance to observe. No score is saved.",
} as const;

export const LEVELS = SCALE.map((s) => s.label);
export type LevelWord = (typeof SCALE)[number]["label"];
/** 1–5, or 0 for "Not seen yet". A rating only counts once `touched` is true: every rating starts blank. */
export type Level = 0 | 1 | 2 | 3 | 4 | 5;

/** Limits from the spec. */
export const NOTE_MAX = 140;
export const LOVE_MAX = 300;
export const HOME_PICKS_MAX = 2;
/** The report has room for one photo on each learning page, and one more for the cover. */
export const PHOTOS_PER_AREA = 1;
/** The `area_key` of the photo chosen for the cover of the report. */
export const COVER_PHOTO_KEY = "cover";
export const QUESTIONS_MIN = 3;
export const QUESTIONS_MAX = 6;

export type Skill = {
  /** Permanent hidden ID ("eng_1"). Rewording keeps it; a different skill gets a new one. */
  key: string;
  /** "{name} listens well and responds in a group." {name} and {he/she} are filled in for the child. */
  text: string;
  /** The levels this question is asked at (CHANGES-TO-MAKE change 8). Missing means every level, as in older sets. */
  levels?: ClassLevel[];
};

export type AreaLanguage = "en" | "zh";

export type Area = {
  key: string;
  name: string;
  shortName: string;
  /** A second name shown beside the first, e.g. "华文". */
  subName?: string;
  /** Icon name for the form and the report (eng, chi, mat, sed, enr). */
  icon?: string;
  /** The language this area's questions and report paragraph are written in. Missing means English. */
  language?: AreaLanguage;
  skills: Skill[];
  /** Short text question, answered in a sentence or two ("What did {name} love most this semester?"). */
  love?: { key: string; text: string };
  /** Ideas to try at home; the teacher picks up to two. */
  homeIdeas?: string[];
};

/** One frozen question set. Reviews keep the copy they were first opened with. */
export type Rubric = {
  version: number;
  areas: Area[];
  neverUse: string[];
  /** Set on a review's frozen copy: the level whose questions it holds. */
  level?: ClassLevel;
};

export type Role = "admin" | "teacher";
export type ClassRole = "lead" | "co";
export type Pronoun = "she" | "he";
export type ReviewStatus = "not_started" | "draft" | "ready" | "written" | "submitted" | "changes_requested" | "approved";
export type TermStatus = "open" | "closed" | "locked";

/**
 * The four stages a report is in, everywhere staff see one (the Reports tabs, Children, a class, a teacher):
 * with teachers (from no ratings up to written but not sent), waiting for review, changes requested, approved.
 */
export type ReportStage = "submitted" | "changes_requested" | "approved" | "not_done";
export const REPORT_STAGES: ReportStage[] = ["submitted", "changes_requested", "approved", "not_done"];
export const stageOf = (s: ReviewStatus): ReportStage => (s === "submitted" || s === "changes_requested" || s === "approved" ? s : "not_done");
export const STAGE_LABEL: Record<ReportStage, string> = {
  submitted: "Waiting for review",
  changes_requested: "Changes requested",
  approved: "Approved",
  not_done: "With teachers",
};
/** A status in words: its stage. */
export const STATUS_LABEL: Record<ReviewStatus, string> = {
  not_started: STAGE_LABEL.not_done,
  draft: STAGE_LABEL.not_done,
  ready: STAGE_LABEL.not_done,
  written: STAGE_LABEL.not_done,
  submitted: STAGE_LABEL.submitted,
  changes_requested: STAGE_LABEL.changes_requested,
  approved: STAGE_LABEL.approved,
};

export type SkillAnswer = {
  level: Level;
  /** True once the teacher has picked a score or "Not seen yet". Untouched means not rated yet. */
  touched?: boolean;
};

export type AreaAnswer = {
  skills: Record<string, SkillAnswer>;
  /** One optional comment, up to about 140 characters (Chinese allowed). */
  note: string;
  visited: boolean;
  /** Answer to the area's short text question, when it has one. */
  love?: string;
  /** The home ideas the teacher picked, when the area offers them. */
  home?: string[];
  /** Ticked moments from the older question sets; no longer asked. */
  moments?: string[];
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
};

export type ParagraphKey = string; // "opening" | `area:${key}` | "closing"

export type Paragraph = {
  key: ParagraphKey;
  title: string;
  text: string;
  flags: string[];
  stale: boolean;
  edited: boolean;
};

export type Draft = {
  paragraphs: Paragraph[];
  homeIdeas: string[];
  provider: string;
  writtenAt: string;
  writtenBy: number;
  /** The exact anonymous text sent for writing (empty for the sentence bank, which runs locally). */
  sent: string;
  notes: string[];
};
