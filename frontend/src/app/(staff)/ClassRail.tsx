"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@peterhouse/shared";
import { AreaPips, ChildAvatar } from "@/components/ui";

export type RailChild = {
  reviewId: number;
  name: string;
  answered: number;
  total: number;
  hasReport: boolean;
  coverPhotoId: number | null;
  areas: { name: string; answered: number; total: number }[];
};

const Icon = {
  board: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3.2" /><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
};

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/login";
}

export function ClassRail({ kids, className, period, user }: { kids: RailChild[]; className: string; period: string; user: SessionUser }) {
  const path = usePathname();
  const [q, setQ] = useState("");
  const activeId = Number(/^\/child\/(\d+)/.exec(path)?.[1] ?? 0);
  const onBoard = path === "/";
  const onSettings = path.startsWith("/settings");
  const shown = kids.filter((k) => k.name.toLowerCase().includes(q.trim().toLowerCase()));
  const finished = kids.filter((k) => k.hasReport).length;

  return (
    <>
      <aside className="rail">
        <Link href="/" className="rail-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/peterhouse-shield.png" alt="" />
          <span>
            Peterhouse
            <small>Learning Review</small>
          </span>
        </Link>

        <nav className="rail-nav" aria-label="Main">
          <Link href="/" aria-current={onBoard ? "page" : undefined}>
            {Icon.board}
            <span>
              Class board
              <small>
                {className || "My class"} · {period}
              </small>
            </span>
          </Link>
        </nav>

        <div className="rail-section">
          <h2>
            Children <span>{finished} of {kids.length} reports done</span>
          </h2>
          {kids.length > 6 && <input className="rail-search" type="search" placeholder="Find a child" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a child" />}
        </div>

        <nav className="rail-kids" aria-label="Children">
          <ul className="rail-list">
            {shown.map((k) => (
              <li key={k.reviewId}>
                <Link href={`/child/${k.reviewId}`} className="rail-child" aria-current={k.reviewId === activeId ? "page" : undefined}>
                  <ChildAvatar photoId={k.coverPhotoId} name={k.name} size={34} />
                  <span className="rail-name">
                    {k.name}
                    {k.hasReport ? <small>Report ready</small> : <AreaPips areas={k.areas} />}
                  </span>
                </Link>
              </li>
            ))}
            {kids.length === 0 && (
              <li className="rail-empty">No children yet. Use “Add a child” on the board.</li>
            )}
            {kids.length > 0 && shown.length === 0 && <li className="rail-empty">No child called “{q}”.</li>}
          </ul>
        </nav>

        <Link href="/settings" className="rail-foot" aria-current={onSettings ? "page" : undefined}>
          {Icon.settings}
          <span>Settings</span>
        </Link>
        <button type="button" className="rail-foot rail-logout" onClick={logout} title={user.email}>
          <span>Log out · {user.name}</span>
        </button>
      </aside>

      {/* Phones: a proper bottom tab bar */}
      <nav className="tabbar" aria-label="Main">
        <Link href="/" aria-current={onBoard || activeId > 0 ? "page" : undefined}>
          {Icon.board}
          <span>Class</span>
        </Link>
        <Link href="/settings" aria-current={onSettings ? "page" : undefined}>
          {Icon.settings}
          <span>Settings</span>
        </Link>
        <button type="button" className="tab-logout" onClick={logout}>
          {Icon.logout}
          <span>Log out</span>
        </button>
      </nav>
    </>
  );
}
