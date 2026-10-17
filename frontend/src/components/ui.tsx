import { STATUS_LABEL, type Level, type ReviewStatus } from "@peterhouse/shared";
import { levelWord } from "@peterhouse/shared";

export function StatusPill({ status }: { status: ReviewStatus }) {
  return <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>;
}

/** Five square marks plus the word: never colour alone. */
export function Marks({ level, showWord = true }: { level: Level; showWord?: boolean }) {
  return (
    <span className="row" style={{ gap: 8, display: "inline-flex" }}>
      {level > 0 && (
        <span className="marks" aria-hidden>
          {[1, 2, 3, 4, 5].map((i) => (
            <i key={i} className={i <= level ? "on" : ""} />
          ))}
        </span>
      )}
      {showWord && <span className={level === 0 ? "muted" : ""}>{levelWord(level)}</span>}
    </span>
  );
}

/** The child's cover photo, or a Peterhouse pattern tile with their initial. */
export function ChildAvatar({ photoId, name, size = 40 }: { photoId?: number | null; name: string; size?: number }) {
  if (photoId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/photos/${photoId}`} alt="" className="avatar" style={{ width: size, height: size }} />;
  }
  return (
    <span className="tile" style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden>
      <span>{name.charAt(0).toUpperCase()}</span>
    </span>
  );
}

/** One pip per learning area: full, half or empty. Words live in the label, not colour alone. */
export function AreaPips({ areas }: { areas: { name: string; answered: number; total: number }[] }) {
  const done = areas.filter((a) => a.answered === a.total).length;
  return (
    <span className="pips" role="img" aria-label={`${done} of ${areas.length} learning areas finished`}>
      {areas.map((a) => (
        <i key={a.name} className={a.answered === a.total ? "full" : a.answered > 0 ? "part" : ""} title={`${a.name}: ${a.answered}/${a.total}`} />
      ))}
    </span>
  );
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  const sameDay = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  if (sameDay) return time;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${time}`;
}

export function ProgressBar({ counts, total }: { counts: Partial<Record<ReviewStatus, number>>; total: number }) {
  const colours: Record<ReviewStatus, string> = {
    approved: "var(--brand)",
    written: "var(--rose)",
    ready: "var(--crest-gold)",
    draft: "var(--sky-mid)",
    not_started: "transparent",
  };
  return (
    <div className="bar" role="img" aria-label={Object.entries(counts).map(([k, v]) => `${v} ${STATUS_LABEL[k as ReviewStatus]}`).join(", ")}>
      {(["approved", "written", "ready", "draft"] as ReviewStatus[]).map((s) =>
        counts[s] ? <span key={s} style={{ width: `${(100 * counts[s]!) / Math.max(1, total)}%`, background: colours[s] }} /> : null,
      )}
    </div>
  );
}
