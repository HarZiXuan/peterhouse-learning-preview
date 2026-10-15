// Section 06: the writing service never learns who the child is.
//
// buildAnonymousPayload() is the ONLY way review data reaches a writer. It
// takes the review answers plus the school roster, and returns plain text
// that contains: the "[Child]" placeholder, the pronoun, the term season,
// skill names and level words, the "what did you see?" ticks, name-scrubbed
// notes and highlight, and the chosen strengths and next steps. It never
// receives the child's name, birthday, photo, class, teacher or school, so it
// cannot leak them. tests/anonymise.test.ts checks this.

import { DEFAULT_LEVEL, type AreaAnswer, type Pronoun, type Rubric } from "./types";
import { levelWord } from "./calc";

export type Roster = {
  /** Every name the current child goes by (preferred and legal name parts). */
  child: string[];
  /** Every other child in the school, including siblings. */
  otherChildren: string[];
  /** Every staff member's name parts. */
  staff: string[];
  /** Any other names to remove, such as family members. */
  others?: string[];
};

// Names that are also everyday words are only replaced when capitalised,
// so "she may try" survives but "May built a tower" does not.
const COMMON_WORD_NAMES = new Set([
  "may", "joy", "sky", "rose", "hope", "grace", "faith", "summer", "april", "june", "august", "autumn",
  "angel", "sunny", "honey", "jade", "ruby", "amber", "lily", "daisy", "ivy", "will", "mark", "pat",
  "sue", "art", "bliss", "dawn", "eve", "glory", "happy", "harmony", "rain", "river", "star", "storm",
  "ms", "mr", "mrs", "miss", "teacher", "tan", "long", "young", "king", "ng", "an", "lee",
]);
// Too short or too common to scrub reliably on their own; still scrubbed as part of a full name.
const SKIP_ALONE = new Set(["ms", "mr", "mrs", "miss", "dr", "a", "an", "de", "la", "le", "van", "von", "bin", "binte", "bte", "s/o", "d/o"]);

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Seven or more digits, allowing spaces, dashes, dots and a leading +, e.g. +65 8028 9094.
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\d[\s.-]?){6,}\d/g;
const NRIC = /\b[STFGM]\d{7}[A-Z]\b/gi;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameTokens(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    const full = n.trim();
    if (!full) continue;
    out.add(full);
    for (const part of full.split(/[\s-]+/)) {
      const p = part.replace(/[.,]/g, "");
      if (p.length >= 2 && !SKIP_ALONE.has(p.toLowerCase())) out.add(p);
    }
  }
  // Longest first so "Mia Tan" is replaced before "Mia".
  return [...out].sort((a, b) => b.length - a.length);
}

export type ScrubResult = { text: string; replaced: number; blocked: number };

export function scrubText(text: string, roster: Roster): ScrubResult {
  let replaced = 0;
  let blocked = 0;
  let out = text.replace(EMAIL, () => (blocked++, "[removed]"));
  out = out.replace(NRIC, () => (blocked++, "[removed]"));
  out = out.replace(PHONE, (m) => {
    // Keep short everyday numbers such as "12 shells" or "2026".
    if (m.replace(/\D/g, "").length < 7) return m;
    blocked++;
    return "[removed]";
  });

  const groups: [string[], string][] = [
    [roster.child, "[Child]"],
    [roster.otherChildren, "[Friend]"],
    [[...roster.staff], "[Teacher]"],
    [roster.others ?? [], "[Friend]"],
  ];
  // The current child wins over a classmate with the same name.
  const childTokens = new Set(nameTokens(roster.child).map((t) => t.toLowerCase()));
  for (const [names, placeholder] of groups) {
    for (const token of nameTokens(names)) {
      if (placeholder !== "[Child]" && childTokens.has(token.toLowerCase())) continue;
      const common = COMMON_WORD_NAMES.has(token.toLowerCase());
      const flags = common ? "gu" : "giu";
      const pattern = common
        ? `(?<![\\p{L}\\[])${escapeRegExp(token.charAt(0).toUpperCase() + token.slice(1))}(?![\\p{L}\\]])`
        : `(?<![\\p{L}\\[])${escapeRegExp(token)}(?![\\p{L}\\]])`;
      out = out.replace(new RegExp(pattern, flags), () => (replaced++, placeholder));
    }
  }
  // Collapse "[Child] [Child]" left behind by a first name + surname.
  out = out.replace(/(\[(?:Child|Friend|Teacher)\])(\s+\1)+/g, "$1");
  return { text: out, replaced, blocked };
}

export type ReviewForWriting = {
  pronoun: Pronoun;
  season: "June" | "December";
  highlight: string;
  /** Extra whole-child answers: favourites, friends, growing. */
  notes?: Record<string, string>;
  rubric: Rubric;
  answers: Record<string, AreaAnswer>;
  strengths: string[];
  nextSteps: string[];
};

export type AnonymousPayload = {
  text: string;
  /** Total names replaced and contact details removed, for the teacher's information. */
  replaced: number;
  blocked: number;
  notObservedCount: number;
  totalSkills: number;
};

export function buildAnonymousPayload(review: ReviewForWriting, roster: Roster): AnonymousPayload {
  let replaced = 0;
  let blocked = 0;
  const scrub = (t: string) => {
    const r = scrubText(t, roster);
    replaced += r.replaced;
    blocked += r.blocked;
    return r.text;
  };

  const skillName = new Map(review.rubric.areas.flatMap((a) => a.skills.map((s) => [s.key, s.name] as const)));
  const lines: string[] = [];
  lines.push(`pronoun: ${review.pronoun}`);
  lines.push(`term: ${review.season}`);
  lines.push(`highlight: "${scrub(review.highlight.trim())}"`);
  const NOTE_LABEL: Record<string, string> = {
    favourites: "loves doing at school",
    friends: "play and friendships",
    growing: "is working on / what helps",
  };
  for (const [k, label] of Object.entries(NOTE_LABEL)) {
    const t = review.notes?.[k]?.trim();
    if (t) lines.push(`${label}: "${scrub(t)}"`);
  }
  let notObserved = 0;
  let total = 0;
  for (const area of review.rubric.areas) {
    const ans = review.answers[area.key];
    lines.push("");
    lines.push(area.name);
    const width = Math.max(...area.skills.map((s) => s.name.length)) + 2;
    area.skills.forEach((s) => {
      total++;
      const level = ans?.skills[s.key]?.level ?? DEFAULT_LEVEL;
      if (level === 0) notObserved++;
      lines.push(`  ${s.name} ${".".repeat(Math.max(2, width - s.name.length))} ${levelWord(level)}`);
    });
    // Moments and the note belong to the area as a whole.
    if (ans?.moments.length) lines.push(`  seen at: ${ans.moments.join(", ")}`);
    if (ans?.note.trim()) lines.push(`  teacher's observation: "${scrub(ans.note.trim())}"`);
  }
  lines.push("");
  lines.push(`strengths: ${review.strengths.map((k) => skillName.get(k) ?? k).join("; ") || "none chosen"}`);
  lines.push(`next steps: ${review.nextSteps.map((k) => skillName.get(k) ?? k).join("; ") || "none chosen"}`);
  return { text: lines.join("\n"), replaced, blocked, notObservedCount: notObserved, totalSkills: total };
}

/** Put the name back on the school computer, after writing. */
export function restoreName(text: string, preferredName: string): string {
  return text
    .replace(/\[Child\]/g, preferredName)
    .replace(/\[Friend\]s/g, "friends")
    .replace(/(^|[.!?]\s+)\[Friend\]/g, "$1A friend")
    .replace(/\[Friend\]/g, "a friend")
    .replace(/(^|[.!?]\s+)\[Teacher\]/g, "$1A teacher")
    .replace(/\[Teacher\]/g, "a teacher")
    .replace(/\[removed\]/g, "");
}
