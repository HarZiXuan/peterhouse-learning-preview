import { redirect } from "next/navigation";

/** Old address: the review queue is the first tab of Reports. */
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = Object.entries(await searchParams).filter((e): e is [string, string] => !!e[1]);
  redirect(`/reports${sp.length ? `?${new URLSearchParams(sp)}` : ""}`);
}
