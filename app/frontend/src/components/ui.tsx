import { STATUS_LABEL, type Level, type ReviewStatus } from "@peterhouse/shared";
import { levelWord } from "@peterhouse/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: ReviewStatus }) {
  return <Badge variant="outline">{STATUS_LABEL[status]}</Badge>;
}

/** Five square marks plus the word: never colour alone, never the number. */
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

/** "Mia Tan" → "MT"; "Mia" → "MI". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (([...words[0]][0] ?? "") + ([...words[1]][0] ?? "")).toUpperCase();
  return [...(words[0] ?? "")].slice(0, 2).join("").toUpperCase();
}

/** The child's cover photo, or their initials. */
export function ChildAvatar({ photoId, name, size = 40 }: { photoId?: number | null; name: string; size?: number }) {
  return (
    <Avatar style={{ width: size, height: size }} className="bg-secondary">
      {photoId ? <AvatarImage src={`/api/photos/${photoId}`} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-secondary font-heading font-semibold text-muted-foreground" style={{ fontSize: Math.max(11, size * 0.34) }} aria-hidden>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** One pip per domain: full, half or empty. Words live in the label, not colour alone. */
export function AreaPips({ areas }: { areas: { name: string; answered: number; total: number }[] }) {
  const done = areas.filter((a) => a.answered === a.total).length;
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${done} of ${areas.length} learning areas finished`}>
      {areas.map((a) => (
        <i
          key={a.name}
          className={cn("block h-1.5 w-3.5 rounded-full bg-border", a.answered === a.total ? "bg-primary" : a.answered > 0 && "bg-[linear-gradient(90deg,var(--primary)_50%,var(--border)_50%)]")}
          title={`${a.name}: ${a.answered}/${a.total}`}
        />
      ))}
    </span>
  );
}

/** A small ring showing how much of a child's review is rated. */
export function ProgressRing({ answered, total }: { answered: number; total: number }) {
  const c = 2 * Math.PI * 9;
  return (
    <svg viewBox="0 0 26 26" width="26" height="26" role="img" aria-label={`${answered} of ${total} rated`}>
      <circle cx="13" cy="13" r="9" fill="none" stroke="var(--border)" strokeWidth="3.5" />
      <circle cx="13" cy="13" r="9" fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(answered / Math.max(1, total)) * c} ${c}`} transform="rotate(-90 13 13)" />
    </svg>
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
