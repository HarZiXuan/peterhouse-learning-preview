"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { SELECT } from "../AddChild";
import { cn } from "@/lib/utils";

/** Name search and class and teacher filters for the review queue. Changing one reloads the list with it. */
export function Filters({ classes, teachers, className }: { classes: { id: number; name: string }[]; teachers: { id: number; name: string }[]; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const set = (key: string, value: string, push = true) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (push) router.push(`${path}?${next.toString()}`);
    else router.replace(`${path}?${next.toString()}`, { scroll: false });
  };
  return (
    <div className={cn("mb-5 flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Icon name="search" size={16} />
        </span>
        <input
          type="search"
          aria-label="Search by child name"
          placeholder="Search by name"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => {
            clearTimeout(timer.current);
            const v = e.target.value;
            timer.current = setTimeout(() => set("q", v.trim(), false), 250);
          }}
          className={`${SELECT} pl-9`}
        />
      </div>
      <select aria-label="Class" className={cn(SELECT, "w-auto min-w-40")} value={params.get("class") ?? ""} onChange={(e) => set("class", e.target.value)}>
        <option value="">All classes</option>
        {classes.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
      {teachers.length > 0 && (
      <select aria-label="Teacher" className={cn(SELECT, "w-auto min-w-40")} value={params.get("teacher") ?? ""} onChange={(e) => set("teacher", e.target.value)}>
        <option value="">All teachers</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      )}
    </div>
  );
}
