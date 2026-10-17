// The contract between the frontend and the backend: every shape that crosses /api.
import type { AreaAnswer, Level, Pronoun, ReviewStatus, Rubric, Role } from "./types";

export type SessionUser = { id: number; email: string; name: string; role: Role; mustChangePassword: boolean };

export type SchoolDetails = {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Teacher name(s) printed on every report, comma-separated. */
  teachers: string;
  /** Class name printed on every report. */
  className: string;
};

/** "June" is Semester 1 (January to June); "December" is Semester 2 (July to December). */
export type Season = "June" | "December";

export type WorkspaceInfo = {
  user: SessionUser;
  school: SchoolDetails;
  period: { season: Season; year: number };
  hasAi: boolean;
};

export type ChildListItem = {
  reviewId: number;
  name: string;
  answered: number;
  total: number;
  hasReport: boolean;
  /** One entry per learning area: how many of its skills are answered. */
  areas: { name: string; answered: number; total: number }[];
  coverPhotoId: number | null;
};

export type SaveResult =
  | { ok: true; savedAt: string; status: ReviewStatus }
  | { ok: false; conflict: { by: string; at: string; answer: AreaAnswer } }
  | { ok: false; error: string };

export type WriteOutcome = { ok: true; provider: string; fellBack: string | null } | { ok: false; error: string };

export type NoteDef = { key: string; label: string; hint: string; max: number };

export type ReviewView = {
  reviewId: number;
  childName: string;
  rubric: Rubric;
  answers: Record<string, AreaAnswer>;
  highlight: string;
  notes: Record<string, string>;
  noteDefs: NoteDef[];
  hasReport: boolean;
  photos: { id: number }[];
  photoConsent: boolean;
  maxPhotos: number;
};

export type ReportData = {
  reviewId: number;
  childName: string;
  childInitial: string;
  className: string;
  dateOfBirth: string;
  season: string;
  year: number;
  photoIds: number[];
  areas: {
    key: string;
    name: string;
    summary: Level | null;
    skills: { name: string; level: Level; up: boolean; /** The rating from the previous semester, when there was one. */ previous: Level | null }[];
    moments: string[];
    /** Average of the observed skills on a 0–10 scale, one decimal; null when nothing was observed. */
    score: number | null;
    paragraph: string;
  }[];
  /** Average of the area scores; null when scores are hidden or nothing was observed. */
  overallScore: number | null;
  opening: string;
  closing: string;
  strengths: string[];
  nextSteps: string[];
  homeIdeas: string[];
  leadTeachers: string[];
  coTeachers: string[];
  version: number;
  previousSeason: string | null;
};

export type ReportSection = { key: string; title: string; text: string };

export type ReportView = {
  reviewId: number;
  childName: string;
  data: ReportData;
  school: SchoolDetails;
  sections: ReportSection[];
  /** Notes the writer left for the teacher (fallbacks, names replaced…). */
  notes: string[];
  provider: string;
};

export type UserSummary = {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export type AuditEntry = { id: number; at: string; userName: string | null; action: string; detail: string };

export type NewChildInput = { name: string; pronoun: Pronoun; dateOfBirth: string };
