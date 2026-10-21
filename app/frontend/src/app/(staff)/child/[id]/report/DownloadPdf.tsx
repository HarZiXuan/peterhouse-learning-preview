"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** Makes the PDF on the server, then saves it. It takes a few seconds, so the person is told what is happening. */
export function DownloadPdf({ reviewId, childName, disabledReason = null }: { reviewId: number; childName: string; /** Why it cannot be downloaded yet. */ disabledReason?: string | null }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    if (disabledReason) return void toast.info(disabledReason);
    setBusy(true);
    const id = toast.loading(`Making ${childName}’s PDF…`);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/pdf`);
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "The PDF could not be made.");
      const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get("content-disposition") ?? "")?.[1];
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name ? decodeURIComponent(name) : `${childName} Learning Review.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${childName}’s PDF is downloaded.`, { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The PDF could not be made.", { id });
    } finally {
      setBusy(false);
    }
  }
  return (
    // Not `disabled` when waiting for approval: a click explains why, which a greyed-out button cannot.
    <Button onClick={download} disabled={busy} variant={disabledReason ? "outline" : "default"} aria-disabled={!!disabledReason} title={disabledReason ?? undefined}>
      {disabledReason && <Icon name="lock" size={15} />}
      {busy ? "Making PDF…" : "Download PDF"}
    </Button>
  );
}
