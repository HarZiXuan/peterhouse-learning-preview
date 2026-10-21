import { redirect } from "next/navigation";
import type { QuestionBankView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { QuestionsEditor } from "./QuestionsEditor";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ area?: string; published?: string }> }) {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/");
  const sp = await searchParams;
  const bank = await apiGet<QuestionBankView>("/admin/questions");
  const area = bank.domains.find((d) => d.key === sp.area)?.key ?? bank.domains[0]?.key;
  return (
    <main className="mx-auto max-w-[1360px] px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <QuestionsEditor bank={bank} areaKey={area} published={sp.published ? Number(sp.published) : null} />
    </main>
  );
}
