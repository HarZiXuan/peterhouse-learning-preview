import { notFound } from "next/navigation";
import type { PartPageView } from "@peterhouse/shared";
import { BackLink } from "@/components/back-link";
import { apiGetOrNull } from "@/lib/api";
import { PartWorkbench } from "./PartWorkbench";

export const dynamic = "force-dynamic";

/** A teacher's own page of a child's report: see it as families will, check it, and send it to the lead teacher. */
export default async function PartPage({ params }: { params: Promise<{ id: string; area: string }> }) {
  const { id, area } = await params;
  const { data: v } = await apiGetOrNull<PartPageView>(`/reviews/${Number(id) || 0}/parts/${encodeURIComponent(area)}`);
  if (!v) notFound();
  return (
    <main className="mx-auto max-w-[1480px] px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <BackLink fallback={{ href: `/child/${v.reviewId}`, label: "Ratings" }} />
      <div className="mb-5 mt-2">
        <p className="text-sm text-muted-foreground">Your page of the report</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
          {v.childName} · {v.areaName}
        </h1>
      </div>
      <PartWorkbench key={`${v.part.done?.at ?? ""}`} view={v} />
    </main>
  );
}
