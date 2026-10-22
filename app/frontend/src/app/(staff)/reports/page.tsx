import Link from "next/link";
import type { ApprovalsView, ClassLevel, PeriodSummary, QuestionBankView, WorkspaceInfo } from "@peterhouse/shared";
import { CLASS_LEVEL_KEYS, reportPeriod } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TAB, TAB_NAV } from "@/components/ui/tab-styles";
import { QuestionsEditor } from "../questions/QuestionsEditor";
import { TeacherReports } from "./TeacherReports";
import { Timeline } from "./Timeline";
import { ReviewQueue, type QueueParams } from "./ReviewQueue";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Params = QueueParams & { view?: string; area?: string; published?: string; set?: string; show?: string };

/**
 * The administrator's semester page: the review queue, and the questions teachers are asked, in one place.
 * A teacher gets their own version: the reports of their classes, by semester.
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params & { class?: string }> }) {
  const sp = await searchParams;
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") return <TeacherReports sp={sp} period={info.period} />;

  const questions = sp.view === "questions";
  const [{ counts }, bank, periods] = await Promise.all([
    apiGet<ApprovalsView>("/admin/approvals"),
    questions ? apiGet<QuestionBankView>("/admin/questions") : null,
    questions ? null : apiGet<PeriodSummary[]>("/admin/periods"),
  ]);
  const now = periods?.find((p) => p.current);
  // A period other than the current one is on view only if it exists.
  const shown = periods?.find((p) => p.termId === Number(sp.term) && !p.current) ?? now;
  const past = shown && !shown.current ? shown : undefined;
  const area = bank?.domains.find((d) => d.key === sp.area)?.key ?? bank?.domains[0]?.key;

  return (
    <main className="mx-auto max-w-[1360px] px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">
          {past ? `${reportPeriod(past.season, past.year)} · past period` : `${reportPeriod(info.period.season, info.period.year)} · teachers write, you approve`}
        </p>
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold tracking-tight md:text-4xl"><Icon name="reports" size={30} />Reports</h1>
        <p className="mt-1 max-w-xl text-muted-foreground">
          {questions
            ? "The questions teachers answer for each child. Edit them here, then publish."
            : "Read each report the way the family will see it, with the teacher’s ratings beside it. Approve it, or send it back with a note."}
        </p>
      </header>

      <nav className={cn(TAB_NAV, "mb-6")} aria-label="Reports">
        <Link href="/reports" aria-current={questions ? undefined : "page"} className={TAB}>
          Review{" "}
          <span className={cn("font-semibold", counts.waiting > 0 ? "rounded-full bg-primary px-1.5 text-primary-foreground" : "text-muted-foreground")}>{counts.waiting}</span>
        </Link>
        <Link href="/reports?view=questions" aria-current={questions ? "page" : undefined} className={TAB}>
          Questions
        </Link>
      </nav>

      {bank && area ? (
        <QuestionsEditor bank={bank} areaKey={area} published={sp.published ? Number(sp.published) : null} set={CLASS_LEVEL_KEYS.includes(sp.set as ClassLevel) ? (sp.set as ClassLevel) : "PG"} />
      ) : (
        <>
          {periods && shown && <Timeline periods={periods} selected={shown.termId} />}
          <ReviewQueue sp={sp} termId={past?.termId} />
        </>
      )}
    </main>
  );
}
