"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SELECT } from "../AddChild";

/** Class and teacher filters for Approvals. Changing one reloads the list with it. */
export function Filters({ classes, teachers }: { classes: { id: number; name: string }[]; teachers: { id: number; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${path}?${next.toString()}`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label="Class" className={`${SELECT} w-auto min-w-40`} value={params.get("class") ?? ""} onChange={(e) => set("class", e.target.value)}>
        <option value="">All classes</option>
        {classes.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
      <select aria-label="Teacher" className={`${SELECT} w-auto min-w-40`} value={params.get("teacher") ?? ""} onChange={(e) => set("teacher", e.target.value)}>
        <option value="">All teachers</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
