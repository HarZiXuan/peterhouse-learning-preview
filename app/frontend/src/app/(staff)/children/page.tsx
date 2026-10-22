import { redirect } from "next/navigation";
import type { ClassesView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AddChild } from "../AddChild";
import { ChildrenTable } from "./ChildrenTable";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Every child this semester in one table, to find a child or check birthdays and report status across the school. */
export default async function ChildrenPage() {
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/");
  const view = await apiGet<ClassesView>("/admin/classes");
  const here = view.pupils.filter((p) => !p.left).length;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div className="grid gap-1.5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">School year {info.period.year}</p>
          <h1 className="flex items-center gap-3 font-heading text-4xl font-bold leading-tight tracking-tight md:text-[42px]"><Icon name="children" size={30} />Children</h1>
          <p className="text-muted-foreground">
            {here} {here === 1 ? "child" : "children"}. A child’s level is the age they turn in {view.year}.
          </p>
        </div>
        <AddChild classes={view.classes} year={view.year} icon className="h-10 px-5 font-semibold" />
      </header>
      <ChildrenTable pupils={view.pupils} classes={view.classes} />
    </main>
  );
}
