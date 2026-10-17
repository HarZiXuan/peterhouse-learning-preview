import Link from "next/link";
import type { ReviewView } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { ChildAvatar } from "@/components/ui";
import { Questions } from "./Questions";
import { Photos } from "./Photos";

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const v = await apiGet<ReviewView>(`/reviews/${id}`);
  return (
    <main className="board">
      <header className="child-head">
        <ChildAvatar photoId={v.photos[0]?.id} name={v.childName} size={72} />
        <div>
          <p className="eyebrow">
            <Link href="/">Class</Link> / Learning review
          </p>
          <h1>{v.childName}</h1>
        </div>
        {v.hasReport && (
          <Link className="btn btn-primary" href={`/child/${id}/report`} style={{ marginLeft: "auto" }}>
            Open report
          </Link>
        )}
      </header>
      <div className="child-grid">
        <Questions
          reviewId={id}
          childName={v.childName}
          rubric={v.rubric}
          initialAnswers={v.answers}
          initialHighlight={v.highlight}
          notes={v.notes}
          noteDefs={v.noteDefs}
          hasReport={v.hasReport}
        />
        <Photos reviewId={id} childName={v.childName} initialPhotos={v.photos} initialConsent={v.photoConsent} max={v.maxPhotos} />
      </div>
    </main>
  );
}
