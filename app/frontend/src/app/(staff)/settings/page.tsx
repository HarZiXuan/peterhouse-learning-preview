import Link from "next/link";
import type { WorkspaceInfo } from "@peterhouse/shared";
import { apiGet } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { settingsFor } from "./sections";
import { SettingsSection } from "./SettingsSection";

export default async function SettingsOverview() {
  const { user } = await apiGet<WorkspaceInfo>("/workspace");
  const admin = user.role === "admin";
  return (
    <SettingsSection title="Settings overview" description="Find the right place for each part of running the learning reviews.">
      <div className="grid gap-8">
        {settingsFor(admin).map((g) => (
          <section key={g.key} aria-labelledby={`g-${g.key}`}>
            <p className="mb-3 flex flex-wrap items-baseline gap-x-3">
              <span id={`g-${g.key}`} className="font-heading text-lg font-semibold">
                {g.title}
              </span>
              <span className="text-sm text-muted-foreground">{g.description}</span>
            </p>
            <ul className={`grid gap-4 sm:grid-cols-2 ${g.items.length > 2 ? "lg:grid-cols-3" : ""}`}>
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="group block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <Card className="h-full gap-3 px-5 py-5 shadow-none transition-colors group-hover:border-primary/40">
                      <p className="flex items-center gap-2.5 font-heading text-base font-semibold">
                        <span className="text-primary">
                          <Icon name={i.icon} size={19} />
                        </span>
                        {i.title}
                      </p>
                      <p className="flex-1 text-sm text-muted-foreground">{i.description}</p>
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        {i.action}
                        <span className="transition-transform group-hover:translate-x-0.5">
                          <Icon name="arrow" size={15} stroke={2} />
                        </span>
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SettingsSection>
  );
}
