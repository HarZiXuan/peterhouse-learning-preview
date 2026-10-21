import type { ReviewView } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { ReviewForm } from "./ReviewForm";

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  // Opening the review freezes the question set it uses (later edits by the administrator do not change it).
  const v = await apiGet<ReviewView>(`/reviews/${id}`);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <ReviewForm key={id} view={v} />
    </main>
  );
}
