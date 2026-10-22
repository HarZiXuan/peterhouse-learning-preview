"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Report } from "@/components/report/Report";
import type { ReportData } from "@peterhouse/shared";
import type { SchoolDetails } from "@peterhouse/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { editTextAction, rewriteSectionAction } from "../../../actions";

type Section = { key: string; title: string; text: string };

const A4_PX = 794;

/** Which A4 page a piece of wording lives on. */
const sheetOf = (key: string) => (key === "home" ? "closing" : key);

function pageLabel(key: string, data: ReportData): string {
  if (key === "opening") return "Page 1 · Cover";
  if (key === "closing") return `Page ${data.areas.length + 2} · Looking ahead`;
  if (key === "home") return `Page ${data.areas.length + 2} · Ideas at home`;
  const i = data.areas.findIndex((a) => `area:${a.key}` === key);
  return i >= 0 ? `Page ${i + 2} · ${data.areas[i].name}` : "";
}

export function ReportWorkbench({
  reviewId,
  locked = null,
  data,
  school,
  sections,
  reportDateIso,
}: {
  reviewId: number;
  /** Why the wording cannot be changed right now (waiting for review, approved, taken over). */
  locked?: string | null;
  data: ReportData;
  school: SchoolDetails;
  sections: Section[];
  reportDateIso: string;
}) {
  const router = useRouter();
  const [texts, setTexts] = useState(() => Object.fromEntries(sections.map((s) => [s.key, s.text])));
  const [saved, setSaved] = useState(texts);
  const [active, setActive] = useState<string | undefined>(sections[0]?.key);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, start] = useTransition();
  const previewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.7);

  // Fit the A4 pages to the preview column.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, (el.clientWidth - 8) / A4_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // After "write again" the server sends new wording: take it for the keys that changed.
  const prevServer = useRef(Object.fromEntries(sections.map((s) => [s.key, s.text])));
  useEffect(() => {
    const changed = sections.filter((s) => prevServer.current[s.key] !== s.text);
    if (!changed.length) return;
    prevServer.current = Object.fromEntries(sections.map((s) => [s.key, s.text]));
    setTexts((t) => ({ ...t, ...Object.fromEntries(changed.map((s) => [s.key, s.text])) }));
    setSaved((t) => ({ ...t, ...Object.fromEntries(changed.map((s) => [s.key, s.text])) }));
  }, [sections]);

  const goToPage = (key: string) => {
    previewRef.current?.querySelector(`[data-sheet="${CSS.escape(sheetOf(key))}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const select = (key: string) => {
    setActive(key);
    goToPage(key);
  };
  const pickFromReport = (key: string) => {
    setActive(key);
    const card = document.getElementById(`ed-${key}`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    (card?.querySelector("textarea") as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
  };

  const dirtyKeys = locked ? [] : sections.map((s) => s.key).filter((k) => texts[k] !== saved[k]);
  const hasUnsaved = dirtyKeys.length > 0;
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Ask before leaving with unsaved wording: closing or reloading the tab, and any link on the page.
  useEffect(() => {
    if (!hasUnsaved) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [hasUnsaved]);

  const saveAndLeave = async () => {
    if (!leaveTo) return;
    setLeaving(true);
    for (const key of dirtyKeys) {
      const res = await editTextAction(reviewId, key, texts[key]);
      if (!res.ok) {
        toast.error(res.error);
        setLeaving(false);
        setLeaveTo(null);
        return;
      }
    }
    setSaved((sv) => ({ ...sv, ...Object.fromEntries(dirtyKeys.map((k) => [k, texts[k]])) }));
    toast.success("Changes saved.");
    const to = leaveTo;
    setLeaving(false);
    setLeaveTo(null);
    router.push(to);
  };
  const discardAndLeave = () => {
    const to = leaveTo;
    setSaved(texts);
    setLeaveTo(null);
    if (to) setTimeout(() => router.push(to), 0);
  };

  const titleOf = (key: string) => sections.find((s) => s.key === key)?.title ?? "Paragraph";
  const save = (key: string) =>
    start(async () => {
      setBusyKey(key);
      const res = await editTextAction(reviewId, key, texts[key]);
      setBusyKey(null);
      if (res.ok) setSaved((s) => ({ ...s, [key]: texts[key] }));
      setMsg((m) => ({ ...m, [key]: res.ok ? "Saved ✓" : res.error }));
      if (res.ok) toast.success(`“${titleOf(key)}” saved.`);
      else toast.error(res.error);
      router.refresh();
    });
  const rewrite = (key: string) =>
    start(async () => {
      setBusyKey(key);
      const res = await rewriteSectionAction(reviewId, key);
      setBusyKey(null);
      setMsg((m) => ({ ...m, [key]: res.ok ? "Written again ✓" : res.error }));
      if (res.ok) toast.success(`“${titleOf(key)}” written again. Read it through before sending.`);
      else toast.error(res.error);
      router.refresh();
    });

  return (
    <div className="wb">
      <AlertDialog open={leaveTo !== null} onOpenChange={(o) => !o && !leaving && setLeaveTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>Save your edits to the wording before you leave, or discard them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Keep editing</AlertDialogCancel>
            <Button variant="outline" disabled={leaving} onClick={discardAndLeave}>
              Discard changes
            </Button>
            <AlertDialogAction disabled={leaving} onClick={(e) => { e.preventDefault(); void saveAndLeave(); }}>
              {leaving ? "Saving…" : "Save and leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="wb-preview" ref={previewRef}>
        <div style={{ zoom }}>
          <Report data={data} school={school} isDraft={false} reportDate={new Date(reportDateIso)} edits={texts} active={active} onPick={pickFromReport} />
        </div>
      </div>

      <aside className="wb-editor" aria-label="Edit the wording">
        <h2>{locked ? "The wording" : "Edit the wording"}</h2>
        <p className="small muted" style={{ marginBottom: 12 }} hidden={!!locked}>
          Click a box to jump to its page, or click a highlighted paragraph on the report. Your changes show on the report as you type. Words between <b>**stars**</b> print in bold.
        </p>
        {sections.map((s) => {
          const dirty = texts[s.key] !== saved[s.key];
          const isActive = active === s.key;
          const busy = busyKey === s.key;
          return (
            <div key={s.key} id={`ed-${s.key}`} className={`wb-card ${isActive ? "is-active" : ""}`}>
              <button type="button" className="wb-where" onClick={() => select(s.key)}>
                <span>{pageLabel(s.key, data)}</span>
                <span className="wb-goto">Show on report ↗</span>
              </button>
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="sr-only">{s.title}</span>
                <Textarea
                  rows={s.key === "home" ? 4 : 7}
                  value={texts[s.key] ?? ""}
                  readOnly={!!locked}
                  onFocus={() => select(s.key)}
                  onChange={(e) => setTexts((t) => ({ ...t, [s.key]: e.target.value }))}
                />
              </label>
              <div className="row" style={{ marginTop: 8 }} hidden={!!locked}>
                <Button size="sm" disabled={!dirty || busy || !!locked} onClick={() => save(s.key)}>
                  Save
                </Button>
                {s.key !== "home" && (
                  <Button variant="outline" size="sm" disabled={busy || !!locked} onClick={() => rewrite(s.key)}>
                    Write this part again
                  </Button>
                )}
                <span className="small muted row" style={{ gap: 8 }} aria-live="polite">
                  {busy && <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden />}
                  {busy ? "Working…" : dirty ? "Not saved yet" : (msg[s.key] ?? "")}
                </span>
              </div>
            </div>
          );
        })}
      </aside>
    </div>
  );
}
