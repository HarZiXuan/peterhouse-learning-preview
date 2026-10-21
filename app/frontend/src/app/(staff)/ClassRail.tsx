"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import type { ClassSummary, ReviewStatus, SessionUser } from "@peterhouse/shared";
import { ChildAvatar, ProgressRing, initials } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AddChild } from "./AddChild";

export type RailChild = {
  reviewId: number;
  name: string;
  answered: number;
  total: number;
  hasReport: boolean;
  status: ReviewStatus;
  coverPhotoId: number | null;
  areas: { name: string; answered: number; total: number }[];
};

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/login?out=1";
}

type Section = "class" | "reviews" | "reports" | "approvals" | "classes" | "questions" | "people" | "settings";

function sectionOf(path: string): Section {
  if (/^\/child\/\d+\/report/.test(path) || path.startsWith("/reports")) return "reports";
  if (path.startsWith("/child/") || path.startsWith("/reviews")) return "reviews";
  if (path.startsWith("/classes")) return "classes";
  if (path.startsWith("/approvals")) return "approvals";
  if (path.startsWith("/questions")) return "questions";
  if (path.startsWith("/settings/people")) return "people";
  if (path.startsWith("/settings")) return "settings";
  return "class";
}

const COLLAPSE_KEY = "rail-collapsed";
const collapseListeners = new Set<() => void>();

/** The sidebar's collapsed choice, remembered in this browser. It starts open on the server and settles after hydration. */
function useCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(
    (cb) => {
      collapseListeners.add(cb);
      return () => void collapseListeners.delete(cb);
    },
    () => {
      try {
        return localStorage.getItem(COLLAPSE_KEY) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {}
    collapseListeners.forEach((cb) => cb());
  };
  return [collapsed, set];
}

type Item = { key: Section; href: string; label: string; icon: IconName; count?: number };
type Group = { label: string; items: Item[] };

function Account({ user, side = "top" }: { user: SessionUser; side?: "top" | "bottom" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Account: ${user.name}`} className="flex items-center gap-2 rounded-md p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-xs font-semibold">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={side} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-semibold">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/account">My account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}>
          <Icon name="logout" size={16} /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function stateOf(k: RailChild) {
  if (k.status === "approved") return "Approved";
  if (k.status === "submitted") return "Waiting for review";
  if (k.status === "changes_requested") return "Changes requested";
  return k.hasReport ? "Report written" : k.answered === 0 ? "Not started" : k.answered === k.total ? "Ready to write" : `${k.answered} of ${k.total} rated`;
}

export function ClassRail({
  kids,
  classes,
  year,
  waiting,
  user,
  children,
}: {
  kids: RailChild[];
  classes: ClassSummary[];
  year: number;
  /** Reports waiting for the administrator's review. */
  waiting: number;
  user: SessionUser;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useCollapsed();
  const [q, setQ] = useState("");
  const activeId = Number(/^\/child\/(\d+)/.exec(path)?.[1] ?? 0);
  const section = sectionOf(path);
  const shown = kids.filter((k) => k.name.toLowerCase().includes(q.trim().toLowerCase()));
  const finished = kids.filter((k) => k.hasReport).length;
  const admin = user.role === "admin";
  const showKids = (section === "class" || section === "reviews" || section === "reports") && !collapsed;
  // A teacher's home is their own class; the administrator manages every class from Classes instead.
  // Teachers see their finished reports; the administrator sees every report as a review queue instead.
  const groups: Group[] = admin
    ? [
        {
          label: "Teaching",
          items: [
            { key: "classes", href: "/classes", label: "Classes", icon: "classes" },
            { key: "reviews", href: "/reviews", label: "Reviews", icon: "reviews" },
            { key: "approvals", href: "/approvals", label: "Approvals", icon: "reports", count: waiting },
          ],
        },
        {
          label: "Setup",
          items: [
            { key: "questions", href: "/questions", label: "Questions", icon: "questions" },
            { key: "people", href: "/settings/people", label: "People", icon: "people" },
            { key: "settings", href: "/settings", label: "Settings", icon: "settings" },
          ],
        },
      ]
    : [
        {
          label: "My class",
          items: [
            { key: "class", href: "/", label: "Class", icon: "class" },
            { key: "reviews", href: "/reviews", label: "Reviews", icon: "reviews" },
            { key: "reports", href: "/reports", label: "Reports", icon: "reports" },
          ],
        },
        { label: "Account", items: [{ key: "settings", href: "/settings", label: "Settings", icon: "settings" }] },
      ];
  const items = groups.flatMap((g) => g.items);
  const togo = kids.length - finished;
  const doneHref = admin ? "/approvals" : "/reports";

  return (
    <div className={cn("min-h-screen md:grid", collapsed ? "md:grid-cols-[4.5rem_minmax(0,1fr)]" : "md:grid-cols-[17rem_minmax(0,1fr)]")}>
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar md:flex" aria-label="Main">
        <div className={cn("flex items-center gap-3 pb-4 pt-5", collapsed ? "justify-center px-2" : "px-5")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/peterhouse-shield.png" alt="Peterhouse" className="h-10 w-8 shrink-0 object-contain" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-heading text-lg font-bold leading-tight">Peterhouse</p>
              <p className="truncate text-xs font-semibold text-primary">Learning Review</p>
            </div>
          )}
        </div>

        <nav className={cn("flex flex-col gap-4 overflow-y-auto border-t pt-4", collapsed ? "px-2" : "px-3")} aria-label="Sections">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-0.5">
              {collapsed ? <span className="mx-2 mb-1 h-px bg-border" aria-hidden /> : <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</p>}
              {g.items.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  title={collapsed ? it.label : undefined}
                  aria-label={collapsed ? it.label : undefined}
                  aria-current={section === it.key ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-bold text-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary",
                    collapsed ? "justify-center px-0" : "px-3",
                  )}
                >
                  <Icon name={it.icon} size={19} />
                  {!collapsed && it.label}
                  {!!it.count && (
                    <span className={cn("rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground", collapsed ? "absolute right-1 top-1 px-1.5 text-[10px] leading-4" : "ml-auto")} aria-label={`${it.count} waiting`}>
                      {it.count}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {showKids ? (
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 border-t px-3 pt-4" aria-label="Children">
            <p className="px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Children</p>
            {kids.length > 6 && (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
                  <Icon name="search" size={15} stroke={2} />
                </span>
                <Input type="search" placeholder="Find a child" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a child" className="h-8 pl-8" />
              </div>
            )}
            <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {shown.map((k) => (
                <li key={k.reviewId}>
                  <Link
                    href={k.hasReport ? `/child/${k.reviewId}/report` : `/child/${k.reviewId}`}
                    aria-current={k.reviewId === activeId ? "page" : undefined}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent aria-[current=page]:bg-primary/10"
                  >
                    <ChildAvatar photoId={k.coverPhotoId} name={k.name} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{k.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{stateOf(k)}</span>
                    </span>
                    {k.status === "changes_requested" ? (
                      <span className="text-warn">
                        <Icon name="warn" size={16} label="Changes requested" />
                      </span>
                    ) : k.hasReport ? (
                      <Icon name="check" size={16} stroke={2.4} label={stateOf(k)} />
                    ) : (
                      <ProgressRing answered={k.answered} total={k.total} />
                    )}
                  </Link>
                </li>
              ))}
              {kids.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">{admin ? "No children yet. Add the first one below." : "No children yet. The administrator adds them."}</li>}
              {kids.length > 0 && shown.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">No child called “{q}”.</li>}
            </ul>
            {admin && <AddChild classes={classes} year={year} label="Add a child" variant="outline" className="w-full justify-start" icon />}
          </div>
        ) : (
          <span className="flex-1" />
        )}

        {kids.length > 0 && (
          <Link
            href={togo === 0 ? doneHref : "/reviews"}
            title={collapsed ? `${finished} of ${kids.length} reports done` : undefined}
            className={cn("group mx-3 mb-3 flex items-center gap-3 rounded-xl border bg-card p-3 outline-none transition-colors hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50", collapsed && "mx-2 justify-center p-2")}
          >
            <span className="relative grid size-11 shrink-0 place-items-center">
              <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="22" cy="22" r="19" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle cx="22" cy="22" r="19" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(finished / kids.length) * 119.4} 119.4`} />
              </svg>
              <span className="text-xs font-bold">
                {finished}/{kids.length}
              </span>
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-sm font-bold">{togo === 0 ? "All reports done" : "Report progress"}</span>
                <span className="block truncate text-xs text-muted-foreground">{togo === 0 ? (admin ? "Ready to approve" : "See your reports") : `${togo} ${togo === 1 ? "report" : "reports"} to go`}</span>
              </span>
            )}
            {!collapsed && <Icon name="right" size={16} />}
          </Link>
        )}

        <div className={cn("flex items-center gap-2 border-t px-3 py-3", collapsed && "flex-col")}>
          <Account user={user} side="top" />
          {!collapsed && (
            <div className="min-w-0 flex-1 text-xs">
              <p className="truncate font-bold">{user.name}</p>
              <p className="truncate text-muted-foreground">{admin ? "Administrator" : "Teacher"}</p>
            </div>
          )}
          {!collapsed && (
            <button type="button" onClick={logout} aria-label="Log out" title="Log out" className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Icon name="logout" size={17} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
            title={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
            className="grid size-8 place-items-center rounded-md border text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Icon name={collapsed ? "right" : "left"} size={16} stroke={2.2} />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b bg-card px-4 py-2 md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/peterhouse-shield.png" alt="" className="h-8 w-7 object-contain" />
        <span className="min-w-0 flex-1">
          <b className="block truncate font-heading text-base font-bold">Peterhouse</b>
          <small className="block text-xs text-muted-foreground">Learning Review</small>
        </span>
        <Account user={user} side="bottom" />
      </header>

      <div className="min-w-0 pb-16 md:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }} aria-label="Main">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            aria-current={section === it.key ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-muted-foreground aria-[current=page]:text-primary"
          >
            <span className="relative">
              <Icon name={it.icon} size={20} />
              {!!it.count && <span className="absolute -right-2.5 -top-1.5 rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">{it.count}</span>}
            </span>
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
