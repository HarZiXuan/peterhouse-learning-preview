import type { ClassLevel, ClassSummary, ReportStage, ReviewStatus, StaffRef } from "@peterhouse/shared";
import { initials } from "@/components/ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** The level's mark in the New class dialog: young to old, warm to cool. */
export const LEVEL_TINT: Record<ClassLevel, string> = {
  PG: "bg-[#f5ccce] text-[#6e1118]",
  N1: "bg-[#fde7a4] text-[#5a4300]",
  N2: "bg-[#c7e9fa] text-[#0a3a57]",
  K1: "bg-[#a9d4ea] text-[#06304a]",
  K2: "bg-[#091f34] text-white",
};

/** Each age group's column on the Classes page: a soft ground, a stronger chip, deep text and a dashed outline for "add". */
export const LEVEL_COLUMN: Record<ClassLevel, { soft: string; chip: string; deep: string; dash: string }> = {
  PG: { soft: "bg-[#fcefef]", chip: "bg-[#f5ccce]", deep: "text-[#6e1118]", dash: "border-[#e7b6b9] hover:bg-[#f9e3e3]" },
  N1: { soft: "bg-[#fff7dc]", chip: "bg-[#fde7a4]", deep: "text-[#5a4300]", dash: "border-[#ecd78b] hover:bg-[#fff0c2]" },
  N2: { soft: "bg-[#eaf6fd]", chip: "bg-[#c7e9fa]", deep: "text-[#0a3a57]", dash: "border-[#a9d4ea] hover:bg-[#dcf0fa]" },
  K1: { soft: "bg-[#e6f2f8]", chip: "bg-[#a9d4ea]", deep: "text-[#06304a]", dash: "border-[#92c0d8] hover:bg-[#d8ebf4]" },
  K2: { soft: "bg-[#e8ebf0]", chip: "bg-[#c3cad6]", deep: "text-[#091f34]", dash: "border-[#aab3c2] hover:bg-[#dde2ea]" },
};

const PERSON_TINTS = ["bg-[#f5ccce] text-[#6e1118]", "bg-[#c7e9fa] text-[#0a3a57]", "bg-[#fde7a4] text-[#5a4300]", "bg-[#d8ead9] text-[#1f5236]"];
export const personTint = (i: number) => PERSON_TINTS[i % PERSON_TINTS.length];

/** Review status as a pill: the word always shows, colour only helps. */
/** Each report stage's badge colour. */
export const STAGE_TONE: Record<ReportStage, string> = {
  not_done: "border-transparent bg-secondary text-muted-foreground",
  submitted: "border-transparent bg-primary/10 text-primary",
  changes_requested: "border-transparent bg-warn/25 text-[#5a4300]",
  approved: "border-transparent bg-success text-white",
};
export const STATUS_TONE: Record<ReviewStatus, string> = {
  not_started: STAGE_TONE.not_done,
  draft: STAGE_TONE.not_done,
  ready: STAGE_TONE.not_done,
  written: STAGE_TONE.not_done,
  submitted: STAGE_TONE.submitted,
  changes_requested: STAGE_TONE.changes_requested,
  approved: STAGE_TONE.approved,
};

export const STAGE_FILL: Record<ReportStage, string> = {
  not_done: "#d6d2c8",
  submitted: "#ae1d25",
  changes_requested: "#e0a800",
  approved: "#1f5236",
};

export const hasTeacher = (k: Pick<ClassSummary, "lead" | "co">) => !!k.lead || k.co.length > 0;

export function TeacherStack({ people, size = 32 }: { people: StaffRef[]; size?: number }) {
  return (
    <span className="flex -space-x-1.5" aria-hidden>
      {people.map((t, i) => (
        <Avatar key={t.id} className={cn("ring-2 ring-card", personTint(i))} style={{ width: size, height: size }}>
          <AvatarFallback className={cn("text-[11px] font-bold", personTint(i))}>{initials(t.name)}</AvatarFallback>
        </Avatar>
      ))}
    </span>
  );
}
