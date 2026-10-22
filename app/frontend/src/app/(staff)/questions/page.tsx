import { redirect } from "next/navigation";

/** Old address: the questions are the second tab of Reports. */
export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = Object.entries(await searchParams).filter((e): e is [string, string] => !!e[1]);
  redirect(`/reports?${new URLSearchParams([["view", "questions"], ...sp])}`);
}
