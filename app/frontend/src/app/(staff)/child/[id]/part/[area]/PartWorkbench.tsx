"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PartPageView } from "@peterhouse/shared";
import { Report } from "@/components/report/Report";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/components/ui";
import { reopenPartAction, savePartAction, sendPartAction, writePartAction } from "../../../../actions";
import { ScaledReport } from "../../report/ScaledReport";

/**
 * A teacher's own page of the report. It shows the page as families will see it; the AI writes the paragraph from
 * their ratings, they change it (themselves or by asking the AI), then approve it and send it to the lead teacher.
 */
export function PartWorkbench({ view }: { view: PartPageView }) {
  const router = useRouter();
  const { reviewId, areaKey, areaName, part } = view;
  const key = `area:${areaKey}`;
  const lead = view.leadName ?? "the lead teacher";
  const sent = !!part.done;
  const canChange = part.canEdit && !sent && !view.locked;
  const [text, setText] = useState(part.paragraph);
  const [kept, setKept] = useState(part.paragraph);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState<"write" | "send" | "reopen" | null>(null);

  async function write(ask = "") {
    setBusy("write");
    const res = await writePartAction(reviewId, areaKey, ask);
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setText(res.text ?? "");
    setKept(res.text ?? "");
    setRequest("");
    if (res.fellBack) toast.info("Written with the built-in writer. Read it through.");
  }

  // The first time the page opens, the AI writes it straight away.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || part.paragraph || !view.rated || !canChange) return;
    started.current = true;
    void write();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function keep() {
    if (text === kept) return true;
    const res = await savePartAction(reviewId, areaKey, text);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setKept(text);
    return true;
  }

  async function send() {
    setBusy("send");
    if (!(await keep())) return setBusy(null);
    const res = await sendPartAction(reviewId, areaKey);
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${areaName} approved and sent to ${lead}.`);
    router.refresh();
  }

  async function reopen() {
    setBusy("reopen");
    const res = await reopenPartAction(reviewId, areaKey);
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${areaName} is back with you. Approve it again when it is ready.`);
    router.refresh();
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="relative">
        <ScaledReport>
          <Report data={view.data} school={view.school} isDraft={false} reportDate={new Date()} edits={{ [key]: text }} only={key} />
        </ScaledReport>
        {busy === "write" && (
          <span className="absolute inset-0 grid place-items-center bg-background/50" role="status">
            <span className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 font-semibold shadow-sm">
              <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
              Writing your page…
            </span>
          </span>
        )}
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-6" aria-label={`Your ${areaName} page`}>
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold">The note on this page</h2>
            {sent && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                <Icon name="check" size={15} stroke={2.2} /> Sent {part.done ? timeAgo(part.done.at) : ""}
              </span>
            )}
          </div>
          {!view.rated && !text ? (
            <p className="text-sm text-muted-foreground">
              Rate every {areaName} statement first, or mark it Not seen yet.{" "}
              <Link href={`/child/${reviewId}`} className="font-semibold underline underline-offset-4">
                Back to the ratings
              </Link>
            </p>
          ) : (
            <>
              <Textarea
                rows={9}
                value={text}
                readOnly={!canChange || busy === "write"}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => void keep()}
                aria-label={`${areaName} paragraph`}
                placeholder="Writing…"
              />
              <p className="text-xs text-muted-foreground">Change any words here and the page updates. Words between **stars** print in bold.</p>
              {canChange && (
                <form
                  className="grid gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void write(request);
                  }}
                >
                  <Input
                    value={request}
                    maxLength={500}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder="Ask the AI to change or add something, e.g. Mention the shell counting."
                    aria-label="What the AI should change or add"
                  />
                  <Button type="submit" variant="outline" disabled={busy !== null || !view.rated}>
                    <Icon name="write" size={16} /> {request.trim() ? "Write it with this" : "Write it again"}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>

        {!view.locked && part.canEdit && (
          <div className="grid gap-2 rounded-xl border bg-card p-4">
            {sent ? (
              <>
                <p className="text-sm">
                  You approved this page and sent it to <b>{lead}</b>, who puts the whole report together and sends it for review.
                </p>
                <Button type="button" variant="outline" disabled={busy !== null} onClick={reopen}>
                  Take it back to change it
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Happy with the page? Approve it and it goes to {lead}.</p>
                <Button type="button" disabled={busy !== null || !view.rated || !text.trim()} onClick={send}>
                  <Icon name="check" size={16} stroke={2.2} /> Approve and send to {lead}
                </Button>
              </>
            )}
          </div>
        )}
        {view.locked && <p className="text-sm text-muted-foreground">{view.locked}</p>}
      </aside>
    </div>
  );
}
