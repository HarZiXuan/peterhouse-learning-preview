"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const TRAIL = "nav-trail";
const MAX = 30;

/** What a page is called when a back link points to it. Pages that are not listed are never offered as a way back. */
const NAMES: [RegExp, string][] = [
  [/^\/$/, "My classes"],
  [/^\/classes$/, "Classes"],
  [/^\/classes\/\d+$/, "Class"],
  [/^\/children$/, "Children"],
  [/^\/children\/\d+$/, "Child"],
  [/^\/teachers$/, "Teachers"],
  [/^\/teachers\/\d+$/, "Teacher"],
  [/^\/reports$/, "Reports"],
  [/^\/approvals\/\d+$/, "Report review"],
  [/^\/child\/\d+$/, "Review"],
  [/^\/child\/\d+\/report$/, "Report"],
  [/^\/calendar/, "Calendar"],
  [/^\/timetable/, "Timetable"],
  [/^\/settings/, "Settings"],
];
const nameOf = (url: string) => NAMES.find(([re]) => re.test(url.split("?")[0]))?.[1] ?? null;

const read = (): string[] => {
  try {
    const t: unknown = JSON.parse(sessionStorage.getItem(TRAIL) ?? "[]");
    return Array.isArray(t) ? t.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/**
 * Remembers the pages visited in this tab, so a back link can return to where the person came from
 * (a class opened from Teachers goes back to Teachers) with its filters, rather than to one fixed parent.
 * Going back to a page already in the trail cuts the trail there, as the browser's own history does.
 * Sits once in the layout.
 */
export function NavTracker() {
  const path = usePathname();
  const query = useSearchParams().toString();
  const url = query ? `${path}?${query}` : path;
  // A layout effect, so it has run before any back link reads the result.
  useLayoutEffect(() => {
    try {
      const trail = read();
      if (trail[trail.length - 1] === url) return;
      const at = trail.lastIndexOf(url);
      sessionStorage.setItem(TRAIL, JSON.stringify(at >= 0 ? trail.slice(0, at + 1) : [...trail, url].slice(-MAX)));
    } catch {}
    listeners.forEach((fn) => fn());
  }, [url]);
  return null;
}

/**
 * A way back that goes to the page the person came from, named after it. With no earlier page (a bookmark, a new tab,
 * or a page that is no use as a way back), it goes to `fallback`. `skip` lists paths that should not count as "where
 * they came from", such as the report when the link is on the review form that leads to it.
 */
export function BackLink({ fallback, skip = [], className }: { fallback: { href: string; label: string }; skip?: string[]; className?: string }) {
  const path = usePathname();
  const stored = useSyncExternalStore(subscribe, () => sessionStorage.getItem(TRAIL), () => null);
  const trail = ((): string[] => {
    try {
      return JSON.parse(stored ?? "[]");
    } catch {
      return [];
    }
  })();
  // The nearest earlier page that is a sensible way back: not this page, not one that only leads here, and one with a name.
  const prev = trail
    .slice(0, -1)
    .reverse()
    .find((u) => typeof u === "string" && u.startsWith("/") && u.split("?")[0] !== path && !skip.includes(u.split("?")[0]) && nameOf(u));
  const to = prev ? { href: prev, label: nameOf(prev)! } : fallback;
  return (
    <Link href={to.href} className={cn("-ml-1 inline-flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground", className)}>
      <ChevronLeft className="size-[18px]" aria-hidden /> {to.label}
    </Link>
  );
}
