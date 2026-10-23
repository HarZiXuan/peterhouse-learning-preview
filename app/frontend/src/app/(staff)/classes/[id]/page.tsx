import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import type { ClassDetail, ClassesView, WorkspaceInfo } from "@peterhouse/shared";
import { classLevel } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { PageTitle } from "@/components/admin";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddChild } from "../../AddChild";
import { NewClass } from "../NewClass";
import { areaClashes } from "../shared";
import { AreaTeachers, ClassChildren, ClassGlance, ClassTeachers, RemoveClass } from "./ClassManager";

export const dynamic = "force-dynamic";

const TAB = "h-10 flex-none px-3 group-data-[orientation=horizontal]/tabs:after:-bottom-px";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const info = await apiGet<WorkspaceInfo>("/workspace");
  if (info.user.role !== "admin") redirect("/");
  const [k, all] = await Promise.all([apiGet<ClassDetail>(`/admin/classes/${Number(id) || 0}`), apiGet<ClassesView>("/admin/classes")]);
  const lv = classLevel(k.level);
  const active = k.pupils.filter((p) => !p.left);
  const teachers = (k.lead ? 1 : 0) + k.co.length + k.subjectTeachers.length;
  const clashes = areaClashes(k).length;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8 md:pt-6">
      <BackLink fallback={{ href: "/classes", label: "Classes" }} />
      <header className="mb-5 mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <PageTitle icon="classes">{k.name}</PageTitle>
            <Badge variant="outline" className="font-medium text-muted-foreground">
              {lv.name} · {k.year}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground sm:pl-[2.875rem]">
            Born in {k.birthYear} (they turn {lv.turns} in {k.year}) · {k.lead ? `Lead teacher ${k.lead.name}` : "No lead teacher yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {k.pupils.length === 0 && <RemoveClass id={k.id} name={k.name} />}
          <NewClass existing={{ id: k.id, name: k.name, level: k.level, empty: active.length === 0 }} year={k.year} />
          <AddChild classes={all.classes} year={k.year} classId={k.id} icon />
        </div>
      </header>

      <ClassGlance detail={k} />

      <Tabs defaultValue="children" className="mt-6 gap-4">
        <div className="border-b">
          <TabsList variant="line" className="h-auto p-0">
            <TabsTrigger value="children" className={TAB}>
              <Icon name="children" size={16} /> Children <span className="text-muted-foreground">{active.length}</span>
            </TabsTrigger>
            <TabsTrigger value="teachers" className={TAB}>
              <Icon name="teachers" size={16} /> Teachers <span className="text-muted-foreground">{teachers}</span>
            </TabsTrigger>
            <TabsTrigger value="areas" className={TAB}>
              <Icon name="questions" size={16} /> Who rates what
              {clashes > 0 && <span className="size-1.5 rounded-full bg-warn" aria-label={`${clashes} to settle`} />}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="children">
          <ClassChildren detail={k} classes={all.classes} />
        </TabsContent>
        <TabsContent value="teachers">
          <ClassTeachers detail={k} teachers={all.teachers} classes={all.classes} />
        </TabsContent>
        <TabsContent value="areas">
          <AreaTeachers detail={k} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
