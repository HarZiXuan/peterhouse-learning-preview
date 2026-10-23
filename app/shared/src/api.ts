// The contract between the frontend and the backend: every shape that crosses /api.
import type { AreaAnswer, AreaLanguage, ClassRole, Level, Pronoun, ReviewStatus, Rubric, Role } from "./types";
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
  /** The signed-in person's own profile photo, or null. */
  myPhoto: string | null;
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
  /** How the person asking teaches this class: lead, co-teacher, subject teacher, or null (an administrator who does not). */
  myRole: ClassRole | "subject" | null;
  /** The subjects they are tagged with here; none means a lead or co-teacher teaches every subject. */
  mySubjects: { name: string; color: SubjectColor }[];
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
  /** The child's profile photo (a URL that changes when the photo does), or null. */
  photo: string | null;
};

/** Someone who teaches only some subjects in a class (change 12): they see its children and rate them, but do not write the report. */
export type SubjectTeacher = StaffRef & { subjectIds: number[] };

export type ClassDetail = ClassSummary & {
  pupils: ClassChild[];
  year: number;
  subjectTeachers: SubjectTeacher[];
  teacherSubjects: Record<number, number[]>;
  subjects: Subject[];
  /**
   * The report's learning areas and who rates each in this class: set on the class page, else the teacher tagged with
   * the matching subject, else the lead teacher.
   */
  areaTeachers: {
    key: string;
    name: string;
    teacher: StaffRef | null;
    source: "set" | "subject" | "lead";
    /** The subject that teaches this area, if any. */
    subject: string | null;
    /** Everyone tagged with that subject in this class. */
    teachers: StaffRef[];
  }[];
};

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
export type ChildInfo = {
  joinedOn: string;
  guardians: Guardian[];
  notes: string;
  /** The parents agreed to photos in the report. Without it no photo can be added and none prints. */
  photoConsent: boolean;
};

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
  /** The child's profile photo (a URL that changes when the photo does), or null. */
  photo: string | null;
  /** Newest first. */
  semesters: ChildSemester[];
};

export type ChildListItem = {
  reviewId: number;
  /** This person is the lead teacher of the child's class (they finish and send the report). */
  iAmLead: boolean;
  /** This person's own parts of the report: the areas they rate, and whether each was sent to the lead. */
  myParts: { area: string; done: boolean }[];
  /** The parts the lead is still waiting for, by area and teacher. */
  waitingFor: { area: string; teacher: string }[];
  /**
   * The report is still being put together from the teachers' parts. False once the lead has written it, it was sent
   * for review or approved, or an administrator took it over: then no part is anyone's to do.
   */
  partsOpen: boolean;
  /** An administrator has taken the report over. */
  takenOver: boolean;
  name: string;
  chineseName: string;
  answered: number;
  total: number;
  hasReport: boolean;
  /** One entry per domain: how many of its statements are rated or marked "Not seen yet". */
  areas: { name: string; answered: number; total: number }[];
  /** The child's profile photo (a URL that changes when the photo does), or null. */
  photo: string | null;
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

/** Where a report is in "teachers write, the administrator approves" (BUILT.md changes 1 and 3). */
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
  /** The administrator may give a report they took over back to its teacher. */
  canHandBack: boolean;
};

export type ReviewView = {
  reviewId: number;
  childId: number;
  /** The child's profile photo (a URL that changes when the photo does), or null. */
  photo: string | null;
  childName: string;
  chineseName: string;
  pronoun: Pronoun;
  status: ReviewStatus;
  rubric: Rubric;
  answers: Record<string, AreaAnswer>;
  hasReport: boolean;
  photos: ReviewPhoto[];
  photosPerArea: number;
  /** The parents gave photo consent: without it no photo can be added and none prints. */
  photoConsent: boolean;
  semester: string;
  updatedAt: string;
  workflow: Workflow;
  /** This person brings the parts together and sends the report: the class's lead teacher. */
  isLead: boolean;
  leadName: string | null;
  /** May write the whole report: the lead teacher, or an administrator who took the report over. */
  canWriteReport: boolean;
  /** Each learning area's part: who rates it, its checked paragraph, and whether it was sent to the lead. */
  parts: Record<string, PartView>;
  /** The parts the lead is still waiting for. */
  waitingFor: { area: string; teacher: string }[];
};

export type PartView = {
  /** Who rates this area in this class (null: any of the class's teachers). */
  owner: StaffRef | null;
  /** It is this person's part. */
  mine: boolean;
  /** This person may rate it and change its paragraph (its teacher, the lead, or an administrator who took the report over). */
  canEdit: boolean;
  paragraph: string;
  /** When its teacher sent it to the lead. */
  done: { by: string | null; at: string } | null;
};

export type ReportData = {
  reviewId: number;
  /** The full name, for the cover. */
  childName: string;
  /** What the report calls the child everywhere else ("Nur Aisyah"). */
  firstName: string;
  chineseName: string;
  childInitial: string;
  className: string;
  dateOfBirth: string;
  season: string;
  year: number;
  /** The cover photo's URL: the child's profile photo (or, on a report approved before profile photos, the cover it was approved with), else null. */
  coverPhoto: string | null;
  /** Every other photo the report may show: the learning pages' own, and older ones that belong to no area. */
  photoIds: number[];
  areas: {
    key: string;
    name: string;
    subName: string | null;
    icon: string | null;
    /** "zh": the area's paragraph is written in Chinese, so its headings are too. */
    language: AreaLanguage;
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

export type ReportSection = {
  key: string;
  title: string;
  text: string;
  /** What the checks found in this paragraph (a number, a banned word, another child's name…). */
  flags?: string[];
  /** The ratings behind it changed after it was written: read it again before sending. */
  stale?: boolean;
};

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
  /** The date printed on the report: when it was approved, or null for today. */
  reportDate: string | null;
};

/** One teacher's page of the report: how it will print, and their part of it to check and send to the lead. */
export type PartPageView = {
  reviewId: number;
  childName: string;
  areaKey: string;
  areaName: string;
  data: ReportData;
  school: SchoolDetails;
  part: PartView;
  leadName: string | null;
  /** Why it cannot be changed now (the report was sent for review, approved…), or null. */
  locked: string | null;
  /** Every statement in the area is rated or marked Not seen yet, so the page can be written. */
  rated: boolean;
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
  /** Profile photo URL, or null when there is none. */
  photo: string | null;
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
  /** The parents agreed to photos in the report. */
  photoConsent?: boolean;
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


// ─── Class calendar (BUILT.md change 5) ──────────────────────────────

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

// ─── Subject timetable (BUILT.md change 7) ───────────────────────────

/** Soft colours a subject can take; the screens turn each into a tint with dark text. */
/** Each subject has its own colour: no two subjects share one. */
export const SUBJECT_COLORS = [
  "sky", "ocean", "indigo", "lilac", "plum", "berry", "blush", "rose", "red", "coral", "peach", "amber",
  "sun", "lime", "olive", "leaf", "forest", "teal", "sand", "stone", "slate", "cocoa",
] as const;
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
  /** The classes this person can see a timetable for, with their level so the picker can go level first. */
  classes: { id: number; name: string; level: ClassLevel }[];
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
  /** The teachers named on these lessons, so each lesson shows who teaches it. */
  teachers: StaffRef[];
  /** The classes this person can see, for names, colours and the filter. */
  classes: { id: number; name: string; level: ClassLevel }[];
  /** Today in Singapore, YYYY-MM-DD. */
  today: string;
};

export type CalendarLink = { path: string };

/** Where a child's profile photo is served; `at` (when it last changed) makes a new photo a new URL. */
/** A staff member's profile photo; the version in the URL changes when the photo does. */
export const userPhotoUrl = (userId: number, at: string | Date | null | undefined) => (at ? `/api/users/${userId}/photo?v=${new Date(at).getTime()}` : null);
export const childPhotoUrl = (childId: number, at: string | Date | null | undefined) => (at ? `/api/children/${childId}/photo?v=${new Date(at).getTime()}` : null);
