// Section 06: the writing service never learns who the child is.
//
// buildAnonymousPayload() is the ONLY way review data reaches a writer. It
// takes the review answers plus the school roster, and returns plain text in
// the shape of Teacher Questions v0.3, section 5: the pronoun, the semester,
// each domain's statements with their 1–5 score or "not seen yet", the
// name-scrubbed comment, the short answer and the home ideas picked, and the
// chosen strengths and next steps. It never receives the child's name,
// birthday, photo, class, teacher or school, so it cannot leak them.
// tests/anonymise.test.ts checks this.

import { classLevel, countChineseChars, countWords, isYoungLevel, scoreOf, semesterLabel, skillPhrase, type AreaAnswer, type ClassLevel, type Pronoun, type Rubric } from "@peterhouse/shared";

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

const HAN = /\p{Script=Han}/u;

function nameTokens(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    const full = n.trim();
    if (!full) continue;
    out.add(full);
    // 陈美雅: the given name 美雅 is used on its own too. Chinese names have no spaces to split on.
    const han = full.replace(/\s+/g, "");
    if (HAN.test(han) && [...han].length === 3) out.add([...han].slice(1).join(""));
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
      // Chinese is written without spaces, so a Chinese name is matched wherever it appears.
      const pattern = HAN.test(token)
        ? escapeRegExp(token)
        : common
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
  /** The child's level (PG … K2), so the writing suits the age. Not identifying: many children share it. */
  level?: ClassLevel;
  season: "June" | "December";
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
  const phrase = new Map(review.rubric.areas.flatMap((a) => a.skills.map((s) => [s.key, skillPhrase(s, review.pronoun)] as const)));
  const lines: string[] = [];
  lines.push(`pronoun: ${review.pronoun}`);
  lines.push(`semester: ${semesterLabel(review.season)}`);
  if (review.level) {
    const lv = classLevel(review.level);
    lines.push(`age group: ${lv.name} (turning ${lv.turns} this year)${isYoungLevel(review.level) ? ". Very young: keep the words simple, but still say plainly what the child cannot do yet." : ""} Never compare the child with other children.`);
  }
  let notObserved = 0;
  let total = 0;
  for (const area of review.rubric.areas) {
    const ans = review.answers[area.key];
    lines.push("");
    lines.push(`domain: ${area.name}${area.language === "zh" ? " (questions and paragraph in Chinese)" : ""}`);
    for (const s of area.skills) {
      total++;
      const score = scoreOf(ans, s.key);
      if (score === 0) notObserved++;
      lines.push(`- ${phrase.get(s.key)}: ${score === 0 ? "not seen yet" : score}`);
    }
    const note = ans?.note?.trim();
    if (note) lines.push(`comment (name-scrubbed): "${scrub(note)}"`);
    const love = ans?.love?.trim();
    if (area.love && love) lines.push(`${skillPhrase({ key: area.love.key, text: area.love.text }, review.pronoun).toLowerCase()} (name-scrubbed): "${scrub(love)}"`);
  }
  lines.push("");
  lines.push(`strengths: ${review.strengths.map((k) => phrase.get(k) ?? k).join("; ") || "none chosen"}`);
  lines.push(`next steps: ${review.nextSteps.map((k) => phrase.get(k) ?? k).join("; ") || "none chosen"}`);
  return { text: lines.join("\n"), replaced, blocked, notObservedCount: notObserved, totalSkills: total };
}

/** Put the name back on the school computer, after writing. */
export function restoreName(text: string, preferredName: string): string {
  // A paragraph written in Chinese gets Chinese words for the placeholders.
  if (countChineseChars(text) > 2 * countWords(text)) {
    return text.replace(/\[Child\]/g, preferredName).replace(/\[Friend\]/g, "同伴").replace(/\[Teacher\]/g, "老师").replace(/\[removed\]/g, "");
  }
  return text
    .replace(/\[Child\]/g, preferredName)
    .replace(/\[Friend\]s/g, "friends")
    .replace(/(^|[.!?]\s+)\[Friend\]/g, "$1A friend")
    .replace(/\[Friend\]/g, "a friend")
    .replace(/(^|[.!?]\s+)\[Teacher\]/g, "$1A teacher")
    .replace(/\[Teacher\]/g, "a teacher")
    .replace(/\[removed\]/g, "");
}
