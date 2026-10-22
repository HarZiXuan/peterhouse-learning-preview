"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DraftDomain, DraftQuestion, QuestionBankView } from "@peterhouse/shared";
import { CLASS_LEVELS, QUESTIONS_MAX, QUESTIONS_MIN, type ClassLevel } from "@peterhouse/shared";
import { Icon } from "@/components/icons";
import { timeAgo } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TAB, TAB_NAV } from "@/components/ui/tab-styles";
import {
  addQuestionAction,
  discardQuestionsAction,
  moveQuestionAction,
  restoreQuestionAction,
  retireQuestionAction,
  rewordQuestionAction,
  updateDomainAction,
} from "../actions";

/** Shows {name} and {he/she} as tokens, so the admin sees exactly what is filled in. */
export function Template({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\})/g).map((part, i) =>
        /^\{[^}]+\}$/.test(part) ? (
          <span key={i} className="tok">
            {part.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function useAct() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** `ok` is the message shown when it worked; a failure shows the server's reason, as a message and beside the control. */
  const act = (fn: () => Promise<{ ok: true; key?: string } | { ok: false; error: string }>, after?: (key?: string) => void, ok?: string) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        if (ok) toast.success(ok);
        after?.(res.key);
        router.refresh();
      }
    });
  return { busy, error, act, setError };
}

/** Each class level has its own questions: one tab per level, and a question is added to the level being viewed. */
export type QuestionSet = ClassLevel;
const LEVEL_TAB = (l: (typeof CLASS_LEVELS)[number]) => `${l.key} · age ${l.turns}`;

function QuestionRow({ q, first, last, published, onEdit, level }: { q: DraftQuestion; first: boolean; last: boolean; published: boolean; onEdit: () => void; level: ClassLevel }) {
  const { busy, error, act } = useAct();
  return (
    <div className="qa-q">
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          {q.change === "reworded" && (
            <Badge variant="outline" className="cursor-help font-normal border-warn/50 bg-warn/15 text-foreground" title="Same skill in new words, so the next report still compares it with last semester.">
              Reworded
            </Badge>
          )}
          {q.change === "added" && (
            <Badge variant="outline" className="cursor-help font-normal border-success/40 bg-success/10 text-success" title="Not published yet. The next report shows no comparison with last semester for it.">
              New
            </Badge>
          )}
        </div>
        <p className="qa-text">
          <Template text={q.text} />
        </p>
        {q.was && (
          <p className="qa-was">
            Was: “<Template text={q.was} />”
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="qa-tools">
        <Button variant="ghost" size="icon-sm" type="button" aria-label={`Move ${q.key} up`} disabled={first || busy} onClick={() => act(() => moveQuestionAction(q.key, "up", level), undefined, "Moved up. Teachers see it once you publish.")}>
          <Icon name="up" size={18} />
        </Button>
        <Button variant="ghost" size="icon-sm" type="button" aria-label={`Move ${q.key} down`} disabled={last || busy} onClick={() => act(() => moveQuestionAction(q.key, "down", level), undefined, "Moved down. Teachers see it once you publish.")}>
          <Icon name="down" size={18} />
        </Button>
        <Button variant="ghost" size="icon-sm" type="button" aria-label={`Change the wording of ${q.key}`} onClick={onEdit}>
          <Icon name="edit" size={18} />
        </Button>
        <Button variant="ghost" size="icon-sm"
          type="button"
         
          aria-label={published ? `Retire ${q.key}` : `Remove ${q.key}`}
          title={published ? "Retire: hidden from new reviews, kept in history" : "Remove this new question"}
          disabled={busy}
          onClick={() => act(() => retireQuestionAction(q.key), undefined, "Question retired. Past reports keep it; new reviews will not ask it. Teachers see it once you publish.")}
        >
          <Icon name="box" size={18} />
        </Button>
      </div>
    </div>
  );
}

function EditQuestion({ q, published, onDone }: { q: DraftQuestion; published: boolean; onDone: () => void }) {
  const [text, setText] = useState(q.text);
  const [same, setSame] = useState(true);
  const { busy, error, act } = useAct();
  return (
    <div className="qa-q" style={{ display: "block" }}>
      <div className="row" style={{ gap: 6 }}>
        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">{q.key}</code>
        <Badge variant="default" className="font-normal">Editing</Badge>
      </div>
      <div className="qa-edit">
        <label className="grid gap-1.5 text-sm font-medium">
          <span>Question wording</span>
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} autoFocus />
        </label>
        <p className="small muted">
          Type <span className="tok">{"{name}"}</span> for the child’s name and <span className="tok">{"{he/she}"}</span> for the pronoun (<span className="tok">{"{他/她}"}</span> in a Chinese question).
          {q.change !== "added" && (
            <>
              {" "}
              Live wording: “<Template text={q.was ?? q.text} />”
            </>
          )}
        </p>
        {published && text.trim() !== q.text && (
          <fieldset className="choice" style={{ border: 0 }}>
            <legend style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Is this still the same skill?</legend>
            <label>
              <input type="radio" name={`same-${q.key}`} checked={same} onChange={() => setSame(true)} />
              <span>
                <b>Same skill, new words</b>
                <small>Keeps {q.key}, so June and December scores still line up.</small>
              </span>
            </label>
            <label>
              <input type="radio" name={`same-${q.key}`} checked={!same} onChange={() => setSame(false)} />
              <span>
                <b>A different skill</b>
                <small>Counts as a new question. The next report shows no comparison for it, instead of a misleading one.</small>
              </span>
            </label>
          </fieldset>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="row">
          <Button size="sm" type="button" disabled={busy || !text.trim()} onClick={() => act(() => rewordQuestionAction(q.key, text, same), onDone, same ? "Wording changed. Teachers see it once you publish." : "Saved as a new question. Teachers see it once you publish.")}>
            Save change
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddQuestion({ domain, level }: { domain: DraftDomain; level: ClassLevel }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("{name} ");
  const { busy, error, act } = useAct();
  if (!open) {
    return (
      <Button variant="outline" size="sm" type="button" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} stroke={2} /> Add question
      </Button>
    );
  }
  return (
    <div className="qa-edit" style={{ marginTop: 14 }}>
      <label className="grid gap-1.5 text-sm font-medium">
        <span>
          New {domain.name} question for {level}
        </span>
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} autoFocus placeholder="{name} uses counting to solve small problems." />
      </label>
      <p className="small muted">One behaviour per sentence, so a teacher never scores two things in one tap. The next report shows no comparison with last semester for a new question.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="row">
        <Button size="sm"
          type="button"
         
          disabled={busy}
          onClick={() =>
            act(
              () => addQuestionAction(domain.key, text, [level]),
              () => {
                setOpen(false);
                setText("{name} ");
              },
              "Question added. Teachers see it once you publish.",
            )
          }
        >
          Add question
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Retired({ domain }: { domain: DraftDomain }) {
  const { busy, error, act } = useAct();
  if (!domain.retired.length) return null;
  return (
    <details className="retired">
      <summary>
        {domain.retired.length} retired question{domain.retired.length === 1 ? "" : "s"}, kept in history
      </summary>
      <ul>
        {domain.retired.map((q) => (
          <li key={q.key}>
            <span>
              <Template text={q.text} />
              {q.retiredAt && <small style={{ display: "block" }}>Retired {timeAgo(q.retiredAt)}</small>}
            </span>
            <Button variant="outline" size="sm" type="button" disabled={busy || domain.questions.length >= QUESTIONS_MAX} onClick={() => act(() => restoreQuestionAction(q.key), undefined, "Question brought back. Teachers see it once you publish.")}>
              Restore
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </details>
  );
}

function Enrichment({ domain }: { domain: DraftDomain }) {
  const [love, setLove] = useState(domain.love?.text ?? "");
  const [ideas, setIdeas] = useState<string[]>(domain.homeIdeas ?? []);
  const [fresh, setFresh] = useState("");
  const { busy, error, act } = useAct();
  const ideasDirty = JSON.stringify(ideas) !== JSON.stringify(domain.homeIdeas ?? []);
  return (
    <>
      {domain.love && (
        <Card className="mb-4 gap-3 p-5 shadow-none">
          <div className="row" style={{ gap: 6 }}>
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">{domain.love.key}</code>
            <Badge variant="outline" className="font-normal">Short text · 1 to 2 sentences</Badge>
            {domain.love.was && <Badge variant="outline" className="font-normal border-warn/50 bg-warn/15 text-foreground">Reworded</Badge>}
          </div>
          <label className="grid gap-1.5 text-sm font-medium" style={{ marginTop: 10 }}>
            <span>Short answer question</span>
            <Input value={love} onChange={(e) => setLove(e.target.value)} maxLength={200} />
          </label>
          {domain.love.was && (
            <p className="qa-was">
              Was: “<Template text={domain.love.was} />”
            </p>
          )}
          <Button variant="outline" size="sm" type="button" style={{ marginTop: 10 }} disabled={busy || love.trim() === domain.love.text} onClick={() => act(() => updateDomainAction(domain.key, { loveText: love }), undefined, "Question saved. Teachers see it once you publish.")}>
            Save wording
          </Button>
        </Card>
      )}
      {domain.homeIdeas && (
        <Card className="mb-4 gap-3 p-5 shadow-none">
          <div className="spread">
            <h2 style={{ fontSize: 18 }}>Ideas to try at home</h2>
            {domain.homeChanged && <Badge variant="outline" className="font-normal border-warn/50 bg-warn/15 text-foreground">Changed</Badge>}
          </div>
          <p className="small muted" style={{ margin: "4px 0 12px" }}>
            Teachers pick up to 2 for each child. Families see the ones picked.
          </p>
          <ul className="ideas">
            {ideas.map((h, i) => (
              <li key={i}>
                <Input value={h} maxLength={120} aria-label={`Home idea ${i + 1}`} onChange={(e) => setIdeas(ideas.map((x, j) => (j === i ? e.target.value : x)))} />
                <Button variant="ghost" size="icon-sm" type="button" aria-label={`Remove home idea ${i + 1}`} onClick={() => setIdeas(ideas.filter((_, j) => j !== i))}>
                  ×
                </Button>
              </li>
            ))}
            <li>
              <Input value={fresh} maxLength={120} placeholder="Add an idea, e.g. Bake together and count the spoons" aria-label="New home idea" onChange={(e) => setFresh(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter" && fresh.trim()) {
                  setIdeas([...ideas, fresh.trim()]);
                  setFresh("");
                }
              }} />
              <Button variant="ghost" size="icon-sm" type="button" aria-label="Add home idea" disabled={!fresh.trim()} onClick={() => {
                setIdeas([...ideas, fresh.trim()]);
                setFresh("");
              }}>
                <Icon name="plus" size={18} stroke={2} />
              </Button>
            </li>
          </ul>
          <Button variant="outline" size="sm" type="button" style={{ marginTop: 12 }} disabled={busy || !ideasDirty} onClick={() => act(() => updateDomainAction(domain.key, { homeIdeas: ideas }), undefined, "Home ideas saved. Teachers see it once you publish.")}>
            Save ideas
          </Button>
        </Card>
      )}
      {error && <p className="text-sm text-destructive" style={{ marginTop: 8 }}>{error}</p>}
    </>
  );
}

export function QuestionsEditor({ bank, areaKey, published, set = "PG" }: { bank: QuestionBankView; areaKey: string; published: number | null; set?: QuestionSet }) {
  const [editing, setEditing] = useState<string | null>(null);
  const discard = useAct();
  const domain = bank.domains.find((d) => d.key === areaKey) ?? bank.domains[0];
  const changes = bank.changes.length;
  const next = bank.live.version + 1;
  const changedAreas = new Set(bank.changes.map((c) => c.areaKey));
  // A question that is "added" in the draft has never been published, so rewording it needs no skill choice.
  const isPublished = (q: DraftQuestion) => q.change !== "added";
  const inSet = (q: DraftQuestion) => q.levels.includes(set);
  const shown = domain.questions.filter(inSet);

  return (
    <>
      <header className="qa-head">
        <div>
          <p className="eyebrow">
            {changes ? <Badge variant="outline" className="font-normal border-warn/50 bg-warn/15 text-foreground">Draft · {changes} change{changes === 1 ? "" : "s"}</Badge> : <Badge variant="outline" className="font-normal border-success/40 bg-success/10 text-success">No unpublished changes</Badge>}
            <span>
              Live version: v{bank.live.version}
              {bank.live.publishedAt ? `, published ${timeAgo(bank.live.publishedAt)}${bank.live.publishedBy ? ` by ${bank.live.publishedBy}` : ""}` : ""}
            </span>
          </p>
          <h1 style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}><Icon name="questions" size={30} />Review questions</h1>
        </div>
        <div className="row">
          {changes > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" disabled={discard.busy}>
                  Discard changes
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard every unpublished change?</AlertDialogTitle>
                  <AlertDialogDescription>This goes back to the live version. It cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep editing</AlertDialogCancel>
                  <AlertDialogAction onClick={() => discard.act(() => discardQuestionsAction(), undefined, "Changes discarded. The draft is back to the published questions.")}>Discard changes</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button asChild variant="outline">
            <Link href="/questions/publish">
              <Icon name="eye" size={16} /> Preview form
            </Link>
          </Button>
          <Button asChild disabled={!changes}>
            <Link href="/questions/publish" aria-disabled={!changes} onClick={(e) => !changes && e.preventDefault()}>
              <Icon name="publish" size={16} /> Publish v{next}
            </Link>
          </Button>
        </div>
      </header>

      {published && (
        <Alert className="mb-4">
          <AlertDescription>Version {published} is live. Reviews opened from now use it; reviews already open keep their wording.</AlertDescription>
        </Alert>
      )}
      <p className="mb-4 text-sm text-muted-foreground">
        Each class level has its own questions. Pick a level, then add or change the questions its teachers are asked. Reviews that are already open keep the wording they started with.
      </p>
      <nav className={TAB_NAV} aria-label="Class level">
        {CLASS_LEVELS.map((l) => (
          <Link key={l.key} href={`/reports?view=questions&area=${domain.key}&set=${l.key}`} scroll={false} aria-current={set === l.key ? "page" : undefined} className={TAB}>
            {LEVEL_TAB(l)}
          </Link>
        ))}
      </nav>
      {bank.problems.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <b>Before publishing:</b>
            <ul className="ml-4 mt-1 list-disc">
              {bank.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {discard.error && <p className="text-sm text-destructive">{discard.error}</p>}

      <div className="qa-grid">
        <nav aria-label="Domains">
          <ul className="qa-domains">
            {bank.domains.map((d) => (
              <li key={d.key}>
                <Link href={`/reports?view=questions&area=${d.key}&set=${set}`} aria-current={d.key === domain.key ? "page" : undefined} scroll={false}>
                  <span className="ic">
                    <Icon name={d.icon ?? d.key} size={17} />
                  </span>
                  <span>
                    {d.name} {d.subName && <span className="han">{d.subName}</span>}
                    {changedAreas.has(d.key) && <i className="flag" aria-label="has changes" />}
                  </span>
                  <small>
                    {d.questions.filter(inSet).length}
                    {d.love || d.homeIdeas ? ` + ${(d.love ? 1 : 0) + (d.homeIdeas ? 1 : 0)}` : ""}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{ minWidth: 0 }}>
          <Card className="mb-4 gap-3 p-5 shadow-none">
            <div className="spread">
              <div>
                <h2>
                  {domain.name} {domain.subName && <span className="han">{domain.subName}</span>}
                </h2>
                <p className="small muted">
                  {set} · <span className={shown.length < QUESTIONS_MIN || shown.length > QUESTIONS_MAX ? "font-semibold text-destructive" : undefined}>{shown.length} {shown.length === 1 ? "question" : "questions"}</span> (
                  {QUESTIONS_MIN} to {QUESTIONS_MAX})
                </p>
              </div>
              <AddQuestion key={`${domain.key}-${set}`} domain={domain} level={set} />
            </div>
            <div style={{ marginTop: 8 }}>
              {shown.map((q, i) =>
                editing === q.key ? (
                  <EditQuestion key={q.key} q={q} published={isPublished(q)} onDone={() => setEditing(null)} />
                ) : (
                  <QuestionRow key={q.key} q={q} first={i === 0} last={i === shown.length - 1} published={isPublished(q)} onEdit={() => setEditing(q.key)} level={set} />
                ),
              )}
              {shown.length === 0 && <p className="py-3 text-sm text-muted-foreground">No {domain.name} question for {set} yet. Add one with Add question.</p>}
            </div>
            <Retired domain={domain} />
          </Card>
          <Enrichment key={`enr-${domain.key}-${bank.live.version}-${domain.love?.text}-${(domain.homeIdeas ?? []).join("|")}`} domain={domain} />
        </div>
      </div>
    </>
  );
}
