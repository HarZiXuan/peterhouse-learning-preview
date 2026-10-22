import { redirect } from "next/navigation";
import type { ClassesView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AddChild } from "../AddChild";
import { ClassesBoard } from "./ClassesBoard";
import { NewClass } from "./NewClass";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Every class this semester, by level, with its children and teachers. Children have their own page; teachers are in Settings → People. */
export default async function ClassesPage() {
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/");
  const view = await apiGet<ClassesView>("/admin/classes");

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="grid gap-1.5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            School year {info.period.year}
          </p>
          <h1 className="flex items-center gap-3 font-heading text-4xl font-bold leading-tight tracking-tight md:text-[42px]"><Icon name="classes" size={30} />Classes</h1>
          <p className="text-muted-foreground">A child’s level is the age they turn in {view.year}. Open a class to manage its teachers and children.</p>
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
