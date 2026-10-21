import { redirect } from "next/navigation";
import type { QuestionBankView, WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { PublishView } from "./PublishView";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  if (user.role !== "admin") redirect("/");
  const bank = await apiGet<QuestionBankView>("/admin/questions");
  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <PublishView bank={bank} />
    </main>
  );
}
