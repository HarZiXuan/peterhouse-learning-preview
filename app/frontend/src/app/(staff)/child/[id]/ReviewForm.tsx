"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AreaAnswer, Level, ReviewPhoto, ReviewView } from "@peterhouse/shared";
import { COVER_PHOTO_KEY, LOVE_MAX, NOTE_MAX, SCALE, areaProgress, fillTemplate } from "@peterhouse/shared";
import { Icon } from "@/components/icons";
import { timeAgo } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createReportAction, deletePhotoAction, saveAreaAction, saveChineseNameAction } from "../../actions";


const WRITING_STEPS = [
  "Reading the ratings…",
  "Hiding names so only anonymous answers are sent…",
  "Writing the opening…",
  "Writing each learning area…",
  "Writing the closing…",
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
    <Dialog open>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-sm" aria-live="polite">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <Loader2 className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
            Writing {name}’s report
          </DialogTitle>
          <DialogDescription key={step} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
            {WRITING_STEPS[step]}
          </DialogDescription>
        </DialogHeader>
        <Progress value={((step + 1) / WRITING_STEPS.length) * 100} className="sweep" />
        <p className="text-xs text-muted-foreground">This can take up to a minute. Please keep this page open.</p>
      </DialogContent>
    </Dialog>
  );
}

function ChineseName({ reviewId, initial }: { reviewId: number; initial: string }) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  if (!editing) {
    return value ? (
      <button type="button" className="ml-2 align-middle text-xl font-normal text-muted-foreground hover:text-foreground" style={{ fontFamily: "var(--font-han)" }} onClick={() => setEditing(true)} title="Change the Chinese name">
        {value}
      </button>
    ) : (
      <Button type="button" variant="ghost" size="sm" className="ml-2 align-middle text-muted-foreground" onClick={() => setEditing(true)}>
        Add Chinese name
      </Button>
    );
  }
  const save = () => {
    setEditing(false);
    if (value.trim() === initial.trim()) return;
    start(async () => {
      const res = await saveChineseNameAction(reviewId, value.trim());
      if (res.ok) toast.success(value.trim() ? "Chinese name saved." : "Chinese name removed.");
      else {
        setValue(initial);
        toast.error(res.error);
      }
    });
  };
  return (
    <span className="ml-2 inline-flex items-center gap-2 align-middle">
      <Input
        autoFocus
        aria-label="Chinese name"
        lang="zh"
        maxLength={40}
        value={value}
        className="h-8 w-36"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button type="button" size="sm" variant="outline" onClick={save}>
        Save
      </Button>
    </span>
  );
}

export function ReviewForm({ view }: { view: ReviewView }) {
  const router = useRouter();
  const { reviewId, childName, rubric, pronoun } = view;
  // A submitted, approved or taken-over report cannot be changed here; say why instead (at most every few seconds).
  const locked = view.workflow.locked;
  // A subject teacher rates the children and adds photos; the class's teachers write the report.
  const mine = view.subjectOnly;
  const nudged = useRef(false);
  const blocked = (areaKey?: string) => {
    const why = locked ?? (mine && !areaKey ? "You rate this class’s children. Its class teachers write the report." : null);
    if (!why) return false;
    if (!nudged.current) {
      toast.info(why);
      nudged.current = true;
      setTimeout(() => (nudged.current = false), 4000);
    }
    return true;
  };
  const latest = useRef(view.answers);
  const [answers, setAnswers] = useState(view.answers);
  const [area, setArea] = useState(() => {
    // Start on the first domain with something left to rate.
    const i = rubric.areas.findIndex((a) => areaProgress(a, view.answers[a.key]).todo > 0);
    return i < 0 ? 0 : i;
  });
  const [photos, setPhotos] = useState<ReviewPhoto[]>(view.photos);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ s: "idle" | "saving" | "saved" | "error"; at: string }>({ s: "idle", at: view.updatedAt });
  const [error, setError] = useState<string | null>(null);
  const [writing, startWriting] = useTransition();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, () => Promise<void>>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadKey = useRef<string>(COVER_PHOTO_KEY);
  const top = useRef<HTMLDivElement>(null);

  const fill = (t: string) => fillTemplate(t, childName, pronoun);
  const progress = rubric.areas.map((a) => areaProgress(a, answers[a.key]));
  const total = progress.reduce((n, p) => n + p.total, 0);
  const answered = progress.reduce((n, p) => n + p.rated + p.notSeen, 0);
  const ready = answered === total;
  const current = rubric.areas[area];
  const ans = answers[current.key];

  const queueSave = (areaKey: string, next: AreaAnswer, delay: number) => {
    if (blocked(areaKey)) return;
    latest.current = { ...latest.current, [areaKey]: next };
    setAnswers(latest.current);
    clearTimeout(timers.current[areaKey]);
    setSaved((x) => ({ ...x, s: "saving" }));
    const run = async () => {
      delete pending.current[areaKey];
      const res = await saveAreaAction(reviewId, areaKey, latest.current[areaKey]);
      setSaved(res.ok ? { s: "saved", at: res.savedAt } : { s: "error", at: new Date().toISOString() });
      if (!res.ok && "error" in res) setError(res.error);
    };
    pending.current[areaKey] = run;
    timers.current[areaKey] = setTimeout(run, delay);
  };

  const flush = async () => {
    for (const [k, run] of Object.entries(pending.current)) {
      clearTimeout(timers.current[k]);
      await run();
    }
  };

  // Save anything still waiting when the teacher leaves the page.
  useEffect(() => {
    const t = timers.current;
    const p = pending.current;
    return () => {
      for (const [k, run] of Object.entries(p)) {
        clearTimeout(t[k]);
        void run();
      }
    };
  }, []);

  const rate = (skillKey: string, level: Level) => {
    const next: AreaAnswer = structuredClone(latest.current[current.key]);
    const was = next.skills[skillKey];
    // Tapping the chosen answer again clears it.
    next.skills[skillKey] = was?.touched && was.level === level ? { level: 0, touched: false } : { level, touched: true };
    queueSave(current.key, next, 300);
  };

  const patch = (p: Partial<AreaAnswer>, delay = 700) => queueSave(current.key, { ...structuredClone(latest.current[current.key]), ...p }, delay);

  const goTo = (i: number) => {
    setArea(i);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const write = () => {
    setError(null);
    startWriting(async () => {
      await flush();
      const res = await createReportAction(reviewId);
      if (res.ok) {
        toast.success(res.fellBack ? "Report written with the built-in writer. Read it through and change anything that needs it." : "Report written. Read it through and change anything that needs it.");
        router.push(`/child/${reviewId}/report`);
      } else setError(res.error);
    });
  };

  /** One photo for each learning page and one for the cover: a new photo takes the place of the old one. */
  async function upload(files: FileList | null, key: string) {
    if (!files?.length || blocked(key)) return;
    setUploading(key);
    setError(null);
    let added = 0;
    for (const f of Array.from(files).slice(0, 1)) {
      // The backend takes the image bytes directly as the request body.
      const res = await fetch(`/api/reviews/${reviewId}/photos?area=${encodeURIComponent(key)}`, {
        method: "POST",
        body: f,
        headers: { "content-type": f.type || "image/jpeg" },
      });
      const json = (await res.json().catch(() => ({}))) as { photos?: ReviewPhoto[]; error?: string };
      if (!res.ok || !json.photos) {
        setError(json.error ?? "Could not upload that photo.");
        break;
      }
      setPhotos(json.photos);
      added++;
    }
    if (added) toast.success(`Photo saved for ${key === COVER_PHOTO_KEY ? "the cover" : current.shortName}.`);
    setUploading(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removePhoto(photoId: number) {
    if (blocked(photos.find((p) => p.id === photoId)?.areaKey ?? undefined)) return;
    const res = await deletePhotoAction(reviewId, photoId);
    setPhotos(res.photos);
    if (res.ok) toast.success("Photo removed.");
    else toast.error(res.error);
  }

  const pickFor = (key: string) => {
    if (blocked(key)) return;
    uploadKey.current = key;
    fileInput.current?.click();
  };
  const areaPhotos = photos.filter((p) => p.areaKey === current.key);
  const coverPhoto = photos.find((p) => p.areaKey === COVER_PHOTO_KEY);
  const olderPhotos = photos.filter((p) => !p.areaKey || (p.areaKey !== COVER_PHOTO_KEY && !rubric.areas.some((a) => a.key === p.areaKey)));
  const note = ans.note ?? "";
  const isLast = area === rubric.areas.length - 1;
  const firstGap = rubric.areas.findIndex((_, i) => progress[i].todo > 0);
  const savedLine = saved.s === "saving" ? "Saving…" : saved.s === "error" ? "Could not save. Check your connection." : `Saved ${timeAgo(saved.at)}`;

  return (
    <div ref={top} style={{ scrollMarginTop: 16 }}>
      {writing && <WritingOverlay name={childName} />}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
            <span className={cn("inline-flex items-center gap-1", saved.s === "error" && "text-destructive")}>
              {saved.s !== "error" && <Icon name="check" size={14} stroke={2.2} />}
              {savedLine}
            </span>
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
            {childName} <ChineseName reviewId={reviewId} initial={view.chineseName} />
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {view.hasReport && (
            <Button asChild variant="outline">
              <Link href={`/child/${reviewId}/report`}>
                <Icon name="reports" size={16} /> Open report
              </Link>
            </Button>
          )}
          <Button type="button" disabled={!ready || writing || !!locked || !!mine} onClick={write} title={ready ? undefined : "Rate every statement, or mark it Not seen yet, first"}>
            <Icon name="write" size={16} /> {view.hasReport ? "Write again" : "Write report"}
          </Button>
        </div>
      </header>
      {mine && !locked && (
        <Alert className="mb-4">
          <AlertDescription>
            You teach a subject in this class, so you can rate its children and add photos. The class teachers write the report.
          </AlertDescription>
        </Alert>
      )}
      {locked && (
        <Alert className="mb-4 border-warn/60 bg-warn/10">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-foreground">
            <span>
              <Icon name="lock" size={15} /> {locked}
            </span>
            {view.hasReport && (
              <Link href={`/child/${reviewId}/report`} className="font-semibold underline underline-offset-4">
                Open the report
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div role="tablist" aria-label="Learning areas" className="mb-5 flex gap-1 overflow-x-auto border-b">
        {rubric.areas.map((a, i) => {
          const p = progress[i];
          const done = p.todo === 0;
          return (
            <button
              key={a.key}
              type="button"
              role="tab"
              aria-selected={i === area}
              onClick={() => goTo(i)}
              className="-mb-px flex min-w-28 flex-col items-start gap-0.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-left text-muted-foreground transition-colors hover:text-foreground aria-selected:border-primary aria-selected:text-foreground"
            >
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <Icon name={a.icon ?? a.key} size={16} />
                {a.shortName}
              </span>
              <span className="text-xs">{done ? `All ${p.total} done` : `${p.total - p.todo} of ${p.total}`}</span>
            </button>
          );
        })}
      </div>

      <div className="form-cols">
        <section className={cn("area-card", locked && "[&_.ladder]:opacity-60 [&_textarea]:opacity-60")} aria-labelledby="area-title" role="tabpanel">
          <div className="mb-2 flex items-start gap-3">
            <span className="mt-1 text-primary">
              <Icon name={current.icon ?? current.key} size={24} />
            </span>
            <div>
              <h2 id="area-title" className="text-2xl font-bold">
                {current.name} {current.subName && <span className="han">{current.subName}</span>}
              </h2>
              <p className="text-sm text-muted-foreground">Tap the box that fits best. 1 is still learning, 5 really shines.</p>
            </div>
          </div>

          {current.skills.map((s) => {
            const a = ans.skills[s.key];
            const touched = !!a?.touched;
            const ns = touched && a.level === 0;
            const level = touched ? a.level : 0;
            const id = `q-${s.key}`;
            const meaning = ns
              ? `Not seen yet. The report will say the team is still getting to know ${childName} here.`
              : level > 0
                ? `${SCALE[level - 1].label}: ${SCALE[level - 1].meaning.toLowerCase()}.`
                : "Not rated yet";
            return (
              <div key={s.key} className="qrow">
                <div className="qrow-top">
                  <p id={id} className="qtext">
                    {fill(s.text)}
                  </p>
                  <Button type="button" variant={ns ? "secondary" : "ghost"} size="sm" aria-pressed={ns} className="shrink-0 text-muted-foreground" onClick={() => rate(s.key, 0)}>
                    <Icon name="notSeen" size={15} /> Not seen yet
                  </Button>
                </div>
                <div className={cn("grid grid-cols-5 overflow-hidden rounded-lg border bg-card transition-opacity", ns && "opacity-45")} role="radiogroup" aria-labelledby={id}>
                  {SCALE.map((o) => {
                    const chosen = level === o.score;
                    const within = level > 0 && o.score < level;
                    return (
                      <button
                        key={o.score}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        aria-label={`${o.label}: ${o.meaning}`}
                        title={o.meaning}
                        onClick={() => rate(s.key, o.score as Level)}
                        className={cn(
                          "flex min-h-16 flex-col items-center justify-center gap-0.5 border-l px-1 py-2 text-center outline-none transition-colors first:border-l-0 focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-[4.5rem]",
                          chosen ? "border-primary bg-primary text-primary-foreground" : within ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-accent",
                        )}
                      >
                        <span className="font-heading text-xl font-semibold leading-none">{o.score}</span>
                        <span className={cn("text-[11px] leading-tight sm:text-xs", chosen ? "font-semibold" : "text-muted-foreground")}>{o.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className={cn("mt-2 text-sm", level === 0 && !ns && "text-muted-foreground", ns && "text-warn-foreground")} data-s={ns ? "ns" : level > 0 ? "set" : "empty"}>
                  {meaning}
                </p>
              </div>
            );
          })}

          {current.love && (
            <div className="qrow">
              <label htmlFor="love" className="qlabel">
                {fill(current.love.text)}
              </label>
              <Textarea
                id="love"
                rows={2}
                maxLength={LOVE_MAX}
                value={ans.love ?? ""}
                placeholder="One or two sentences, e.g. Building tall towers with the big blocks."
                onChange={(e) => patch({ love: e.target.value })}
              />
            </div>
          )}

          <div className="extras">
            <div className="extras-note">
              <div className="spread">
                <label htmlFor="note">
                  A moment you noticed <span className="small muted" style={{ fontWeight: 400 }}>optional</span>
                </label>
                <span className="tiny muted">
                  {[...note].length} / {NOTE_MAX}
                </span>
              </div>
              <Textarea
                id="note"
                rows={2}
                maxLength={NOTE_MAX}
                value={note}
                placeholder="e.g. Counted 12 shells at the beach table."
                onChange={(e) => patch({ note: e.target.value.slice(0, NOTE_MAX) })}
              />
              <p className="hint">
                <Icon name="lock" size={14} stroke={2} />
                Please don’t include names or health details.
              </p>
            </div>
            <div className="photos">
              <span style={{ fontWeight: 600, fontSize: 15 }}>
                Photo{" "}
                <span className="small muted" style={{ fontWeight: 400 }}>
                  one for this page of the report
                </span>
              </span>
              <div className="photos-row">
                {areaPhotos.map((p, i) => (
                  <div key={p.id} className="ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${p.id}`} alt={`${current.shortName} photo ${i + 1}`} />
                    <button type="button" aria-label={`Remove ${current.shortName} photo ${i + 1}`} onClick={() => removePhoto(p.id)}>
                      ×
                    </button>
                  </div>
                ))}
                {Array.from({ length: Math.max(0, view.photosPerArea - areaPhotos.length) }).map((_, i) => (
                  <button key={i} type="button" className="ph-add" aria-label={`Add a ${current.shortName} photo`} disabled={uploading !== null} onClick={() => pickFor(current.key)}>
                    <Icon name={uploading === current.key && i === 0 ? "photo" : "plus"} size={22} />
                  </button>
                ))}
              </div>
              {areaPhotos.length >= view.photosPerArea && (
                <button type="button" className="small" style={{ alignSelf: "flex-start", textDecoration: "underline", background: "none", border: 0, padding: 0 }} disabled={uploading !== null} onClick={() => pickFor(current.key)}>
                  Choose a different photo
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files, uploadKey.current)} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-5">
            <Button type="button" variant="outline" onClick={() => goTo(area - 1)} disabled={area === 0}>
              <Icon name="left" size={16} stroke={2} />
              {area === 0 ? "Previous" : rubric.areas[area - 1].shortName}
            </Button>
            {isLast ? (
              ready ? (
                <Button type="button" onClick={write} disabled={writing || !!locked || !!mine}>
                  <Icon name="write" size={16} /> {view.hasReport ? "Write again" : "Write report"}
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={() => goTo(firstGap)}>
                  Still to rate: {rubric.areas[firstGap].shortName}
                  <Icon name="right" size={16} stroke={2} />
                </Button>
              )
            ) : (
              <Button type="button" onClick={() => goTo(area + 1)}>
                Next: {rubric.areas[area + 1].shortName}
                <Icon name="right" size={16} stroke={2} />
              </Button>
            )}
          </div>
        </section>

        <aside className="glance">
          <div className="glance-card">
            <div className="spread" style={{ alignItems: "baseline" }}>
              <h2>At a glance</h2>
              <span className="small muted">
                {answered} / {total}
              </span>
            </div>
            <Progress value={(100 * answered) / Math.max(1, total)} aria-hidden className="mt-2" />
            <ul className="glance-list">
              {rubric.areas.map((a, i) => (
                <li key={a.key}>
                  <button type="button" aria-current={i === area} onClick={() => goTo(i)}>
                    <Icon name={a.icon ?? a.key} size={18} />
                    <span>{a.name}</span>
                    <span className="dots" role="img" aria-label={`${progress[i].rated} rated, ${progress[i].notSeen} not seen, ${progress[i].todo} to do`}>
                      {a.skills.map((s) => {
                        const x = answers[a.key]?.skills[s.key];
                        return <i key={s.key} className={`gd ${x?.touched ? (x.level > 0 ? "set" : "ns") : ""}`} />;
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="glance-key">
              <span>
                <i className="gd set" />
                Rated
              </span>
              <span>
                <i className="gd ns" />
                Not seen
              </span>
              <span>
                <i className="gd" />
                To do
              </span>
            </div>
          </div>
          <div className="glance-card">
            <h2>Cover photo</h2>
            <p className="small muted" style={{ margin: "4px 0 10px" }}>
              The big photo inside the rainbow on the front of the report.
            </p>
            <div className="photos-row">
              {coverPhoto ? (
                <div className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photos/${coverPhoto.id}`} alt={`${childName} cover photo`} />
                  <button type="button" aria-label="Remove the cover photo" onClick={() => removePhoto(coverPhoto.id)}>
                    ×
                  </button>
                </div>
              ) : (
                <button type="button" className="ph-add" aria-label="Add a cover photo" disabled={uploading !== null} onClick={() => pickFor(COVER_PHOTO_KEY)}>
                  <Icon name={uploading === COVER_PHOTO_KEY ? "photo" : "plus"} size={22} />
                </button>
              )}
            </div>
            {coverPhoto && (
              <button type="button" className="small" style={{ marginTop: 8, textDecoration: "underline", background: "none", border: 0, padding: 0 }} disabled={uploading !== null} onClick={() => pickFor(COVER_PHOTO_KEY)}>
                Choose a different photo
              </button>
            )}
          </div>
          <div className="tip">
            <Icon name="info" size={18} />
            <p>Families never see the numbers. The report turns them into marks and warm, plain words.</p>
          </div>
          {olderPhotos.length > 0 && (
            <div className="glance-card">
              <h2>Earlier photos</h2>
              <p className="small muted" style={{ margin: "4px 0 10px" }}>
                Added before photos belonged to a learning area. They still appear in the report.
              </p>
              <div className="photos-row" style={{ flexWrap: "wrap" }}>
                {olderPhotos.map((p, i) => (
                  <div key={p.id} className="ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${p.id}`} alt={`Earlier photo ${i + 1}`} />
                    <button type="button" aria-label={`Remove earlier photo ${i + 1}`} onClick={() => removePhoto(p.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
