import { redirect } from "next/navigation";
import type { ClassesView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AddChild } from "../AddChild";
import { ClassesBoard } from "./ClassesBoard";
import { NewClass } from "./NewClass";

export const dynamic = "force-dynamic";

/** Every class this semester, by level, with its capacity and teachers. */
export default async function ClassesPage() {
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/");
  const view = await apiGet<ClassesView>("/admin/classes");
  const total = view.classes.reduce((n, k) => n + k.children, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="grid gap-1.5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            School year {info.period.year}
          </p>
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight md:text-[42px]">Classes</h1>
          <p className="text-muted-foreground">
            {view.classes.length} {view.classes.length === 1 ? "class" : "classes"} · {total} {total === 1 ? "child" : "children"}. A child’s level is the age they turn in {view.year}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <AddChild classes={view.classes} year={view.year} icon variant="outline" className="h-10 px-5 font-semibold" />
          <NewClass year={view.year} />
        </div>
      </header>

      <ClassesBoard view={view} />
    </main>
  );
}
