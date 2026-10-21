import { Board } from "../Board";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const sp = await searchParams;
  return <Board show="ready" base="/reports" classId={Number(sp.class) || undefined} />;
}
