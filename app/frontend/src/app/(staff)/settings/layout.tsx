import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Icon } from "@/components/icons";
import { SettingsNav } from "./SettingsNav";

export const dynamic = "force-dynamic";

/** Every settings page: one header, the settings menu on the left, the page on the right. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  const admin = user.role === "admin";
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-10 md:pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peterhouse Learning Review</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight md:text-4xl">Settings</h1>
          <p className="mt-1 text-muted-foreground">{admin ? "Your account, the school’s reports, people and semesters. All in one place." : "Your account and password."}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground">
          <Icon name="shield" size={15} />
          {admin ? "Administrator settings" : "Teacher settings"}
        </span>
      </header>
      <div className="grid gap-6 md:grid-cols-[13.5rem_minmax(0,1fr)] md:gap-10">
        <aside className="min-w-0 md:border-r md:pr-6">
          <SettingsNav admin={admin} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
