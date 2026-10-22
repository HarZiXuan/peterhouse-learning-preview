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
  /** The child across semesters, for their profile. */
  childId: number;
  classId: number;
  /** First and last name together. */
  name: string;
  firstName: string;
  lastName: string;
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

/** Someone who teaches only some subjects in a class (change 12): they see its children and rate them, but do not write the report. */
export type SubjectTeacher = StaffRef & { subjectIds: number[] };

export type ClassDetail = ClassSummary & { pupils: ClassChild[]; year: number; subjectTeachers: SubjectTeacher[]; teacherSubjects: Record<number, number[]>; subjects: Subject[] };

export type ClassesView = {
  year: number;
  classes: ClassSummary[];
  teachers: StaffRef[];
  flagged: ClassChild[];
  /** Every child this semester, including those marked as left, for the Children table (change 14). */
  pupils: ClassChild[];
};

export type Guardian = { name: string; relationship: string; phone: string; email: string };

/** What the school keeps about a child besides their reviews. Only the administrator changes it. */
export type ChildInfo = { joinedOn: string; guardians: Guardian[]; notes: string };

/** One semester at school: the class they were in and that semester's review. */
export type ChildSemester = {
  reviewId: number;
  year: number;
  semester: 1 | 2;
  /** True for the semester the school is in now. */
  current: boolean;
  classId: number;
  className: string;
  level: ClassLevel;
  teachers: string[];
  status: ReviewStatus;
  hasReport: boolean;
  approvedAt: string | null;
};

/** A child's profile page: who they are, every semester they were here, and the school's information about them. */
export type ChildProfile = ChildInfo & {
  id: number;
  /** First and last name together. */
  name: string;
  firstName: string;
  lastName: string;
  chineseName: string;
  dateOfBirth: string;
  pronoun: Pronoun;
  left: boolean;
  leftAt: string | null;
  /** Newest first. */
  semesters: ChildSemester[];
};

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
  /** Who sent the report for review, and when. Null until it is sent. */
  submittedBy: string | null;
  submittedAt: string | null;
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
  photosPerArea: number;
  semester: string;
  updatedAt: string;
  workflow: Workflow;
  /** A subject teacher rates the children but does not write the report. */
  subjectOnly: boolean;
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
  /** The photo chosen for the cover, else null. */
  coverPhotoId: number | null;
  /** Every other photo the report may show: the learning pages' own, and older ones that belong to no area. */
  photoIds: number[];
  areas: {
    key: string;
    name: string;
    subName: string | null;
    icon: string | null;
    summary: Level | null;
    /** Statements with the child's name filled in. Families see marks and words, never the numbers. */
    skills: { key: string; text: string; level: Level; up: boolean; /** The rating from the previous semester, when the same question was asked. */ previous: Level | null }[];
    /** This domain's own photos. */
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
  /** Everyone teaching the class. */
  classTeachers: string[];
  /** The teacher who sent it for review, and when. Null while it has not been sent. */
  submittedBy: string | null;
  submittedAt: string | null;
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

/** One report period (June or December of a year) and where its reports stand. */
export type PeriodSummary = {
  termId: number;
  season: Season;
  year: number;
  /** The period teachers are writing now. */
  current: boolean;
  counts: Record<ApprovalStatusFilter, number>;
  total: number;
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
  /** This semester's classes, for a teacher: as lead or co-teacher, or as the teacher of a subject there. */
  /** `subjects` are the ones they are tagged with in that class; empty for a lead or co-teacher means every subject. */
  classes: { id: number; name: string; role: ClassRole | "subject"; subjects?: { name: string; color: string }[] }[];
  /** Reports written so far for the children in their classes this semester. */
  progress: { written: number; total: number };
};

export type TeacherDetail = { user: UserSummary; reports: ApprovalItem[] };

export type AuditEntry = { id: number; at: string; userName: string | null; action: string; detail: string };

export type NewChildInput = {
  firstName: string;
  lastName: string;
  chineseName: string;
  pronoun: Pronoun;
  dateOfBirth: string;
  classId: number;
  /** The first day at school (YYYY-MM-DD); today when left out. */
  joinedOn?: string;
  /** Parents and guardians, as on the child's profile. Blank rows are dropped. */
  guardians?: Guardian[];
  /** The school's notes about the child. */
  notes?: string;
};

// ─── Admin: editing the questions ───────────────────────────────────────────

export type DraftQuestion = {
  key: string;
  text: string;
  /** The levels it is asked at. */
  levels: ClassLevel[];
  /** How it differs from the live version. */
  change: "added" | "reworded" | null;
  /** The live wording, when reworded. */
  was: string | null;
};

export type RetiredQuestion = { key: string; text: string; retiredAt: string | null; levels: ClassLevel[] };

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
  kind: "added" | "reworded" | "retired" | "restored" | "reordered" | "prompt" | "home" | "levels";
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


// ─── Class calendar (CHANGES-TO-MAKE change 5) ──────────────────────────────

export type CalendarKind = "event" | "closure" | "deadline";
export type CalendarAudience = "school" | "levels" | "classes";

export type CalendarEvent = {
  id: number;
  kind: CalendarKind;
  title: string;
  /** YYYY-MM-DD; the same day for a one-day entry. */
  startsOn: string;
  endsOn: string;
  /** HH:MM, or null for an all-day entry. */
  startTime: string | null;
  endTime: string | null;
  place: string;
  note: string;
  audience: CalendarAudience;
  levels: ClassLevel[];
  classIds: number[];
};

export type CalendarEventInput = Omit<CalendarEvent, "id">;

/** A class's weekly hours, from its first lesson to its last each day (1 = Monday … 7 = Sunday). */
export type Timetable = { classId: number; days: { weekday: number; start: string; end: string }[] };

// ─── Subject timetable (CHANGES-TO-MAKE change 7) ───────────────────────────

/** Soft colours a subject can take; the screens turn each into a tint with dark text. */
export const SUBJECT_COLORS = ["sky", "rose", "sun", "leaf", "lilac", "peach", "stone"] as const;
export type SubjectColor = (typeof SUBJECT_COLORS)[number];

export type Subject = {
  id: number;
  name: string;
  color: SubjectColor;
  active: boolean;
};

export type Lesson = {
  id: number;
  classId: number;
  subjectId: number;
  weekday: number;
  /** HH:MM */
  start: string;
  end: string;
  teacherId: number | null;
  room: string;
  /** The Monday of the one week this lesson belongs to; null for the normal weekly timetable. */
  weekOf?: string | null;
};

export type LessonInput = Omit<Lesson, "id">;

export type TimetableView = {
  classId: number;
  className: string;
  lessons: Lesson[];
  /** The Monday of the week being edited, or null for the class's normal week. */
  weekOf: string | null;
  /** Whether that week has its own lessons (otherwise it follows the normal week). */
  weekChanged: boolean;
  /** The weeks of this class that differ from its normal week, as Mondays. */
  changedWeeks: string[];
  subjects: Subject[];
  /** Who can be named on this class's lessons (change 12): lead and co-teachers for any subject (null), subject teachers for theirs. */
  teachers: (StaffRef & { subjectIds: number[] | null })[];
  /** The administrator edits everything; a subject teacher edits the lessons of their own subject in this class. */
  editable: "all" | { subjectIds: number[] } | null;
  /** The classes this person can see a timetable for. */
  classes: { id: number; name: string }[];
};

export type SubjectsView = { subjects: Subject[]; inUse: Record<number, number> };

export type CalendarView = {
  /** The events this person can see that touch the requested dates. */
  events: CalendarEvent[];
  timetables: Timetable[];
  /** Every lesson of the classes this person can see, for the Week view and "Now / Next": the normal week, plus the lessons of changed weeks (weekOf set). */
  lessons: Lesson[];
  /** Weeks in range where a class does not follow its normal timetable. */
  changedWeeks: { classId: number; weekOf: string }[];
  subjects: Subject[];
  /** The classes this person can see, for names, colours and the filter. */
  classes: { id: number; name: string; level: ClassLevel }[];
  /** Today in Singapore, YYYY-MM-DD. */
  today: string;
};

export type CalendarLink = { path: string };
