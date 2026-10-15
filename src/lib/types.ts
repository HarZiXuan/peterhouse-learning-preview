export const LEVELS = ["Beginning", "Developing", "Growing", "Confident", "Flourishing"] as const;
export type LevelWord = (typeof LEVELS)[number];
/** 1–5, or 0 for "Not yet observed". */
export type Level = 0 | 1 | 2 | 3 | 4 | 5;
export const DEFAULT_LEVEL: Level = 3;

export type Skill = {
  key: string;
  name: string;
  /** Short sentence for the 1–5 rating, finishing "[Child] …". */
  statement?: string;
  /** Five descriptors, Beginning → Flourishing. */
  descriptors: string[];
  homeIdea: string;
};

export type Area = {
  key: string;
  name: string;
  shortName: string;
  /** The "What did you see?" moments shown for this area. */
  moments: string[];
  skills: Skill[];
};

export type Rubric = {
  areas: Area[];
  /** skillKey → level (1–5) → sentences. Empty means "derive from the descriptor". */
  sentenceBank: Record<string, Record<string, string[]>>;
  neverUse: string[];
};

export type Role = "admin" | "teacher";
export type ClassRole = "lead" | "co";
export type Pronoun = "she" | "he" | "they";
export type ReviewStatus = "not_started" | "draft" | "ready" | "written" | "approved";
export type TermStatus = "open" | "closed" | "locked";

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  not_started: "Not started",
  draft: "Draft",
  ready: "Ready",
  written: "Written",
  approved: "Approved",
};

export type SkillAnswer = {
  level: Level;
  /** True once the teacher has actually picked an answer (the default is not an answer). */
  touched?: boolean;
  /** Pre-filled from last term and not yet confirmed by a teacher. */
  fromLastTerm?: boolean;
};

export type AreaAnswer = {
  skills: Record<string, SkillAnswer>;
  moments: string[];
  note: string;
  visited: boolean;
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: number;
  must_change_password: number;
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
