// Section 06 "after writing, the system checks for…". Each problem becomes a
// gold flag beside the paragraph for the teacher to look at.

import { countChineseChars, countWords } from "@peterhouse/shared";

export const LENGTHS: Record<"opening" | "area" | "closing", [number, number]> = {
  opening: [70, 100],
  area: [100, 140],
  closing: [70, 100],
};
/** A paragraph written in Chinese is measured in characters. */
export const CHINESE_LENGTHS: Record<"opening" | "area" | "closing", [number, number]> = {
  opening: [140, 220],
  area: [180, 280],
  closing: [140, 220],
};

const COMPARISONS = [
  /\b(other|most|many|some) (children|kids|pupils|students|classmates)\b/i,
  /\bthan (his|her|their) (friends|peers|classmates)\b/i,
  /\b(peers|classmates)\b/i,
  /\b(the rest of|compared (to|with)) the (class|group)\b/i,
  /\b(best|top|worst) in the class\b/i,
  /\b(for (his|her|their) age|age[- ]appropriate|expected level)\b/i,
  /(其他|别的|其他的)(小朋友|孩子|同学)|同龄|全班(最|第一)|比(其他|别的)/,
];
/** Labels the Chinese paragraph must not use either (落后 is "behind", 笨 is "stupid"). */
const NEVER_USE_ZH = ["落后", "迟缓", "笨", "懒惰", "能力差", "很差", "不及格", "多动症", "自闭"];

const NUMBER_WORDS_SCORE = /\b(percent|per cent|score[sd]?|marks? out of|out of (five|ten|\d+)|level (one|two|three|four|five|\d))\b/i;

export function qualityFlags(
  text: string,
  kind: "opening" | "area" | "closing",
  opts: { neverUse: string[]; notObservedSkills?: string[]; rosterNames?: string[] },
): string[] {
  const flags: string[] = [];
  const nums = text.match(/\d+(?:[.,]\d+)?%?/g);
  if (nums) flags.push(`Contains a number (“${nums[0]}”). Check this is a concrete count, not a score.`);
  if (NUMBER_WORDS_SCORE.test(text)) flags.push("Sounds like a score or mark. Families should see words, never scores.");
  for (const word of NEVER_USE_ZH) if (text.includes(word)) flags.push(`Uses “${word}”, which is on the “never use” list.`);
  for (const word of opts.neverUse) {
    const re = new RegExp(`(?<![\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu");
    if (re.test(text)) flags.push(`Uses “${word}”, which is on the “never use” list.`);
  }
  if (COMPARISONS.some((re) => re.test(text))) flags.push("Seems to compare the child with other children.");
  for (const skill of opts.notObservedSkills ?? []) {
    if (text.toLowerCase().includes(skill.toLowerCase())) flags.push(`Mentions “${skill}”, which was not yet observed.`);
  }
  for (const n of opts.rosterNames ?? []) {
    if (n.length > 2 && new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, "u").test(text)) flags.push(`Mentions “${n}”, another person’s name.`);
  }
  if (/\[(Child|Friend|Teacher|removed)\]/.test(text)) flags.push("Contains a placeholder that was not filled in.");
  const chinese = countChineseChars(text) > 2 * countWords(text);
  const words = chinese ? countChineseChars(text) : countWords(text);
  const [min, max] = (chinese ? CHINESE_LENGTHS : LENGTHS)[kind];
  const unit = chinese ? "characters" : "words";
  if (words < Math.round(min * 0.85)) flags.push(`Quite short (${words} ${unit}; aim for ${min}–${max}).`);
  if (words > Math.round(max * 1.15)) flags.push(`Quite long (${words} ${unit}; aim for ${min}–${max}).`);
  return flags;
}
