// Hand-built flat illustrations for the family report, drawn in the Peterhouse palette with a thick navy "crayon" outline.
const RED = "#ae1d25";
const GOLD = "#fdcb40";
const SKY = "#94cae5";
const BLUSH = "#f5ccce";
const NAVY = "#091f34";
const LEAF = "#6bb36e";

const FRED = "var(--font-fredoka), var(--font-noto-sc), sans-serif";
const ZCOOL = "var(--font-zcool), var(--font-noto-sc), sans-serif";
const line = { stroke: NAVY, strokeWidth: 4, strokeLinejoin: "round", strokeLinecap: "round" } as const;

const STAR = "M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z";

/** A sticker star: gold when earned, an empty outline when not. */
export function Star({ on, size = 17 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d={STAR} fill={on ? GOLD : "#fff"} stroke={on ? "#b78a12" : "#d6c9ad"} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function Sparkle({ className, color }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d={STAR} fill={color ?? "currentColor"} />
    </svg>
  );
}

export function SunFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <g stroke={GOLD} strokeWidth="9" strokeLinecap="round">
        <path d="M162 100H190M153.7 131L178 145M131 153.7L145 178M100 162V190M69 153.7L55 178M46.3 131L22 145M38 100H10M46.3 69L22 55M69 46.3L55 22M100 38V10M131 46.3L145 22M153.7 69L178 55" />
      </g>
      <circle cx="100" cy="100" r="46" fill={GOLD} {...line} />
      <circle cx="86" cy="94" r="4.5" fill={NAVY} />
      <circle cx="114" cy="94" r="4.5" fill={NAVY} />
      <path d="M84 112c8 10 24 10 32 0" fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** The learning area's picture. Areas the school adds later get a friendly star. */
export function Illustration({ k, className }: { k: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      {PICTURES[k] ?? PICTURES.default}
    </svg>
  );
}

const PICTURES: Record<string, React.ReactNode> = {
  // English: an open book and three letter blocks.
  eng: (
    <>
      <g {...line}>
        <path d="M100 78C80 64 48 64 26 72V156C48 148 80 148 100 160Z" fill="#fff" />
        <path d="M100 78C120 64 152 64 174 72V156C152 148 120 148 100 160Z" fill="#fff" />
        <path d="M100 78V160" fill="none" />
        <g fill="none" stroke={SKY}>
          <path d="M42 92H82M42 106H82M42 120H70" />
          <path d="M118 92H158M118 106H158M118 120H146" />
        </g>
        <g transform="rotate(-10 48 38)">
          <rect x="30" y="20" width="36" height="36" rx="9" fill={GOLD} />
        </g>
        <rect x="84" y="8" width="36" height="36" rx="9" fill={BLUSH} />
        <g transform="rotate(9 150 36)">
          <rect x="132" y="18" width="36" height="36" rx="9" fill="#fff" />
        </g>
      </g>
      <g fontFamily={FRED} fontWeight="700" fontSize="24" fill={NAVY} textAnchor="middle">
        <text x="48" y="46" transform="rotate(-10 48 38)">A</text>
        <text x="102" y="35">b</text>
        <text x="150" y="45" transform="rotate(9 150 36)">c</text>
      </g>
    </>
  ),
  // Chinese: a red paper lantern.
  chi: (
    <>
      <g {...line}>
        <path d="M100 40V20" fill="none" />
        <ellipse cx="100" cy="106" rx="58" ry="48" fill={RED} />
        <path d="M100 58C74 76 74 136 100 154M100 58C126 76 126 136 100 154" fill="none" stroke="#6e1118" strokeWidth="3" />
        <rect x="76" y="40" width="48" height="14" rx="5" fill={GOLD} />
        <rect x="76" y="154" width="48" height="14" rx="5" fill={GOLD} />
        <path d="M100 168V192M90 168V188M110 168V188" fill="none" stroke={GOLD} />
        <path d="M34 50l4 9 10 1-8 7 2 10-8-6-8 6 2-10-8-7 10-1z" fill={GOLD} strokeWidth="3" />
        <circle cx="168" cy="64" r="7" fill="#fff" strokeWidth="3" />
        <circle cx="24" cy="150" r="5" fill="#fff" strokeWidth="3" />
      </g>
      <text x="100" y="124" textAnchor="middle" fontFamily={ZCOOL} fontSize="50" fill={GOLD}>华</text>
    </>
  ),
  // Maths: number blocks, a circle and a triangle.
  mat: (
    <>
      <g {...line}>
        <rect x="30" y="118" width="64" height="64" rx="10" fill={SKY} />
        <rect x="98" y="118" width="64" height="64" rx="10" fill={BLUSH} />
        <rect x="64" y="54" width="64" height="64" rx="10" fill={RED} />
        <circle cx="96" cy="30" r="17" fill="#fff" />
        <path d="M152 182l16-32 16 32z" fill="#fff" />
      </g>
      <g fontFamily={FRED} fontWeight="700" fontSize="38" textAnchor="middle">
        <text x="62" y="162" fill={NAVY}>1</text>
        <text x="130" y="162" fill={NAVY}>2</text>
        <text x="96" y="98" fill="#fff">3</text>
      </g>
    </>
  ),
  // Social-emotional: two friends and a heart.
  sed: (
    <>
      <g {...line}>
        <circle cx="62" cy="122" r="40" fill={GOLD} />
        <circle cx="138" cy="122" r="40" fill={BLUSH} />
        <path d="M100 78C60 54 74 22 100 40C126 22 140 54 100 78Z" fill={RED} />
        <path d="M46 134Q62 150 78 134" fill="none" />
        <path d="M122 134Q138 150 154 134" fill="none" />
      </g>
      <g fill={NAVY}>
        <circle cx="50" cy="114" r="4.5" />
        <circle cx="74" cy="114" r="4.5" />
        <circle cx="126" cy="114" r="4.5" />
        <circle cx="150" cy="114" r="4.5" />
      </g>
      <g fill={RED} opacity=".35">
        <circle cx="40" cy="128" r="6" />
        <circle cx="84" cy="128" r="6" />
        <circle cx="116" cy="128" r="6" />
        <circle cx="160" cy="128" r="6" />
      </g>
    </>
  ),
  // Self-enrichment: a paint palette and a music note.
  enr: (
    <g {...line}>
      <path d="M38 112C24 72 70 40 110 46C158 54 168 112 144 140C130 156 114 138 104 146C92 156 104 178 76 170C48 162 46 136 38 112Z" fill="#fff" />
      <circle cx="76" cy="84" r="11" fill={RED} />
      <circle cx="108" cy="72" r="11" fill={GOLD} />
      <circle cx="138" cy="96" r="11" fill={SKY} />
      <circle cx="64" cy="118" r="11" fill={LEAF} />
      <path d="M170 82V34L192 40" fill="none" />
      <circle cx="162" cy="84" r="9" fill={NAVY} />
    </g>
  ),
  default: (
    <g {...line}>
      <path d="M100 28l20 48 50 6-38 34 12 52-44-28-44 28 12-52-38-34 50-6z" fill={GOLD} />
    </g>
  ),
};

/** A little house for "Ideas to try at home". */
export function House({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden>
      <g stroke={NAVY} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M4 18L18 5l14 13" fill={RED} />
        <path d="M7 17v15h22V17" fill="#fff" />
        <rect x="15" y="22" width="7" height="10" rx="2" fill={GOLD} />
      </g>
    </svg>
  );
}

export function Pencil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </svg>
  );
}
