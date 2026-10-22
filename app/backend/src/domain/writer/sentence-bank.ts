// Option C: assemble paragraphs from pre-written sentences in the school's
// voice. Fully offline. Also the automatic fallback when AI is unavailable.
//
// Each question is a statement ("{name} listens well and responds in a group."), so a sentence is the statement
// with the score's tone around it: 4–5 celebrate, 3 is steady, 1–2 are gentle, and "not seen yet" is never
// described as a weakness.

import { isYoungLevel, scoreOf, skillPhrase, type Pronoun, type Skill } from "@peterhouse/shared";
import type { ReviewForWriting } from "../anonymise";
import type { WrittenDraft } from "./types";

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const SUBJECT: Record<Pronoun, string> = { she: "she", he: "he" };
const OBJECT: Record<Pronoun, string> = { she: "her", he: "him" };
const POSSESSIVE: Record<Pronoun, string> = { she: "her", he: "his" };
const MODALS = new Set(["can", "could", "will", "would", "may", "might", "must", "should", "is", "are", "has"]);
const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** "listens well" + "confidently" → "confidently listens well"; "can say how she feels" → "can confidently say how she feels". */
const FEELING_VERBS = new Set(["enjoys", "loves", "likes"]);

export function withAdverb(phrase: string, adverb: string): string {
  const [first, ...rest] = phrase.split(" ");
  // "confidently enjoys stories" reads oddly; feelings are "really" enjoyed.
  if (adverb === "now" && !MODALS.has(first.toLowerCase())) return `now ${phrase}`;
  if (FEELING_VERBS.has(first.toLowerCase()) && ["confidently", "independently", "regularly"].includes(adverb)) return `${adverb === "regularly" ? "often" : "really"} ${phrase}`;
  if (MODALS.has(first.toLowerCase()) && rest.length) return `${first} ${adverb} ${rest.join(" ")}`;
  return `${adverb} ${phrase}`;
}

/**
 * The sentences for one statement at one score, still using [Child]. `who` is the pronoun for sentences that
 * need one mid-way ("…show that she listens…").
 */
export function sentencesFor(skill: Skill, level: number, pronoun: Pronoun, young = false): string[] {
  const p = skillPhrase(skill, pronoun);
  const who = SUBJECT[pronoun];
  // The youngest (PG, N1) are growing into everything: no "inspires friends" for a two-year-old (change 8).
  if (young && level >= 4) {
    return [`[Child] is growing in confidence here: ${who} ${withAdverb(p, "now")}.`, `We have loved watching [Child] grow: more and more, ${who} ${p}.`];
  }
  switch (level) {
    case 1:
      return [`[Child] does not yet show that ${who} ${p}, and still needs an adult's help here.`, `This is hard for [Child] at the moment: ${who} does not yet show that ${who} ${p} without an adult alongside.`];
    case 2:
      return [`[Child] ${withAdverb(p, "sometimes")}, but only with reminders and not yet on ${POSSESSIVE[pronoun]} own.`, `With prompting, [Child] sometimes shows that ${who} ${p}, but not yet reliably.`];
    case 3:
      return [`[Child] ${withAdverb(p, "regularly")}.`, `In familiar routines, [Child] ${p}.`, `We often see that [Child] ${p}.`];
    case 4:
      return [`[Child] ${withAdverb(p, "confidently")}.`, `We have loved seeing how easily [Child] ${p}.`, `[Child] ${withAdverb(p, "now")}, in all sorts of situations.`];
    default:
      return [`[Child] really shines here: ${who} ${p}, and often inspires friends too.`, `It has been a joy to see how [Child] ${p}, all on ${POSSESSIVE[pronoun]} own.`, `[Child] ${withAdverb(p, "independently")}, often helping others too.`];
  }
}

function hash(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

function cleanQuote(s: string) {
  return s.trim().replace(/[.!。！\s]+$/u, "");
}

/** "Loved the slide" becomes "[Child] loved the slide"; anything else is quoted as written. */
function lovedSentence(h: string) {
  const t = cleanQuote(h);
  if (!t) return "";
  if (/^(loved|enjoyed|liked|adored|was|has|had|became|built|made|took|spent|discovered|found|learnt|learned|shared|led)\b/i.test(t))
    return `One highlight stands out: [Child] ${lowerFirst(t)}.`;
  return `What [Child] loved most this semester: ${t}.`;
}

export function writeWithSentenceBank(review: ReviewForWriting, seed: string): WrittenDraft {
  const { rubric, answers, pronoun } = review;
  const Subject = SUBJECT[pronoun].charAt(0).toUpperCase() + SUBJECT[pronoun].slice(1);
  const areas: Record<string, string> = {};
  let notObserved = 0;
  let total = 0;
  let loved = "";
  for (const area of rubric.areas) {
    const ans = answers[area.key];
    const sentences: string[] = [];
    const start = hash(`${seed}:${area.key}`);
    area.skills.forEach((skill, i) => {
      total++;
      const level = scoreOf(ans, skill.key);
      if (level === 0) {
        notObserved++;
        return;
      }
      // Rotate through the variants so neighbouring sentences start differently.
      const options = sentencesFor(skill, level, pronoun, isYoungLevel(review.level));
      const opener = (x: string) => x.split(" ").slice(0, 2).join(" ");
      const prev = sentences[sentences.length - 1];
      let pickIdx = (start + i) % options.length;
      for (let tries = 0; prev && tries < options.length && opener(options[pickIdx]) === opener(prev); tries++) pickIdx = (pickIdx + 1) % options.length;
      let s = options[pickIdx];
      // After the first sentence, use the pronoun at the start.
      if (sentences.length % 2 === 1) s = s.replace(/^\[Child\] /, `${Subject} `);
      sentences.push(s);
    });
    const para: string[] = [];
    if (!sentences.length) {
      para.push(`We are still getting to know [Child] in ${area.name}, and look forward to sharing more next semester.`);
    } else {
      para.push(...sentences);
      if (sentences.length < area.skills.length) para.push(`We are still getting to know [Child] in some parts of ${area.name}.`);
    }
    if (ans?.note?.trim()) para.push(`One moment we noticed: ${lowerFirst(cleanQuote(ans.note))}.`);
    // The teacher's suggestion always ends the area.
    if (sentences.length) {
      const plans = [
        `Next term, we will keep offering hands-on ${area.name} activities that build on what [Child] enjoys.`,
        `To help ${OBJECT[pronoun]} grow here, we will give [Child] more chances to practise ${area.name} in small groups.`,
        `In class, we will encourage [Child] to talk about ${POSSESSIVE[pronoun]} thinking in ${area.name} in ${POSSESSIVE[pronoun]} own words.`,
        `We will now focus on short, playful ${area.name} activities each day to build ${POSSESSIVE[pronoun]} confidence.`,
      ];
      para.push(plans[rubric.areas.indexOf(area) % plans.length]);
    }
    if (area.love && ans?.love?.trim()) loved = ans.love;
    areas[area.key] = para.filter(Boolean).join(" ");
  }

  const settling = notObserved >= Math.ceil(total / 3);
  const opening = [
    settling
      ? `[Child] has been settling in at school this semester, and the team has loved getting to know ${OBJECT[pronoun]}.`
      : `It has been a happy and busy semester for [Child].`,
    loved ? lovedSentence(loved) : "",
    `This review shares what we have seen [Child] enjoy and achieve across ${NUMBER_WORDS[rubric.areas.length] ?? "the"} areas of learning, with a few ideas for supporting learning at home.`,
    `We hope you enjoy reading about ${POSSESSIVE[pronoun]} semester as much as we enjoyed sharing it.`,
  ]
    .filter(Boolean)
    .join(" ");

  const skillInfo = new Map(rubric.areas.flatMap((a) => a.skills.map((s) => [s.key, { skill: s, area: a, level: scoreOf(answers[a.key], s.key) }] as const)));
  const strengthClauses = review.strengths
    .map((k) => skillInfo.get(k))
    .filter((x): x is NonNullable<typeof x> => !!x && x.level > 0)
    .map((x) => skillPhrase(x.skill, pronoun));
  const nextAreas = [...new Set(review.nextSteps.map((k) => skillInfo.get(k)?.area.name).filter((x): x is string => !!x))];
  const closing = [
    strengthClauses.length === 2
      ? `We have especially loved seeing how [Child] ${strengthClauses[0]}, and how ${SUBJECT[pronoun]} ${strengthClauses[1]}.`
      : strengthClauses.length === 1
        ? `We have especially loved seeing how [Child] ${strengthClauses[0]}.`
        : `[Child] has had a lovely semester.`,
    nextAreas.length ? `Next semester we will gently support ${POSSESSIVE[pronoun]} next steps in ${nextAreas.join(" and ")}, with plenty of encouragement and play.` : "",
    `Thank you for your warm partnership; together we will keep nurturing ${POSSESSIVE[pronoun]} curiosity and confidence.`,
  ]
    .filter(Boolean)
    .join(" ");

  // The teacher's picks replace these (see writeDraft); this is only for when none were picked.
  const homeIdeas = (rubric.areas.find((a) => a.homeIdeas?.length)?.homeIdeas ?? []).slice(0, 2);

  return { opening, areas, closing, homeIdeas };
}
