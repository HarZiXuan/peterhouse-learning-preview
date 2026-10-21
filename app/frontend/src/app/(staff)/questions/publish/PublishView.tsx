"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { QuestionBankView, QuestionChange } from "@peterhouse/shared";
import { SCALE, fillTemplate } from "@peterhouse/shared";
import { Icon, type IconName } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publishQuestionsAction } from "../../actions";
import { Template } from "../QuestionsEditor";

const KIND: Record<QuestionChange["kind"], { label: string; icon: IconName; pill: string }> = {
  added: { label: "Added", icon: "plus", pill: "border-success/40 bg-success/10 text-success" },
  restored: { label: "Restored", icon: "restore", pill: "border-success/40 bg-success/10 text-success" },
  reworded: { label: "Reworded", icon: "edit", pill: "border-warn/50 bg-warn/15 text-foreground" },
  retired: { label: "Retired", icon: "box", pill: "" },
  reordered: { label: "Reordered", icon: "up", pill: "" },
  prompt: { label: "Reworded", icon: "edit", pill: "border-warn/50 bg-warn/15 text-foreground" },
  home: { label: "Home ideas", icon: "edit", pill: "border-warn/50 bg-warn/15 text-foreground" },
};

const SAMPLE = { name: "Mia", pronoun: "she" as const };

export function PublishView({ bank }: { bank: QuestionBankView }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const firstChanged = bank.preview.areas.findIndex((a) => bank.changes.some((c) => c.areaKey === a.key));
  const [area, setArea] = useState(firstChanged < 0 ? 0 : firstChanged);
  const next = bank.live.version + 1;
  const blocked = bank.problems.length > 0 || bank.changes.length === 0;
  const a = bank.preview.areas[area];

  const publish = () =>
    start(async () => {
      setError(null);
      const res = await publishQuestionsAction();
      if (res.ok) {
        toast.success(`Version ${res.version} published. New reviews use it from now on.`);
        router.push(`/questions?published=${res.version}`);
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });

  return (
    <>
      <p className="crumbs">
        <Link href="/questions">← Review questions</Link>
      </p>
      <header className="qa-head">
        <div>
          <h1>{bank.changes.length ? `Publish questions v${next}?` : "Preview the form"}</h1>
          <p className="lede">{bank.changes.length ? "Check how teachers will see it, then publish." : `Nothing has changed since v${bank.live.version}. This is the form teachers see now.`}</p>
        </div>
      </header>

      <div className="pub-grid">
        <section>
          <div className="spread" style={{ marginBottom: 10 }}>
            <h2 style={{ fontSize: 19 }}>
              {bank.changes.length} change{bank.changes.length === 1 ? "" : "s"}
            </h2>
          </div>
          {bank.changes.length > 0 ? (
            <ul className="changes">
              {bank.changes.map((c, i) => {
                const k = KIND[c.kind];
                return (
                  <li key={i}>
                    <Badge variant="outline" className={`h-fit shrink-0 gap-1 font-normal ${k.pill}`}>
                      <Icon name={k.icon} size={13} /> {k.label}
                    </Badge>
                    <div style={{ minWidth: 0 }}>
                      <p>
                        {c.key && <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">{c.key}</code>} <span className="muted small">{c.areaName}</span>
                      </p>
                      <p style={{ marginTop: 4 }}>
                        {c.kind === "reordered" || c.kind === "home" ? c.text : <>“<Template text={c.text} />”</>}
                      </p>
                      <p className="effect">{c.effect}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No changes to publish.</p>
          )}

          <div className="facts">
            <div className="fact">
              <b>{bank.openReviews}</b>
              <span>open review{bank.openReviews === 1 ? "" : "s"} keep the wording they started with</span>
            </div>
            <div className="fact">
              <b>v{bank.changes.length ? next : bank.live.version}</b>
              <span>used by every review opened from now</span>
            </div>
          </div>

          {bank.problems.length > 0 && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>
                <b>Fix these first:</b>
                <ul className="ml-4 mt-1 list-disc">
                  {bank.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert" style={{ marginBottom: 12 }}>
              {error}
            </p>
          )}
          <p className="small muted" style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14 }}>
            <Icon name="check" size={15} stroke={2} /> Publishing is saved to the activity log.
          </p>
          <div className="row">
            <Button asChild variant="outline">
              <Link href="/questions">Keep editing</Link>
            </Button>
            <Button type="button" disabled={blocked || busy} onClick={publish}>
              <Icon name="publish" size={18} /> {busy ? "Publishing…" : `Publish v${next}`}
            </Button>
          </div>
        </section>

        <section className="area-card preview" aria-label="Teacher preview">
          <p className="kicker">Teacher preview · for a child called {SAMPLE.name}</p>
          <div role="tablist" aria-label="Domains" className="dtabs" style={{ marginTop: 12, marginBottom: 8 }}>
            {bank.preview.areas.map((d, i) => (
              <button key={d.key} className="dtab" type="button" role="tab" aria-selected={i === area} onClick={() => setArea(i)} style={{ minHeight: 48, flexBasis: 110 }}>
                <span className="ic">
                  <Icon name={d.icon ?? d.key} size={17} />
                </span>
                <b>{d.shortName}</b>
                <small>{d.skills.length} questions</small>
              </button>
            ))}
          </div>
          <div className="area-head" style={{ marginTop: 8 }}>
            <span className="area-icon">
              <Icon name={a.icon ?? a.key} size={22} />
            </span>
            <div>
              <h2>
                {a.name} {a.subName && <span className="han">{a.subName}</span>}
              </h2>
              <p>Tap the bar that fits best. Taller means more confident.</p>
            </div>
          </div>
          {a.skills.map((s) => (
            <div key={s.key} className="qrow">
              <div className="qrow-top">
                <p className="qtext">{fillTemplate(s.text, SAMPLE.name, SAMPLE.pronoun)}</p>
                <span className="nsbtn" aria-hidden>
                  <Icon name="notSeen" size={16} /> Not seen yet
                </span>
              </div>
              <div className="grid grid-cols-5 overflow-hidden rounded-lg border bg-card" aria-hidden>
                {SCALE.map((o) => (
                  <span key={o.score} className="flex min-h-14 flex-col items-center justify-center gap-0.5 border-l px-1 py-2 text-center first:border-l-0">
                    <span className="font-heading text-lg font-semibold leading-none">{o.score}</span>
                    <span className="text-[11px] leading-tight text-muted-foreground">{o.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {a.love && (
            <div className="qrow">
              <p className="qlabel">{fillTemplate(a.love.text, SAMPLE.name, SAMPLE.pronoun)}</p>
              <div className="ta" style={{ color: "var(--muted)" }}>
                One or two sentences…
              </div>
            </div>
          )}
          {a.homeIdeas && (
            <div className="qrow" style={{ borderBottom: 0 }}>
              <p className="qlabel">Ideas to try at home</p>
              <div className="homepicks">
                {a.homeIdeas.map((h) => (
                  <span key={h} className="homepick">
                    <i />
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
