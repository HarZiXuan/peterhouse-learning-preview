"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { ReviewStatus, SessionUser } from "@peterhouse/shared";
import { stageOf } from "@peterhouse/shared";
import { initials } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type RailChild = {
  reviewId: number;
  name: string;
  answered: number;
  total: number;
  hasReport: boolean;
  status: ReviewStatus;
  areas: { name: string; answered: number; total: number }[];
  iAmLead: boolean;
  myParts: { area: string; done: boolean }[];
  partsOpen: boolean;
  takenOver: boolean;
};

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/login?out=1";
}

type Section = "students" | "reports" | "calendar" | "teachers" | "classes" | "children" | "settings";

/** Which menu item a page belongs to. A child's pages belong to Reports. */
function sectionOf(path: string): Section {
  if (path.startsWith("/child/")) return "reports";
  if (path.startsWith("/reports")) return "reports";
  if (path.startsWith("/classes")) return "classes";
  if (path.startsWith("/children")) return "children";
  if (path.startsWith("/approvals") || path.startsWith("/reports") || path.startsWith("/questions")) return "reports";
  if (path.startsWith("/calendar")) return "calendar";
  if (path.startsWith("/teachers")) return "teachers";
  if (path.startsWith("/settings")) return "settings";
  return "students";
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

export function ClassRail({
  kids,
  waiting,
  user,
  children,
}: {
  kids: RailChild[];
  /** Reports waiting for the administrator's review. */
  waiting: number;
  user: SessionUser;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useCollapsed();
  const admin = user.role === "admin";
  const section = sectionOf(path);
  // Reports the administrator sent back to this teacher, flagged on Reports in the menu.
  const sentBack = admin ? 0 : kids.filter((k) => k.status === "changes_requested").length;
  // A teacher's reports still to finish: not sent for review yet, or sent back with changes.
  // The lead counts reports not yet sent for review; another teacher counts children whose part they still owe.
  const stillToDo = admin ? 0 : kids.filter((k) => !k.takenOver && (k.iAmLead ? stageOf(k.status) === "not_done" || k.status === "changes_requested" : k.partsOpen && k.myParts.some((p) => !p.done))).length;
  // Teachers count the reports they have written; the administrator counts the reports they have approved.
  // A teacher's own work: as lead, the report written; otherwise, every part of theirs sent to the lead.
  const finished = admin ? kids.filter((k) => k.status === "approved").length : kids.filter((k) => k.takenOver || (k.iAmLead ? k.hasReport : !(k.partsOpen && k.myParts.some((p) => !p.done)))).length;
  // Out of: for a teacher, every child; for the administrator, only the reports sent to them (waiting, sent back or
  // approved). Reports teachers have not sent yet are not the administrator's to review.
  const total = admin ? kids.filter((k) => stageOf(k.status) !== "not_done").length : kids.length;
  // A teacher's home is their own class; the administrator manages every class from Classes instead.
  // Teachers see their own reviews and finished reports; the administrator follows every report from Reports instead.
  const groups: Group[] = admin
    ? [
        {
          label: "Teaching",
          items: [
            { key: "classes", href: "/classes", label: "Classes", icon: "classes" },
            { key: "children", href: "/children", label: "Children", icon: "children" },
            { key: "reports", href: "/reports", label: "Reports", icon: "reports", count: waiting },
            { key: "calendar", href: "/calendar", label: "Calendar", icon: "calendar" },
            { key: "teachers", href: "/teachers", label: "Teachers", icon: "people" },
          ],
        },
        {
          label: "Setup",
          items: [
            { key: "settings", href: "/settings", label: "Settings", icon: "settings" },
          ],
        },
      ]
    : [
        {
          label: "My class",
          items: [
            { key: "students", href: "/", label: "My classes", icon: "class" },
            { key: "reports", href: sentBack > 0 ? "/reports?show=changes" : "/reports", label: "Children’s reports", icon: "reports", count: stillToDo },
            { key: "calendar", href: "/calendar", label: "My calendar", icon: "calendar" },
          ],
        },
        { label: "Account", items: [{ key: "settings", href: "/settings", label: "Settings", icon: "settings" }] },
      ];
  const items = groups.flatMap((g) => g.items);
  // The phone bar has room for six. The administrator reaches Teachers from Settings there.
  const phoneItems = items.filter((i) => i.key !== "teachers");
  const togo = total - finished;
  const doneHref = admin ? "/reports?status=approved" : "/reports?show=ready";
  const progressTitle = admin ? "Review progress" : togo === 0 ? "All done" : "Report progress";
  const progressNote = admin
    ? waiting > 0
      ? `${waiting} ${waiting === 1 ? "report" : "reports"} to review`
      : togo === 0
        ? "All sent reports approved"
        : "Nothing to review now"
    : togo === 0
      ? "See your reports"
      : `${togo} ${togo === 1 ? "child" : "children"} still to do`;
  const progressHref = admin ? (waiting > 0 ? "/reports?status=waiting" : doneHref) : togo === 0 ? doneHref : "/reports";

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
                    <span className={cn("rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground", collapsed ? "absolute right-1 top-1 px-1.5 text-[10px] leading-4" : "ml-auto")} aria-label={`${it.count} ${admin ? "waiting for review" : it.count === 1 ? "report still to finish" : "reports still to finish"}`}>
                      {it.count}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <span className="flex-1" />

        {total > 0 && (
          <Link
            href={progressHref}
            title={collapsed ? `${finished} of ${total} ${admin ? "reports sent for review are approved" : "reports written"}` : undefined}
            className={cn("group mx-3 mb-3 flex items-center gap-3 rounded-xl border bg-card p-3 outline-none transition-colors hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50", collapsed && "mx-2 justify-center p-2")}
          >
            <span className="relative grid size-11 shrink-0 place-items-center">
              <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="22" cy="22" r="19" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle cx="22" cy="22" r="19" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(finished / total) * 119.4} 119.4`} />
              </svg>
              <span className="text-xs font-bold">
                {finished}/{total}
              </span>
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-sm font-bold">{progressTitle}</span>
                <span className="block truncate text-xs text-muted-foreground">{progressNote}</span>
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

      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden" style={{ gridTemplateColumns: `repeat(${phoneItems.length}, 1fr)` }} aria-label="Main">
        {phoneItems.map((it) => (
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
