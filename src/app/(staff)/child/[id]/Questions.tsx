"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AreaAnswer, Level, Rubric } from "@/lib/types";
import { createReportAction, saveAreaAction, saveHighlightAction, saveNoteAction } from "../../actions";

const WRITING_STEPS = [
  "Reading the answers…",
  "Hiding names so only anonymous answers are sent…",
  "Writing the opening…",
  "Writing each learning area…",
  "Writing the closing and ideas for home…",
  "Checking the wording…",
  "Almost there…",
];

function WritingOverlay({ name }: { name: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, WRITING_STEPS.length - 1)), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="writing-overlay" role="alertdialog" aria-modal="true" aria-labelledby="writing-title" aria-live="polite">
      <div className="writing-card">
        <div className="writing-spin" aria-hidden />
        <h2 id="writing-title">Writing {name}’s report</h2>
        <p className="writing-msg">{WRITING_STEPS[step]}</p>
        <p className="tiny muted">This can take up to a minute. Please keep this page open.</p>
        <div className="writing-bar" aria-hidden>
          <span />
        </div>
      </div>
    </div>
  );
}

export function Questions({
  reviewId,
  childName,
  rubric,
  initialAnswers,
  initialHighlight,
  notes: initialNotes,
  noteDefs,
  hasReport,
}: {
  reviewId: number;
  childName: string;
  rubric: Rubric;
  initialAnswers: Record<string, AreaAnswer>;
  initialHighlight: string;
  notes: Record<string, string>;
  noteDefs: { key: string; label: string; hint: string; max: number }[];
  hasReport: boolean;
}) {
  const router = useRouter();
  const latest = useRef(initialAnswers);
  const [answers, setAnswers] = useState(initialAnswers);
  const [highlight, setHighlight] = useState(initialHighlight);
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [writing, startWriting] = useTransition();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const total = rubric.areas.reduce((n, a) => n + a.skills.length, 0);
  const answered = rubric.areas.reduce((n, a) => n + a.skills.filter((s) => answers[a.key]?.skills[s.key]?.touched).length, 0);
  const allDone = answered === total;
  const areaDone = (i: number) => rubric.areas[i].skills.every((s) => answers[rubric.areas[i].key]?.skills[s.key]?.touched);
  const [current, setCurrent] = useState(0);

  // Highlight the chapter that is under the sticky bar as the teacher scrolls.
  useEffect(() => {
    const ids = [...rubric.areas.map((a) => `ch-${a.key}`), "ch-finish"];
    const onScroll = () => {
      let idx = 0;
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) idx = i;
      });
      setCurrent(idx);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [rubric.areas]);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const pick = (areaKey: string, skillKey: string, level: Level) => {
    const next: AreaAnswer = structuredClone(latest.current[areaKey]);
    next.skills[skillKey] = { level, touched: true };
    latest.current = { ...latest.current, [areaKey]: next };
    setAnswers(latest.current);
    clearTimeout(timers.current[areaKey]);
    setSaved("saving");
    timers.current[areaKey] = setTimeout(async () => {
      const res = await saveAreaAction(reviewId, areaKey, next);
      setSaved(res.ok ? "saved" : "error");
    }, 300);
  };

  const saveDetail = (areaKey: string, patch: Partial<Pick<AreaAnswer, "moments" | "note">>) => {
    const next: AreaAnswer = { ...structuredClone(latest.current[areaKey]), ...patch };
    latest.current = { ...latest.current, [areaKey]: next };
    setAnswers(latest.current);
    clearTimeout(timers.current[areaKey]);
    setSaved("saving");
    timers.current[areaKey] = setTimeout(async () => {
      const res = await saveAreaAction(reviewId, areaKey, next);
      setSaved(res.ok ? "saved" : "error");
    }, 600);
  };

  const create = () => {
    setError(null);
    startWriting(async () => {
      await saveHighlightAction(reviewId, highlight);
      for (const d of noteDefs) await saveNoteAction(reviewId, d.key, notes[d.key] ?? "");
      const res = await createReportAction(reviewId);
      if (res.ok) router.push(`/child/${reviewId}/report`);
      else setError(res.error);
    });
  };

  return (
    <div className="qwrap">
      {writing && <WritingOverlay name={childName} />}
      <div className="chapbar">
        <nav className="steps" aria-label="Chapters">
          {rubric.areas.map((a, i) => {
            const n = a.skills.filter((s) => answers[a.key]?.skills[s.key]?.touched).length;
            return (
              <button key={a.key} className="step" data-done={n === a.skills.length} aria-current={i === current ? "step" : undefined} onClick={() => jump(`ch-${a.key}`)}>
                <span className="step-dot">{n === a.skills.length ? "✓" : `${n}/${a.skills.length}`}</span>
                <span className="step-name">{a.shortName}</span>
              </button>
            );
          })}
          <button className="step" data-done={!!hasReport} aria-current={current === rubric.areas.length ? "step" : undefined} onClick={() => jump("ch-finish")}>
            <span className="step-dot">{hasReport ? "✓" : "★"}</span>
            <span className="step-name">Finish</span>
          </button>
        </nav>
        <div className="chapmeter" aria-hidden>
          <span style={{ width: `${(100 * answered) / Math.max(1, total)}%` }} />
        </div>
        <p className="save-line" aria-live="polite">
          {answered} of {total} answered
          {saved === "saving" ? " · saving…" : saved === "saved" ? " · saved ✓" : saved === "error" ? " · could not save" : " · saves as you tap"}
        </p>
      </div>

      <p className="muted small" style={{ margin: "4px 4px 16px" }}>
        How true is each sentence for {childName} right now? 1 = still learning, 5 = really shines. Just scroll down: each chapter is a learning area.
      </p>

      {rubric.areas.map((area, i) => {
        const n = area.skills.filter((s) => answers[area.key]?.skills[s.key]?.touched).length;
        return (
          <section key={area.key} id={`ch-${area.key}`} className="qcard chapter">
            <header className="chapter-head">
              <span className="chapter-no">{i + 1}</span>
              <div>
                <h2>{area.name}</h2>
                <p className="tiny muted">{n === area.skills.length ? "All answered ✓" : `${n} of ${area.skills.length} answered`}</p>
              </div>
            </header>
            {area.skills.map((s) => {
              const a = answers[area.key].skills[s.key];
              return (
                <div key={s.key} className="scale-row" role="radiogroup" aria-label={s.name}>
                  <p className="scale-q">
                    {childName} {s.statement ?? s.name.toLowerCase()}.
                  </p>
                  <div className="scale">
                    <span className="scale-end">Still learning</span>
                    {([1, 2, 3, 4, 5] as Level[]).map((n) => (
                      <button key={n} role="radio" aria-checked={!!a.touched && a.level === n} aria-label={`${n} of 5`} className="scale-dot" onClick={() => pick(area.key, s.key, n)}>
                        {n}
                      </button>
                    ))}
                    <span className="scale-end">Really shines</span>
                    <button role="radio" aria-checked={!!a.touched && a.level === 0} className="scale-skip" onClick={() => pick(area.key, s.key, 0)}>
                      Not seen yet
                    </button>
                  </div>
                </div>
              );
            })}
            {area.moments.length > 0 && (
              <div className="scale-row">
                <p className="scale-q">
                  Where did you see this? <span className="muted tiny">(tick up to 5)</span>
                </p>
                <div className="row" style={{ gap: 8 }}>
                  {area.moments.map((m) => {
                    const on = answers[area.key].moments.includes(m);
                    const full = answers[area.key].moments.length >= 5;
                    return (
                      <button
                        key={m}
                        type="button"
                        className="q-tab"
                        aria-pressed={on}
                        disabled={!on && full}
                        style={on ? { background: "var(--sky)", borderColor: "var(--sky-mid)" } : undefined}
                        onClick={() => saveDetail(area.key, { moments: on ? answers[area.key].moments.filter((x) => x !== m) : [...answers[area.key].moments, m] })}
                      >
                        {on ? "✓ " : ""}
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label className="field" style={{ marginTop: 14 }}>
              <span>
                Tell us about a moment in {area.shortName} <span className="muted" style={{ fontWeight: 400 }}>(optional, but it makes the report much richer)</span>
              </span>
              <textarea
                className="input"
                rows={3}
                maxLength={400}
                value={answers[area.key].note}
                placeholder={`e.g. What did ${childName} do or say? Where? Who with?`}
                onChange={(e) => saveDetail(area.key, { note: e.target.value })}
              />
            </label>
          </section>
        );
      })}

      <section id="ch-finish" className="qcard chapter">
        <header className="chapter-head">
          <span className="chapter-no">★</span>
          <div>
            <h2>{allDone ? `Ready to write ${childName}’s report` : "Finish"}</h2>
            <p className="tiny muted">{allDone ? "Everything is answered." : `${total - answered} ${total - answered === 1 ? "answer" : "answers"} to go`}</p>
          </div>
        </header>
        {!allDone && (
          <p className="note" style={{ margin: "12px 0" }}>
            Still to answer:{" "}
            {rubric.areas.map((a, i) =>
              areaDone(i) ? null : (
                <button key={a.key} className="btn-link" onClick={() => jump(`ch-${a.key}`)} style={{ marginRight: 10 }}>
                  {a.shortName}
                </button>
              ),
            )}
          </p>
        )}
        {noteDefs.map((d) => (
          <label key={d.key} className="field" style={{ marginTop: 12 }}>
            <span>
              {d.label.replace("{name}", childName)} <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
            </span>
            <textarea
              className="input"
              rows={3}
              maxLength={d.max}
              value={notes[d.key] ?? ""}
              placeholder={d.hint.replaceAll("{name}", childName)}
              onChange={(e) => setNotes({ ...notes, [d.key]: e.target.value })}
              onBlur={() => saveNoteAction(reviewId, d.key, notes[d.key] ?? "")}
            />
          </label>
        ))}
        <label className="field" style={{ marginTop: 12 }}>
          <span>
            A special moment {childName} had this term <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
          </span>
          <textarea
            className="input"
            rows={3}
            maxLength={600}
            value={highlight}
            placeholder="e.g. Loved building a boat for the toy animals"
            onChange={(e) => setHighlight(e.target.value)}
            onBlur={() => saveHighlightAction(reviewId, highlight)}
          />
          <p className="privacy-hint">Names and phone numbers are removed before anything goes to the AI writer.</p>
        </label>
        {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
        <div className="qnav" style={{ justifyContent: "flex-end" }}>
          {hasReport && !writing && (
            <Link className="btn" href={`/child/${reviewId}/report`}>
              Open existing report
            </Link>
          )}
          <button className="btn btn-primary" disabled={!allDone || writing} onClick={create}>
            {writing ? "Writing… (up to a minute)" : hasReport ? "Write the report again" : `Create ${childName}’s report`}
          </button>
        </div>
      </section>
    </div>
  );
}
