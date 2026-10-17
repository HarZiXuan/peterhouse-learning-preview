// Option C: assemble paragraphs from pre-written sentences in the school's
// voice. Fully offline. Also the automatic fallback when AI is unavailable.

import { DEFAULT_LEVEL, type Pronoun, type Rubric, type Skill } from "@peterhouse/shared";
import type { ReviewForWriting } from "../anonymise";
import type { WrittenDraft } from "./types";

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const SUBJECT: Record<Pronoun, string> = { she: "she", he: "he", they: "they" };
const OBJECT: Record<Pronoun, string> = { she: "her", he: "him", they: "them" };
const POSSESSIVE: Record<Pronoun, string> = { she: "her", he: "his", they: "their" };
const IRREGULAR: Record<string, string> = { are: "is", have: "has", do: "does", go: "goes", were: "was" };

const MODALS = new Set(["can", "could", "will", "would", "may", "might", "must", "should", "shall"]);

function thirdPerson(verb: string) {
  if (MODALS.has(verb)) return verb;
  if (IRREGULAR[verb]) return IRREGULAR[verb];
  if (/(s|sh|ch|x|z|o)$/.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
}

/** Descriptors are written with "they"; make them agree with the child's pronoun. */
export function withPronoun(text: string, pronoun: Pronoun): string {
  if (pronoun === "they") return text;
  return text
    .replace(/\bthey (\w+)/g, (_, v: string) => `${SUBJECT[pronoun]} ${thirdPerson(v)}`)
    .replace(/\btheir\b/g, POSSESSIVE[pronoun])
    .replace(/\bthemselves\b/g, pronoun === "she" ? "herself" : "himself")
    .replace(/\bthem\b/g, OBJECT[pronoun]);
}

const MENTIONS_SUPPORT = /\b(help|helped|support|adult|with an adult)\b/i;

/** The default sentences for one skill at one level, derived from its descriptor. */
export function defaultSentences(skill: Skill, level: number): string[] {
  const raw = skill.descriptors[level - 1] ?? "";
  const d = lowerFirst(raw).replace(/\.$/, "");
  const supported = MENTIONS_SUPPORT.test(raw);
  switch (level) {
    case 1:
      return supported
        ? [`[Child] ${d}.`, `In short, happy moments, [Child] ${d}.`]
        : [`[Child] ${d}.`, `With gentle support, [Child] ${d}.`, `In short, happy moments, [Child] ${d}.`];
    case 2:
      return supported
        ? [`[Child] ${d}.`, `This term [Child] ${d}.`]
        : [`[Child] ${d}.`, `With a little help, [Child] ${d}.`, `This term [Child] ${d}.`];
    case 3:
      return [`[Child] ${d}.`, `This term [Child] ${d}.`, `We often see that [Child] ${d}.`];
    case 4:
      return [`[Child] ${d}.`, `[Child] now ${d}.`, `We have enjoyed seeing how [Child] ${d}.`];
    default:
      return [`[Child] ${d}.`, `It has been a joy to see how [Child] ${d}.`, `[Child] ${d}, often inspiring friends too.`];
  }
}

export function sentencesFor(rubric: Rubric, skill: Skill, level: number): string[] {
  const custom = rubric.sentenceBank[skill.key]?.[String(level)]?.filter((s) => s.trim());
  return custom && custom.length ? custom : defaultSentences(skill, level);
}

function hash(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/** Moments are either activities ("Circle time") or ways of playing ("With a friend"). */
function momentsSentence(moments: string[], pronoun: Pronoun) {
  const ways = moments.filter((m) => /^(with|in|on) /i.test(m)).map((m) => withPronoun(lowerFirst(m), pronoun));
  const activities = moments.filter((m) => !/^(with|in|on) /i.test(m)).map(lowerFirst);
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  if (activities.length && ways.length) return `We saw this especially during ${list(activities)}, and often ${list(ways)}.`;
  if (activities.length) return `We saw this especially during ${list(activities)}.`;
  if (ways.length) return `We saw this most often ${list(ways)}.`;
  return "";
}

/** "Loved the slide" becomes "[Child] loved the slide"; anything else is quoted as written. */
function highlightSentence(h: string) {
  const t = cleanQuote(h);
  if (!t) return "";
  if (/^(loved|enjoyed|liked|adored|was|has|had|became|built|made|took|spent|discovered|found|learnt|learned|shared|led)\b/i.test(t))
    return `One highlight stands out: [Child] ${lowerFirst(t)}.`;
  return `One highlight stands out: ${t.charAt(0).toUpperCase()}${t.slice(1)}.`;
}

function cleanQuote(s: string) {
  return s.trim().replace(/[.!\s]+$/, "");
}

/** Turns a teacher's short answer into a sentence, keeping their wording. */
function noteSentence(text: string | undefined, lead: string): string {
  const t = (text ?? "").trim().replace(/[.!?\s]+$/, "");
  if (!t) return "";
  return `${lead} ${lowerFirst(t)}.`;
}

export function writeWithSentenceBank(review: ReviewForWriting, seed: string): WrittenDraft {
  const { rubric, answers, pronoun } = review;
  const Subject = SUBJECT[pronoun].charAt(0).toUpperCase() + SUBJECT[pronoun].slice(1);
  const areas: Record<string, string> = {};
  let notObserved = 0;
  let total = 0;
  for (const area of rubric.areas) {
    const ans = answers[area.key];
    const sentences: string[] = [];
    const start = hash(`${seed}:${area.key}`);
    area.skills.forEach((skill, i) => {
      total++;
      const level = ans?.skills[skill.key]?.level ?? DEFAULT_LEVEL;
      if (level === 0) {
        notObserved++;
        return;
      }
      // Rotate through the variants so neighbouring sentences start differently.
      const options = sentencesFor(rubric, skill, level);
      const opener = (x: string) => x.split(" ").slice(0, 2).join(" ");
      const prev = sentences[sentences.length - 1];
      let pickIdx = (start + i) % options.length;
      for (let tries = 0; prev && tries < options.length && opener(options[pickIdx]) === opener(prev); tries++) pickIdx = (pickIdx + 1) % options.length;
      let s = options[pickIdx];
      // After the first sentence, use the pronoun at the start (not for "they", to keep verbs right).
      if (sentences.length % 2 === 1 && pronoun !== "they") s = s.replace(/^\[Child\] /, `${Subject} `);
      sentences.push(withPronoun(s, pronoun));
    });
    const para: string[] = [];
    if (!sentences.length) {
      para.push(`We are still getting to know [Child] in ${lowerFirst(area.name)}, and look forward to sharing more next term.`);
    } else {
      para.push(...sentences);
      if (sentences.length < area.skills.length) para.push(`We are still getting to know ${POSSESSIVE[pronoun]} interests in some parts of this area.`);
    }
    if (ans?.moments.length) para.push(momentsSentence(ans.moments, pronoun));
    if (ans?.note.trim()) para.push(`One moment we noticed: ${lowerFirst(cleanQuote(ans.note))}.`);
    areas[area.key] = para.filter(Boolean).join(" ");
  }

  const season = review.season;
  const settling = notObserved >= Math.ceil(total / 3);
  const opening = [
    settling
      ? `[Child] has been settling in at school this ${season} term, and the team has loved getting to know ${OBJECT[pronoun]}.`
      : `It has been a happy and busy ${season} term for [Child].`,
    highlightSentence(review.highlight),
    noteSentence(review.notes?.favourites, "At school, [Child] loves"),
    noteSentence(review.notes?.friends, "With friends,"),
    `This review shares what we have seen [Child] enjoy and achieve across the seven areas of the Cambridge Early Years programme, with a few ideas for supporting learning at home.`,
    `We hope you enjoy reading about ${POSSESSIVE[pronoun]} term as much as we enjoyed sharing it.`,
  ]
    .filter(Boolean)
    .join(" ");

  const skillInfo = new Map(
    rubric.areas.flatMap((a) => a.skills.map((s) => [s.key, { skill: s, area: a, level: answers[a.key]?.skills[s.key]?.level ?? DEFAULT_LEVEL }] as const)),
  );
  const strengthClauses = review.strengths
    .map((k) => skillInfo.get(k))
    .filter((x): x is NonNullable<typeof x> => !!x && x.level > 0)
    .map((x) => withPronoun(lowerFirst(x.skill.descriptors[x.level - 1]).replace(/\.$/, ""), pronoun));
  const nextAreas = [...new Set(review.nextSteps.map((k) => skillInfo.get(k)?.area.name).filter((x): x is string => !!x))];
  const closing = [
    strengthClauses.length === 2
      ? `We have especially loved seeing how [Child] ${strengthClauses[0]}, and how ${pronoun === "they" ? "[Child]" : SUBJECT[pronoun]} ${strengthClauses[1]}.`
      : strengthClauses.length === 1
        ? `We have especially loved seeing how [Child] ${strengthClauses[0]}.`
        : `[Child] has had a lovely term.`,
    noteSentence(review.notes?.growing, "[Child] is also working on"),
    nextAreas.length
      ? `Next term we will gently support ${POSSESSIVE[pronoun]} next steps in ${nextAreas.join(" and ")}, with plenty of encouragement and play.`
      : "",
    `Thank you for your warm partnership; together we will keep nurturing ${POSSESSIVE[pronoun]} curiosity and confidence.`,
  ]
    .filter(Boolean)
    .join(" ");

  const homeIdeas = [...review.nextSteps, ...review.strengths]
    .map((k) => skillInfo.get(k)?.skill.homeIdea)
    .filter((x): x is string => !!x)
    .slice(0, 2);

  return { opening, areas, closing, homeIdeas };
}
