"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitForReviewAction } from "../actions";

/** The lead sends a written report for review straight from the list, so the step is never missed. */
export function SendNow({ reviewId, childName }: { reviewId: number; childName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      className="h-10 min-w-32 px-4 font-bold"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await submitForReviewAction(reviewId);
        setBusy(false);
        if (!res.ok) return void toast.error(`${res.error} Open the report to check it.`);
        toast.success(`${childName}’s report is sent for review.`);
        router.refresh();
      }}
    >
      {busy ? "Sending…" : "Send for review"}
    </Button>
  );
}
