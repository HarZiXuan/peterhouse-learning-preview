import { redirect } from "next/navigation";
import type { ClassesView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AddChild } from "../AddChild";
import { ChildrenTable } from "./ChildrenTable";
import { PageTitle } from "@/components/admin";

export const dynamic = "force-dynamic";

/** Every child this semester in one table, to find a child or check birthdays and report status across the school. */
export default async function ChildrenPage() {
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/");
  const view = await apiGet<ClassesView>("/admin/classes");
  const here = view.pupils.filter((p) => !p.left).length;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8 md:pt-6">
      <header className="mb-5 mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <PageTitle icon="children">Children</PageTitle>
          <p className="text-sm text-muted-foreground sm:pl-[2.875rem]">
            School year {info.period.year} · {here} {here === 1 ? "child" : "children"}. A child’s level is the age they turn in {view.year}.
          </p>
        </div>
        <AddChild classes={view.classes} year={view.year} icon />
      </header>
      <ChildrenTable pupils={view.pupils} classes={view.classes} />
    </main>
  );
}
