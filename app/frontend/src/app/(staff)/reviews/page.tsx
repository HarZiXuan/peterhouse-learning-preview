import { Board } from "../Board";

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ class?: string; show?: string }> }) {
  const sp = await searchParams;
  return <Board show={sp.show === "all" ? "all" : "todo"} base="/reviews" classId={Number(sp.class) || undefined} />;
}
