import Link from "next/link";
import { listChildren, getReportPeriod } from "@/lib/workspace";
import { getAi, getSchool } from "@/lib/school";
import { AreaPips, ChildAvatar } from "@/components/ui";
import { removeChildAction } from "./actions";
import { AddChild } from "./AddChild";
import { RemoveChild } from "./RemoveChild";

type Show = "all" | "todo" | "ready";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const show: Show = sp.show === "todo" || sp.show === "ready" ? sp.show : "all";
  const kids = listChildren();
  const period = getReportPeriod();
  const school = getSchool();
  const ai = getAi();
  const hasAi = ai.provider === "gemini" ? !!ai.geminiKey : ai.provider === "openai" ? !!ai.openaiKey : ai.provider === "local";

  const ready = kids.filter((c) => c.hasReport).length;
  const inProgress = kids.filter((c) => !c.hasReport && c.answered > 0).length;
  const notStarted = kids.length - ready - inProgress;
  const todo = kids.length - ready;
  const list = kids.filter((c) => (show === "ready" ? c.hasReport : show === "todo" ? !c.hasReport : true));
  const nextUp = kids.find((c) => !c.hasReport);

  return (
    <main className="board">
      <header className="board-head">
        <div>
          <p className="eyebrow">
            {period.season} {period.year} learning reviews
          </p>
          <h1>{school.className || "Your class"}</h1>
          <p className="lede">
            {kids.length === 0
              ? "Welcome. Add the children in your class to begin."
              : todo === 0
                ? "Every report is ready. Lovely work."
                : `${todo} ${todo === 1 ? "child" : "children"} still to do. Pick one to answer their questions.`}
          </p>
        </div>
        {kids.length > 0 && <AddChild />}
      </header>

      {kids.length === 0 && (
        <div className="empty">
          <h2>No children yet</h2>
          <p>Add each child in your class. For every child you’ll answer a few questions, then create their report.</p>
          <AddChild label="+ Add your first child" />
        </div>
      )}

      {!hasAi && kids.length > 0 && (
        <p className="note">
          Reports use the built-in basic writer. For richer, AI-written reports, <Link href="/settings">add an AI key in Settings</Link>.
        </p>
      )}

      {kids.length > 0 && (
        <>
          <section className="tally" aria-label="Class progress">
            <div className="tally-bar" role="img" aria-label={`${ready} reports ready, ${inProgress} in progress, ${notStarted} not started`}>
              <span style={{ flex: ready }} className="t-ready" />
              <span style={{ flex: inProgress }} className="t-prog" />
              <span style={{ flex: notStarted }} className="t-none" />
            </div>
            <ul className="tally-key">
              <li><i className="t-ready" />{ready} reports ready</li>
              <li><i className="t-prog" />{inProgress} in progress</li>
              <li><i className="t-none" />{notStarted} not started</li>
            </ul>
          </section>

          <nav className="chips" aria-label="Show">
            <Link href="/" aria-current={show === "all" ? "true" : undefined}>Everyone <b>{kids.length}</b></Link>
            <Link href="/?show=todo" aria-current={show === "todo" ? "true" : undefined}>To do <b>{todo}</b></Link>
            <Link href="/?show=ready" aria-current={show === "ready" ? "true" : undefined}>Reports ready <b>{ready}</b></Link>
          </nav>

          {list.length === 0 ? (
            <div className="empty">
              {show === "todo" ? (
                <>
                  <h2>All caught up</h2>
                  <p>Every child’s report is ready, so there is nothing left to do.</p>
                  <Link className="btn btn-primary" href="/?show=ready">See the finished reports</Link>
                </>
              ) : (
                <>
                  <h2>No reports yet</h2>
                  <p>A report appears here once you have answered a child’s questions and pressed Create report.</p>
                  {nextUp && (
                    <Link className="btn btn-primary" href={`/child/${nextUp.reviewId}`}>
                      {nextUp.answered ? `Continue with ${nextUp.name}` : `Start with ${nextUp.name}`}
                    </Link>
                  )}
                </>
              )}
              <Link className="btn btn-quiet" href="/">Show everyone</Link>
            </div>
          ) : (
            <ul className="cards">
              {list.map((c) => {
                const complete = c.answered === c.total;
                const state = c.hasReport ? "Report ready" : complete ? "All answered" : c.answered === 0 ? "Not started" : `${c.answered} of ${c.total} answered`;
                const primary = c.hasReport
                  ? { href: `/child/${c.reviewId}/report`, label: "Open report" }
                  : complete
                    ? { href: `/child/${c.reviewId}`, label: "Create report" }
                    : { href: `/child/${c.reviewId}`, label: c.answered === 0 ? "Start questions" : "Continue" };
                return (
                  <li key={c.reviewId} className="kid" data-state={c.hasReport ? "ready" : complete ? "done" : c.answered ? "prog" : "none"}>
                    <Link href={`/child/${c.reviewId}`} className="kid-main" aria-label={`${c.name}: ${state}`}>
                      <ChildAvatar photoId={c.coverPhotoId} name={c.name} size={64} />
                      <span className="kid-name">{c.name}</span>
                      <span className="kid-state">{state}</span>
                    </Link>
                    <div className="kid-foot">
                      <AreaPips areas={c.areas} />
                      <div className="row" style={{ gap: 6 }}>
                        <RemoveChild name={c.name} action={removeChildAction.bind(null, c.reviewId)} />
                        <Link className={`btn btn-sm ${c.hasReport || complete ? "btn-primary" : ""}`} href={primary.href}>
                          {primary.label}
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
