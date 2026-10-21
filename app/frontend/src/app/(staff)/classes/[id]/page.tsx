import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ClassDetail, ClassesView, WorkspaceInfo } from "@peterhouse/shared";
import { classLevel } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { AddChild } from "../../AddChild";
import { NewClass } from "../NewClass";
import { ClassChildren, ClassProgress, ClassTeachers, RemoveClass } from "./ClassManager";

export const dynamic = "force-dynamic";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/");
  const [k, all] = await Promise.all([apiGet<ClassDetail>(`/admin/classes/${Number(id) || 0}`), apiGet<ClassesView>("/admin/classes")]);
  const lv = classLevel(k.level);
  const active = k.pupils.filter((p) => !p.left);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-10 md:pt-8">
      <Link href="/classes" className="-ml-1 inline-flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-[18px]" aria-hidden /> Classes
      </Link>
      <header className="mb-7 mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight md:text-[40px]">{k.name}</h1>
          <p className="text-muted-foreground">
            {lv.name} · born {k.birthYear} · turns {lv.turns} in {k.year}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {k.pupils.length === 0 && <RemoveClass id={k.id} name={k.name} />}
          <NewClass existing={{ id: k.id, name: k.name, level: k.level, empty: active.length === 0 }} year={k.year} />
          <AddChild classes={all.classes} year={k.year} classId={k.id} icon className="h-10 px-5 font-semibold" />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <aside aria-label="Class summary" className="grid gap-5 lg:col-start-2 lg:row-start-1">
          <ClassTeachers detail={k} teachers={all.teachers} classes={all.classes} />
          <ClassProgress detail={k} />
        </aside>
        <ClassChildren detail={k} classes={all.classes} className="lg:col-start-1 lg:row-start-1" />
      </div>
    </main>
  );
}
