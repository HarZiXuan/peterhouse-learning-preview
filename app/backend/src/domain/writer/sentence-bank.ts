// Option C: assemble paragraphs from pre-written sentences in the school's
// voice. Fully offline. Also the automatic fallback when AI is unavailable.
//
// Each question is a statement ("{name} listens well and responds in a group."), so a sentence is the statement
// with the score's tone around it: 4–5 celebrate, 3 is steady, 1–2 are gentle, and "not seen yet" is never
// described as a weakness.

import { isYoungLevel, scoreOf, skillPhrase, type Area, type AreaAnswer, type Pronoun, type Skill } from "@peterhouse/shared";
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

const ZH_SUBJECT: Record<Pronoun, string> = { she: "她", he: "他" };

/** "能听懂简单的华语指令" → "听懂简单的华语指令", so a sentence can put its own 能 or 还不能 in front. */
const zhCore = (p: string) => p.replace(/^(能够|能|会)/, "");

/** The Chinese sentences for one statement at one score, for an area written in Chinese. */
export function chineseSentencesFor(skill: Skill, level: number, pronoun: Pronoun, young = false): string[] {
  const core = zhCore(skillPhrase(skill, pronoun));
  const who = ZH_SUBJECT[pronoun];
  if (young && level >= 4) return [`[Child]越来越有信心，现在已经能${core}。`, `我们很高兴看到[Child]的进步：${who}现在能${core}了。`];
  switch (level) {
    case 1:
      return [`[Child]目前还不能${core}，仍需要老师在旁协助。`, `${core}对[Child]来说还比较难，${who}现在还需要老师一步一步地带着做。`];
    case 2:
      return [`在老师的提醒下，[Child]有时能${core}，但还不能独立做到。`, `[Child]偶尔能${core}，不过还需要老师经常提醒。`];
    case 3:
      return [`[Child]平时能${core}。`, `在熟悉的活动中，[Child]能${core}。`];
    case 4:
      return [`[Child]已经能很有信心地${core}。`, `[Child]能自如地${core}，表现得很有把握。`];
    default:
      return [`[Child]在这方面表现非常出色，能独立${core}。`, `[Child]不但能${core}，还常常乐意帮助身边的同伴。`];
  }
}

/** One Chinese paragraph for an area written in Chinese; it ends with what the teachers will do next. */
function chineseArea(area: Area, ans: AreaAnswer | undefined, pronoun: Pronoun, young: boolean, start: number, plan: number): { text: string; notObserved: number } {
  const who = ZH_SUBJECT[pronoun];
  const sentences: string[] = [];
  let notObserved = 0;
  area.skills.forEach((skill, i) => {
    const level = scoreOf(ans, skill.key);
    if (level === 0) return void notObserved++;
    const options = chineseSentencesFor(skill, level, pronoun, young);
    let s = options[(start + i) % options.length];
    if (sentences.length % 2 === 1) s = s.replace(/^\[Child\]/, who);
    sentences.push(s);
  });
  const name = area.subName ?? area.name;
  const para: string[] = [];
  if (!sentences.length) para.push(`我们还在认识[Child]在${name}方面的表现，下学期会和您分享更多。`);
  else {
    para.push(...sentences);
    if (notObserved) para.push(`${name}的其他方面，我们还在继续观察。`);
  }
  if (ans?.note?.trim()) para.push(`老师留意到：${cleanQuote(ans.note)}。`);
  if (sentences.length) {
    const plans = [
      `下学期，我们会多安排有趣的${name}活动，帮助[Child]继续进步。`,
      `为了帮助${who}，我们会在课堂上给[Child]更多用${name}表达的机会。`,
      `接下来，我们会每天和[Child]一起做一些简短有趣的${name}练习，增强${who}的信心。`,
      `我们会继续鼓励[Child]多听、多说、多读${name}。`,
    ];
    para.push(plans[plan % plans.length]);
  }
  return { text: para.join(""), notObserved };
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
    if (area.language === "zh") {
      const zh = chineseArea(area, ans, pronoun, isYoungLevel(review.level), start, rubric.areas.indexOf(area));
      areas[area.key] = zh.text;
      notObserved += zh.notObserved;
      total += area.skills.length;
      continue;
    }
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
    // A skill from an area written in Chinese is named by its area in the English closing.
    .map((x) => (x.area.language === "zh" ? `does well in ${x.area.name}` : skillPhrase(x.skill, pronoun)));
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
