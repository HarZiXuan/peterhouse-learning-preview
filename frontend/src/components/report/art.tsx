// Hand-built flat illustrations for the report, drawn in the Peterhouse palette.
const RED = "#ae1d25";
const GOLD = "#fdcb40";
const SKY = "#94cae5";
const NAVY = "#091f34";
const LEAF = "#6bb36e";

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M20 2c1.6 9.4 8.6 16.4 18 18-9.4 1.6-16.4 8.6-18 18-1.6-9.4-8.6-16.4-18-18C11.4 18.4 18.4 11.4 20 2z" fill="currentColor" />
    </svg>
  );
}

export function SunRays({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <g stroke={GOLD} strokeWidth="9" strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          // Rounded so server and browser print identical numbers (no hydration mismatch).
          const pt = (r: number, f: (x: number) => number) => Math.round((100 + f(a) * r) * 100) / 100;
          return <line key={i} x1={pt(62, Math.cos)} y1={pt(62, Math.sin)} x2={pt(90, Math.cos)} y2={pt(90, Math.sin)} />;
        })}
      </g>
      <circle cx="100" cy="100" r="46" fill={GOLD} />
      <circle cx="86" cy="94" r="4.5" fill={NAVY} />
      <circle cx="114" cy="94" r="4.5" fill={NAVY} />
      <path d="M84 112c8 10 24 10 32 0" fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

const stroke = { stroke: NAVY, strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function AreaIcon({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      {ICONS[k] ?? ICONS.default}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  communication: (
    <g {...stroke}>
      <path d="M8 12h30a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H22l-8 7v-7H8a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="#fff" />
      <path d="M30 28h26a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-4v7l-8-7H30a4 4 0 0 1-4-4V32a4 4 0 0 1 4-4z" fill={GOLD} />
      <circle cx="14" cy="23" r="1.6" fill={NAVY} />
      <circle cx="22" cy="23" r="1.6" fill={NAVY} />
      <circle cx="30" cy="23" r="1.6" fill={NAVY} />
    </g>
  ),
  literacy: (
    <g {...stroke}>
      <path d="M32 16c-6-4-15-5-26-3v37c11-2 20-1 26 3 6-4 15-5 26-3V13c-11-2-20-1-26 3z" fill="#fff" />
      <path d="M32 16v37" />
      <path d="M12 22c5-1 10 0 15 2M12 30c5-1 10 0 15 2M37 24c5-2 10-3 15-2M37 32c5-2 10-3 15-2" fill="none" />
      <path d="M44 13v13l4-3 4 3V12" fill={RED} />
    </g>
  ),
  mathematics: (
    <g {...stroke}>
      <circle cx="19" cy="21" r="12" fill={GOLD} />
      <rect x="35" y="9" width="21" height="21" rx="3" fill={RED} />
      <path d="M8 56l13-22 13 22z" fill={SKY} />
      <path d="M44 38v18M35 47h18" fill="none" />
    </g>
  ),
  psed: (
    <g {...stroke}>
      <path d="M32 55C13 43 7 33 7 23a12.5 12.5 0 0 1 25-3 12.5 12.5 0 0 1 25 3c0 10-6 20-25 32z" fill={RED} />
      <circle cx="24" cy="26" r="2" fill="#fff" stroke="none" />
      <circle cx="40" cy="26" r="2" fill="#fff" stroke="none" />
      <path d="M24 34c4 5 12 5 16 0" fill="none" stroke="#fff" />
    </g>
  ),
  physical: (
    <g {...stroke}>
      <circle cx="38" cy="30" r="19" fill={GOLD} />
      <path d="M22 21c10 5 22 5 32 0M22 39c10-5 22-5 32 0M38 11c-6 11-6 27 0 38" fill="none" />
      <path d="M4 22h9M1 31h12M6 40h9" fill="none" />
    </g>
  ),
  world: (
    <g {...stroke}>
      <circle cx="32" cy="32" r="23" fill={SKY} />
      <path d="M17 20c5-4 11-3 13 1s-2 7-5 9-3 6-8 5c-3-5-3-11 0-15z" fill={LEAF} />
      <path d="M38 36c4-3 10-2 11 3s-3 11-8 11-6-9-3-14z" fill={LEAF} />
      <path d="M40 14c3 0 6 1 8 3" fill="none" />
    </g>
  ),
  creative: (
    <g {...stroke}>
      <path d="M32 8C17 8 6 19 6 32s11 24 24 24c5 0 6-3 4-6s-1-7 4-7h8c8 0 14-5 14-12C60 18 48 8 32 8z" fill="#fff" />
      <circle cx="20" cy="30" r="4.2" fill={RED} />
      <circle cx="30" cy="19" r="4.2" fill={GOLD} />
      <circle cx="43" cy="21" r="4.2" fill={SKY} />
      <circle cx="49" cy="33" r="4.2" fill={LEAF} />
    </g>
  ),
  default: (
    <g {...stroke}>
      <path d="M32 6l7 17 18 2-14 12 5 18-16-10-16 10 5-18L7 25l18-2z" fill={GOLD} />
    </g>
  ),
};
