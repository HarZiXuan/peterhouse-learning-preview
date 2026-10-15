import Link from "next/link";
import { notFound } from "next/navigation";
import { EXTRA_NOTES, getReviewRow, loadAnswers, loadNotes, reviewRubric, syncRubric } from "@/lib/reviews";
import { hasPhotoConsent, listPhotos, MAX_PHOTOS } from "@/lib/photos";
import { ChildAvatar } from "@/components/ui";
import { Questions } from "./Questions";
import { Photos } from "./Photos";

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const first = getReviewRow(id);
  if (!first) notFound();
  const r = syncRubric(first);
  const rubric = reviewRubric(r);
  const { answers } = loadAnswers(id, rubric);
  const photos = listPhotos(id);
  return (
    <main className="board">
      <header className="child-head">
        <ChildAvatar photoId={photos[0]?.id} name={r.preferred_name} size={72} />
        <div>
          <p className="eyebrow">
            <Link href="/">Class</Link> / Learning review
          </p>
          <h1>{r.preferred_name}</h1>
        </div>
        {r.draft && (
          <Link className="btn btn-primary" href={`/child/${id}/report`} style={{ marginLeft: "auto" }}>
            Open report
          </Link>
        )}
      </header>
      <div className="child-grid">
        <Questions
          reviewId={id}
          childName={r.preferred_name}
          rubric={rubric}
          initialAnswers={answers}
          initialHighlight={r.highlight}
          notes={loadNotes(id)}
          noteDefs={EXTRA_NOTES.map((n) => ({ ...n }))}
          hasReport={!!r.draft}
        />
        <Photos reviewId={id} childName={r.preferred_name} initialPhotos={photos} initialConsent={hasPhotoConsent(id)} max={MAX_PHOTOS} />
      </div>
    </main>
  );
}
