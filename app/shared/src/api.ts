// The contract between the frontend and the backend: every shape that crosses /api.
import type { AreaAnswer, ClassRole, Level, Pronoun, ReviewStatus, Rubric, Role } from "./types";
import type { ClassLevel, LevelProblem } from "./classes";

export type SessionUser = { id: number; email: string; name: string; role: Role; mustChangePassword: boolean };

export type SchoolDetails = {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Old single-class setting: printed only when the child's class has no teachers. Comma-separated. */
  teachers: string;
  /** Old single-class setting: no longer printed; each report uses the child's own class. */
  className: string;
};

/** "June" is Semester 1 (January to June); "December" is Semester 2 (July to December). */
export type Season = "June" | "December";

export type WorkspaceInfo = {
  user: SessionUser;
  school: SchoolDetails;
  period: { season: Season; year: number };
  hasAi: boolean;
  /** The classes this person can see this semester: every class for an administrator, their own for a teacher. */
  classes: ClassSummary[];
  /** For an administrator: reports waiting for their review. */
  waiting: number;
};

export type StaffRef = { id: number; name: string };

export type ClassSummary = {
  id: number;
  name: string;
  level: ClassLevel;
  /** Children in this level are born in this year ("turning 5 in 2026"). */
  birthYear: number;
  lead: StaffRef | null;
  co: StaffRef[];
  /** Active children (not those marked as left). */
  children: number;
  /** Most children the class may have for its teachers (the level's ratio × teachers). */
  capacity: number;
};

export type ClassChild = {
  reviewId: number;
  classId: number;
  name: string;
  chineseName: string;
  dateOfBirth: string;
  pronoun: Pronoun;
  /** The child's level this year, from the birth year (null with a level problem). */
  level: ClassLevel | null;
  levelProblem: LevelProblem | null;
  status: ReviewStatus;
  hasReport: boolean;
  left: boolean;
};

export type ClassDetail = ClassSummary & { pupils: ClassChild[]; year: number };

export type ClassesView = { year: number; classes: ClassSummary[]; teachers: StaffRef[]; flagged: ClassChild[] };

export type ChildListItem = {
  reviewId: number;
  name: string;
  chineseName: string;
  answered: number;
  total: number;
  hasReport: boolean;
  /** One entry per domain: how many of its statements are rated or marked "Not seen yet". */
  areas: { name: string; answered: number; total: number }[];
  coverPhotoId: number | null;
  classId: number;
  className: string;
  status: ReviewStatus;
};

export type SaveResult =
  | { ok: true; savedAt: string; status: ReviewStatus }
  | { ok: false; conflict: { by: string; at: string; answer: AreaAnswer } }
  | { ok: false; error: string };

export type WriteOutcome = { ok: true; provider: string; fellBack: string | null } | { ok: false; error: string };

export type ReviewPhoto = { id: number; areaKey: string | null };

/** Where a report is in "teachers write, the administrator approves" (CHANGES-TO-MAKE changes 1 and 3). */
export type Workflow = {
  status: ReviewStatus;
  /** Why this person cannot change the ratings or the wording right now, or null when they can. */
  locked: string | null;
  /** The administrator's note when the report was sent back. */
  changeNote: { text: string; by: string | null; at: string } | null;
  submitted: { by: string | null; at: string } | null;
  approved: { by: string | null; at: string } | null;
  /** An administrator has taken the report over; the teacher cannot edit it meanwhile. */
  takenOver: { by: string | null; at: string } | null;
  /** Staff only: an administrator changed it. Never printed. */
  adminEdited: boolean;
  /** How many times it has been submitted. */
  versions: number;
  canSubmit: boolean;
  canTakeBack: boolean;
  /** The PDF for families is made only once the report is approved. */
  canDownload: boolean;
};

export type ReviewView = {
  reviewId: number;
  childName: string;
  chineseName: string;
  pronoun: Pronoun;
  status: ReviewStatus;
  rubric: Rubric;
  answers: Record<string, AreaAnswer>;
  hasReport: boolean;
  photos: ReviewPhoto[];
  photoConsent: boolean;
  photosPerArea: number;
  semester: string;
  updatedAt: string;
  workflow: Workflow;
};

export type ReportData = {
  reviewId: number;
  childName: string;
  chineseName: string;
  childInitial: string;
  className: string;
  dateOfBirth: string;
  season: string;
  year: number;
  /** Every photo the report may show (only with photo consent), cover first. */
  photoIds: number[];
  areas: {
    key: string;
    name: string;
    subName: string | null;
    icon: string | null;
    summary: Level | null;
    /** Statements with the child's name filled in. Families see marks and words, never the numbers. */
    skills: { key: string; text: string; level: Level; up: boolean; /** The rating from the previous semester, when the same question was asked. */ previous: Level | null }[];
    /** This domain's own photos (only with photo consent). */
    photoIds: number[];
    /** Answer to the domain's short text question ("What did Mia love most?"). */
    love: { question: string; answer: string } | null;
    paragraph: string;
  }[];
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
  workflow: Workflow;
};

export type ApprovalStatusFilter = "waiting" | "changes" | "approved" | "not_submitted";

export type ApprovalItem = {
  reviewId: number;
  childName: string;
  chineseName: string;
  classId: number;
  className: string;
  /** Who submitted it, else the class's lead teacher. */
  teacher: string | null;
  status: ReviewStatus;
  version: number;
  updatedAt: string;
  adminEdited: boolean;
};

export type ApprovalsView = {
  items: ApprovalItem[];
  counts: Record<ApprovalStatusFilter, number>;
  classes: { id: number; name: string }[];
  teachers: { id: number; name: string }[];
};

export type ApprovalDetail = {
  report: ReportView;
  /** The teacher's comment and ratings for each area, beside the report. */
  areas: { key: string; name: string; note: string; ratings: { text: string; word: string }[] }[];
  versions: { version: number; submittedBy: string | null; submittedAt: string; decision: string | null; decidedBy: string | null; note: string }[];
  /** Paragraph titles that changed since the version before the latest one. */
  changedSinceLast: string[];
  className: string;
  teacher: string | null;
};

export type UserSummary = {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  /** Set while five wrong passwords keep the account locked. */
  lockedUntil: string | null;
  /** This semester's classes, for a teacher. */
  classes: { id: number; name: string; role: ClassRole }[];
  /** Reports written so far for the children in their classes this semester. */
  progress: { written: number; total: number };
};

export type AuditEntry = { id: number; at: string; userName: string | null; action: string; detail: string };

export type NewChildInput = { name: string; chineseName: string; pronoun: Pronoun; dateOfBirth: string; classId: number };

// ─── Admin: editing the questions ───────────────────────────────────────────

export type DraftQuestion = {
  key: string;
  text: string;
  /** How it differs from the live version. */
  change: "added" | "reworded" | null;
  /** The live wording, when reworded. */
  was: string | null;
};

export type RetiredQuestion = { key: string; text: string; retiredAt: string | null };

export type DraftDomain = {
  key: string;
  name: string;
  shortName: string;
  subName: string | null;
  icon: string | null;
  questions: DraftQuestion[];
  retired: RetiredQuestion[];
  love: { key: string; text: string; was: string | null } | null;
  homeIdeas: string[] | null;
  homeChanged: boolean;
};

export type QuestionChange = {
  kind: "added" | "reworded" | "retired" | "restored" | "reordered" | "prompt" | "home";
  areaKey: string;
  areaName: string;
  key: string | null;
  text: string;
  was: string | null;
  /** What it means for history, in plain words. */
  effect: string;
};

export type QuestionBankView = {
  live: { version: number; publishedAt: string | null; publishedBy: string | null; reviews: number };
  domains: DraftDomain[];
  changes: QuestionChange[];
  /** Reasons the draft cannot be published yet (fewer than 3 or more than 6 questions in a domain…). */
  problems: string[];
  /** Reviews this semester already opened on an older version: they keep their wording. */
  openReviews: number;
  /** The draft as teachers would see it once published. */
  preview: Rubric;
  activity: AuditEntry[];
  scale: { score: number; label: string; meaning: string }[];
};

