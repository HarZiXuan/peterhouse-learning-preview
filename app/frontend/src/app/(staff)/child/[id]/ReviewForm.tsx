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
import { ChildPhoto } from "@/components/ChildPhoto";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createReportAction, deletePhotoAction, handBackAction, saveAreaAction, saveChineseNameAction } from "../../actions";


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

type AreaGroup = "mine" | "check" | "waiting";

/** `adminView`: an administrator following the teachers' progress; every area shows, read-only unless they took the report over. */
export function ReviewForm({ view, adminView = false }: { view: ReviewView; adminView?: boolean }) {
  const router = useRouter();
  const { reviewId, childName, rubric, pronoun } = view;
  // A submitted, approved or taken-over report cannot be changed here; say why instead (at most every few seconds).
  const locked = view.workflow.locked;
  // The report comes in parts: each teacher rates their own areas and sends their paragraph to the lead teacher, who
  // writes the whole report and sends it for review. The lead may change any area.
  const canWrite = view.canWriteReport;
  const lead = view.leadName ?? "the lead teacher";
  const partWhy = (areaKey: string) => {
    const part = view.parts[areaKey];
    if (!part) return null;
    const name = rubric.areas.find((a) => a.key === areaKey)?.name ?? "this area";
    if (!part.canEdit)
      return canWrite && part.owner && !part.done
        ? `${part.owner.name} is still working on ${name}. You can see their ratings; you can change them once they send it to you.`
        : `${part.owner?.name ?? "Another teacher"} rates ${name} for this class.`;
    if (part.done && !view.isLead && !canWrite) return `You sent ${name} to ${lead}. Take it back to change it.`;
    return null;
  };
  const nudged = useRef(false);
  const blocked = (areaKey?: string) => {
    const why = locked ?? (areaKey ? partWhy(areaKey) : !canWrite ? `${lead} writes the whole report.` : null);
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
    // Start on the first of this person's areas with something left to rate (any area for the lead).
    const mineFirst = rubric.areas.findIndex((a) => view.parts[a.key]?.mine && areaProgress(a, view.answers[a.key]).todo > 0);
    const i = mineFirst >= 0 ? mineFirst : rubric.areas.findIndex((a) => (canWrite || view.parts[a.key]?.mine) && areaProgress(a, view.answers[a.key]).todo > 0);
    return i < 0 ? Math.max(0, rubric.areas.findIndex((a) => view.parts[a.key]?.mine)) : i;
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
  // The lead and an administrator see every area; another teacher sees only the areas they rate.
  const shown = rubric.areas.map((_, i) => i).filter((i) => adminView || canWrite || view.parts[rubric.areas[i].key]?.mine);
  const total = shown.reduce((n, i) => n + progress[i].total, 0);
  const answered = shown.reduce((n, i) => n + progress[i].rated + progress[i].notSeen, 0);
  const ready = answered === total;
  const current = rubric.areas[area];
  const ans = answers[current.key];
  const myAreas = rubric.areas.filter((a) => view.parts[a.key]?.mine).map((a) => a.name);
  const part = view.parts[current.key];
  const readOnly = !!locked || !!partWhy(current.key);

  // For whoever brings the report together (the lead, or an administrator watching), every area is in one of three
  // groups: theirs to rate, sent in by its teacher and waiting to be checked, or still with that teacher.
  const sortsParts = canWrite || adminView;
  const groupOf = (i: number): AreaGroup => {
    const p = view.parts[rubric.areas[i].key];
    if (!sortsParts || !p?.owner || p.mine || p.owner.name === view.leadName) return "mine";
    return p.done ? "check" : "waiting";
  };
  const GROUPS: { key: AreaGroup; label: string; icon: string; empty: string; tone: string }[] = [
    { key: "mine", label: adminView ? `${lead}’s areas` : canWrite ? "Yours to rate" : "Your areas", icon: "edit", empty: "Nothing to rate.", tone: "text-status-progress-fg" },
    { key: "check", label: adminView ? `Sent to ${lead}` : "Sent to you to check", icon: "check", empty: "Nothing sent in yet.", tone: "text-status-approved-fg" },
    { key: "waiting", label: "With other teachers", icon: "timetable", empty: "Every part is in.", tone: "text-status-idle-fg" },
  ];
  const inGroup = (g: AreaGroup) => shown.filter((i) => groupOf(i) === g);
  // Tabs, Previous and Next follow the groups: your own areas first, then what to check, then what you wait for.
  const ordered = GROUPS.flatMap((g) => inGroup(g.key));
  const tabGroups = GROUPS.filter((g) => inGroup(g.key).length > 0);
  const owner = (i: number) => view.parts[rubric.areas[i].key]?.owner?.name ?? "Another teacher";
  const sentAt = (i: number) => view.parts[rubric.areas[i].key]?.done?.at;
  const group = groupOf(area);

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
  const olderPhotos = photos.filter((p) => !p.areaKey || (p.areaKey !== COVER_PHOTO_KEY && !rubric.areas.some((a) => a.key === p.areaKey)));
  const note = ans.note ?? "";
  const at = ordered.indexOf(area);
  const prevArea = at > 0 ? ordered[at - 1] : null;
  const nextArea = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;
  const isLast = nextArea === null;
  // The next area still to rate by this person: never one that is still with another teacher.
  const firstGap = ordered.find((i) => progress[i].todo > 0 && groupOf(i) === "mine" && (canWrite || view.parts[rubric.areas[i].key]?.mine)) ?? -1;
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
            {childName}{" "}
            {/* The Chinese name prints on the report, so only whoever writes the report changes it, and not once it is locked. */}
            {canWrite && !locked ? (
              <ChineseName reviewId={reviewId} initial={view.chineseName} />
            ) : (
              view.chineseName && (
                <span className="ml-2 align-middle text-xl font-normal text-muted-foreground" style={{ fontFamily: "var(--font-han)" }}>
                  {view.chineseName}
                </span>
              )
            )}
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
          {canWrite && (
            <Button
              type="button"
              disabled={!ready || writing || !!locked || view.waitingFor.length > 0}
              onClick={write}
              title={view.waitingFor.length ? "Every teacher sends their part first" : ready ? undefined : "Rate every statement, or mark it Not seen yet, first"}
            >
              <Icon name="write" size={16} /> {view.hasReport ? "Write again" : "Write report"}
            </Button>
          )}
        </div>
      </header>
      {!canWrite && !locked && (
        <Alert className="mb-4">
          <AlertDescription>
            {myAreas.length
              ? `You rate ${myAreas.join(" and ")} for this class. Rate it, check the paragraph the AI writes, then send it to ${lead}. ${lead} writes the whole report.`
              : `You don’t rate any area for this class. ${lead} and the other teachers write this child’s report.`}
          </AlertDescription>
        </Alert>
      )}
      {sortsParts && (!locked || adminView) && tabGroups.length > 1 && (
        <section aria-label="Who is doing what" className="mb-5 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          {GROUPS.map((g) => {
            const list = inGroup(g.key);
            return (
              <div key={g.key} className="grid content-start gap-1.5 bg-card px-4 py-3">
                <p className={cn("flex items-center gap-1.5 text-xs font-medium", g.tone)}>
                  <Icon name={g.icon} size={14} /> {g.label} <span className="font-normal text-muted-foreground">{list.length}</span>
                </p>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{g.empty}</p>
                ) : (
                  <ul className="grid gap-0.5">
                    {list.map((i) => (
                      <li key={i}>
                        <button type="button" onClick={() => goTo(i)} className="flex w-full items-baseline justify-between gap-2 rounded-sm text-left text-sm hover:underline">
                          <span className="font-medium">{rubric.areas[i].shortName}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {g.key === "mine"
                              ? progress[i].todo === 0
                                ? "All done"
                                : `${progress[i].todo} left`
                              : g.key === "check"
                                ? `from ${owner(i)}${sentAt(i) ? ` · ${timeAgo(sentAt(i)!)}` : ""}`
                                : `${owner(i)} · ${progress[i].total - progress[i].todo} of ${progress[i].total}`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}
      {canWrite && !locked && view.waitingFor.length > 0 && <p className="-mt-3 mb-4 text-xs text-muted-foreground">Write report unlocks once every teacher has sent their part.</p>}
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
            {view.workflow.canHandBack && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const res = await handBackAction(reviewId);
                  if (res.ok) {
                    toast.success(`${childName}’s report is back with the teacher.`);
                    router.refresh();
                  } else toast.error(res.error);
                }}
              >
                Hand back to the teacher
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {shown.length > 0 && (
      <>
      <div role="tablist" aria-label="Learning areas" className="mb-5 flex gap-4 overflow-x-auto border-b">
        {tabGroups.map((g) => (
          <div key={g.key} role="presentation" className="flex flex-col">
            {tabGroups.length > 1 && (
              <span className={cn("flex items-center gap-1 whitespace-nowrap px-3 pt-1 text-[11px] font-medium", g.tone)}>
                <Icon name={g.icon} size={12} /> {g.label}
              </span>
            )}
            <div className="flex gap-1">
              {inGroup(g.key).map((i) => {
                const a = rubric.areas[i];
                const p = progress[i];
                const done = p.todo === 0;
                return (
                  <button
                    key={a.key}
                    type="button"
                    role="tab"
                    aria-selected={i === area}
                    onClick={() => goTo(i)}
                    className={cn(
                      "-mb-px flex min-w-28 flex-col items-start gap-0.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-left text-muted-foreground transition-colors hover:text-foreground aria-selected:border-primary aria-selected:text-foreground",
                      g.key === "waiting" && "opacity-70 aria-selected:opacity-100",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <Icon name={a.icon ?? a.key} size={16} />
                      {a.shortName}
                    </span>
                    <span className="text-xs">
                      {g.key === "check"
                        ? `${owner(i)} sent it · check`
                        : g.key === "waiting"
                          ? `${owner(i)} · ${p.total - p.todo} of ${p.total}`
                          : `${view.parts[a.key]?.done ? "Sent ✓ · " : ""}${done ? `All ${p.total} done` : `${p.total - p.todo} of ${p.total}`}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="form-cols">
        <section className={cn("area-card", readOnly && "[&_.ladder]:opacity-60 [&_[role=radiogroup]]:opacity-60 [&_textarea]:opacity-60")} aria-labelledby="area-title" role="tabpanel">
          <div className="mb-2 flex items-start gap-3">
            <span className="mt-1 text-primary">
              <Icon name={current.icon ?? current.key} size={24} />
            </span>
            <div>
              <h2 id="area-title" className="text-2xl font-bold">
                {current.name} {current.subName && <span className="han">{current.subName}</span>}
              </h2>
              <p className="text-sm text-muted-foreground">
                {readOnly && !locked && group === "mine" ? partWhy(current.key) : "Tap the box that fits best. 1 is still learning, 5 really shines."}
              </p>
            </div>
          </div>
          {(!locked || adminView) && group === "waiting" && (
            <Alert className="mb-4 border-transparent bg-status-idle-soft">
              <Icon name="timetable" size={16} />
              <AlertTitle>{owner(area)} is still rating {current.shortName}</AlertTitle>
              <AlertDescription>
                {progress[area].total - progress[area].todo} of {progress[area].total} rated so far. {adminView ? `Once they send it, it goes to ${lead} to check.` : "Nothing for you to do here yet: once they send it, it moves to “Sent to you to check”."}
              </AlertDescription>
            </Alert>
          )}
          {(!locked || adminView) && group === "check" && (
            <Alert className="mb-4 border-transparent bg-status-approved-soft">
              <Icon name="check" size={16} />
              <AlertTitle>
                {owner(area)} sent {current.shortName} to {adminView ? lead : "you"}
                {sentAt(area) ? ` ${timeAgo(sentAt(area)!)}` : ""}
              </AlertTitle>
              <AlertDescription>{adminView ? `${lead} checks the ratings and writes them into the report.` : "Check the ratings below. You can still change any of them; they go into the report when you write it."}</AlertDescription>
            </Alert>
          )}

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
              {!view.photoConsent && (
                <p className="small muted">No photo consent from {childName}’s parents, so photos cannot be added and none print. An administrator records consent on the child’s profile.</p>
              )}
              <div className="photos-row" hidden={!view.photoConsent}>
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
              {view.photoConsent && areaPhotos.length >= view.photosPerArea && (
                <button type="button" className="small" style={{ alignSelf: "flex-start", textDecoration: "underline", background: "none", border: 0, padding: 0 }} disabled={uploading !== null} onClick={() => pickFor(current.key)}>
                  Choose a different photo
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files, uploadKey.current)} />
            </div>
          </div>

          {part?.mine && !canWrite && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-secondary/40 p-4">
              <div className="grid gap-0.5">
                <h3 className="font-heading text-lg font-semibold">Your {current.name} page</h3>
                <p className="text-sm text-muted-foreground">
                  {part.done
                    ? `Approved and sent to ${lead}.`
                    : part.paragraph
                      ? `Written. Check the page and send it to ${lead}.`
                      : progress[area].todo === 0
                        ? "All rated. The AI writes your page of the report for you to check."
                        : "Rate every statement first; then the AI writes your page of the report."}
                </p>
              </div>
              <Button
                type="button"
                variant={part.done ? "outline" : "default"}
                disabled={progress[area].todo > 0 && !part.paragraph}
                onClick={async () => {
                  await flush();
                  router.push(`/child/${reviewId}/part/${current.key}`);
                }}
              >
                <Icon name={part.paragraph ? "reports" : "write"} size={16} /> {part.paragraph || part.done ? "Open my page" : "Write my page"}
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-5">
            <Button type="button" variant="outline" onClick={() => prevArea !== null && goTo(prevArea)} disabled={prevArea === null}>
              <Icon name="left" size={16} stroke={2} />
              {prevArea === null ? "Previous" : rubric.areas[prevArea].shortName}
            </Button>
            {isLast ? (
              firstGap < 0 ? (
                canWrite ? (
                  <Button type="button" onClick={write} disabled={writing || !!locked || view.waitingFor.length > 0}>
                    <Icon name="write" size={16} /> {view.hasReport ? "Write again" : "Write report"}
                  </Button>
                ) : (
                  <span />
                )
              ) : (
                <Button type="button" variant="secondary" onClick={() => goTo(firstGap)}>
                  Still to rate: {rubric.areas[firstGap].shortName}
                  <Icon name="right" size={16} stroke={2} />
                </Button>
              )
            ) : (
              <Button type="button" onClick={() => nextArea !== null && goTo(nextArea)}>
                Next: {rubric.areas[nextArea!].shortName}
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
            {tabGroups.map((g) => (
              <div key={g.key}>
                {tabGroups.length > 1 && (
                  <p className={cn("mt-3 flex items-center gap-1 text-xs font-medium", g.tone)}>
                    <Icon name={g.icon} size={12} /> {g.label}
                  </p>
                )}
                <ul className="glance-list" style={tabGroups.length > 1 ? { marginTop: 4 } : undefined}>
                  {inGroup(g.key).map((i) => {
                    const a = rubric.areas[i];
                    return (
                      <li key={a.key}>
                        <button type="button" aria-current={i === area} onClick={() => goTo(i)}>
                          <Icon name={a.icon ?? a.key} size={18} />
                          <span>
                            {a.name}
                            {g.key !== "mine" && <span className="block text-xs font-normal text-muted-foreground">{owner(i)}</span>}
                          </span>
                          <span className="dots" role="img" aria-label={`${progress[i].rated} rated, ${progress[i].notSeen} not seen, ${progress[i].todo} to do`}>
                            {a.skills.map((s) => {
                              const x = answers[a.key]?.skills[s.key];
                              return <i key={s.key} className={`gd ${x?.touched ? (x.level > 0 ? "set" : "ns") : ""}`} />;
                            })}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
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
            <h2>Profile photo</h2>
            <p className="small muted" style={{ margin: "4px 0 10px" }}>
              {childName}’s photo across the app{view.photoConsent ? ", and the big photo on the front of the report" : ". Without photo consent it does not print on the report"}. The office sees and can change the same one.
            </p>
            <ChildPhoto childId={view.childId} photo={view.photo} name={childName} size={72} />
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
      </>
      )}
    </div>
  );
}
