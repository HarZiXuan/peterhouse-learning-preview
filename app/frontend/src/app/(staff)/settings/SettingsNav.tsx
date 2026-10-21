"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { settingsFor } from "./sections";

const ITEM =
  "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold aria-[current=page]:text-primary";

/** The settings side menu: a search, Overview, then each group. On a phone it becomes one scrolling row. */
export function SettingsNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const [q, setQ] = useState("");
  const groups = settingsFor(admin);
  const needle = q.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !needle || `${i.title} ${i.description} ${i.keywords ?? ""} ${g.title}`.toLowerCase().includes(needle)) }))
    .filter((g) => g.items.length > 0);
  const current = (href: string) => (href === "/settings" ? path === href : path === href || path.startsWith(`${href}/`)) || undefined;

  return (
    <nav aria-label="Settings">
      {/* Phone: one row of chips. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        {[{ href: "/settings", title: "Overview", icon: "overview" as const }, ...groups.flatMap((g) => g.items)].map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={current(i.href) && "page"} className={cn(ITEM, "border bg-card py-1.5")}>
              <Icon name={i.icon} size={16} />
              {i.title}
            </Link>
          </li>
        ))}
      </ul>

      {/* Larger screens: the side menu. */}
      <div className="hidden md:block">
        <div className="relative mb-4">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            <Icon name="search" size={16} stroke={2} />
          </span>
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings…" aria-label="Search settings" className="h-10 rounded-lg bg-card pl-9" />
        </div>
        <Link href="/settings" aria-current={current("/settings") && "page"} className={cn(ITEM, "py-2.5")}>
          <Icon name="overview" size={18} />
          Overview
        </Link>
        {shown.map((g) => (
          <div key={g.key} className="mt-5">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
            <ul className="grid gap-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} aria-current={current(i.href) && "page"} className={ITEM}>
                    <Icon name={i.icon} size={17} />
                    {i.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {shown.length === 0 && <p className="mt-4 px-3 text-sm text-muted-foreground">No setting matches “{q}”.</p>}
      </div>
    </nav>
  );
}
