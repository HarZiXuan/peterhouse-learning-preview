import { redirect } from "next/navigation";

/** The timetable is a tab on the Calendar page now; old links land there. */
export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const sp = await searchParams;
  redirect(`/calendar?view=timetable${Number(sp.class) ? `&class=${Number(sp.class)}` : ""}`);
}
