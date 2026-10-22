import type { Area, Rubric, Skill } from "./types";
import { CLASS_LEVEL_KEYS, type ClassLevel } from "./classes";

// Teacher Questions v0.3, section 2: each class level has its own questions, stepping up from PG (turning 2) to K2
// (turning 6, the year before Primary 1). The wording is a placeholder for a Peterhouse teacher to approve: it is
// copied into the database on first start and the administrator edits it from there. Keys are `${area}_${level}_${n}`
// (mat_k2_1), so they never clash with the numbered keys the editor adds.

export const NEVER_USE = [
  "behind",
  "delayed",
  "delay",
  "poor",
  "fails",
  "failed",
  "failing",
  "weak",
  "below average",
  "lazy",
  "naughty",
  "disorder",
  "adhd",
  "autism",
  "autistic",
  "dyslexia",
  "dyslexic",
  "diagnosis",
  "diagnosed",
  "special needs",
  "slow learner",
];

export const DEFAULT_HOME_IDEAS = [
  "Read a picture book together at bedtime",
  "Count things together on walks or at the shops",
  "Sing a Chinese song or rhyme together",
  "Build something from recycled boxes",
  "Play outside together at the park",
  "Talk about feelings with a favourite toy",
];

export const DEFAULT_RUBRIC: Rubric = {
  version: 1,
  areas: [
    {
      key: "eng",
      name: "English",
      shortName: "English",
      icon: "eng",
      skills: [
        { key: "eng_pg_1", text: "{name} follows simple one-step instructions.", levels: ["PG"] },
        { key: "eng_pg_2", text: "{name} uses two or three words together to say what {he/she} wants.", levels: ["PG"] },
        { key: "eng_pg_3", text: "{name} joins in English songs and rhymes.", levels: ["PG"] },
        { key: "eng_pg_4", text: "{name} enjoys looking at picture books with an adult.", levels: ["PG"] },
        { key: "eng_n1_1", text: "{name} speaks in short sentences.", levels: ["N1"] },
        { key: "eng_n1_2", text: "{name} recognises and names most letters of the alphabet.", levels: ["N1"] },
        { key: "eng_n1_3", text: "{name} answers “who”, “what” and “where” questions about a story.", levels: ["N1"] },
        { key: "eng_n1_4", text: "{name} holds a crayon and draws lines and circles.", levels: ["N1"] },
        { key: "eng_n2_1", text: "{name} knows the sound each letter makes.", levels: ["N2"] },
        { key: "eng_n2_2", text: "{name} reads and spells simple three-letter words, such as “cat” and “pen”.", levels: ["N2"] },
        { key: "eng_n2_3", text: "{name} writes {his/her} own name and copies letters correctly.", levels: ["N2"] },
        { key: "eng_n2_4", text: "{name} retells a familiar story in order.", levels: ["N2"] },
        { key: "eng_n2_5", text: "{name} speaks in full sentences to share ideas.", levels: ["N2"] },
        { key: "eng_k1_1", text: "{name} reads simple sentences and common sight words.", levels: ["K1"] },
        { key: "eng_k1_2", text: "{name} blends sounds to read new words, including “sh”, “ch” and “st”.", levels: ["K1"] },
        { key: "eng_k1_3", text: "{name} writes words and short sentences with spaces between words.", levels: ["K1"] },
        { key: "eng_k1_4", text: "{name} answers questions about a story read aloud.", levels: ["K1"] },
        { key: "eng_k1_5", text: "{name} speaks clearly in front of the class.", levels: ["K1"] },
        { key: "eng_k2_1", text: "{name} reads short storybooks on {his/her} own, with expression.", levels: ["K2"] },
        { key: "eng_k2_2", text: "{name} understands what {he/she} reads and answers “why” and “how” questions about it.", levels: ["K2"] },
        { key: "eng_k2_3", text: "{name} writes three to five sentences with capital letters and full stops.", levels: ["K2"] },
        { key: "eng_k2_4", text: "{name} spells common words correctly.", levels: ["K2"] },
        { key: "eng_k2_5", text: "{name} uses new words and joins ideas with “and”, “because” and “but”.", levels: ["K2"] },
      ],
    },
    {
      key: "chi",
      name: "Chinese",
      shortName: "Chinese",
      subName: "华文",
      icon: "chi",
      skills: [
        { key: "chi_pg_1", text: "{name} understands simple instructions in Chinese.", levels: ["PG"] },
        { key: "chi_pg_2", text: "{name} joins in Chinese songs and rhymes.", levels: ["PG"] },
        { key: "chi_pg_3", text: "{name} says a few familiar Chinese words.", levels: ["PG"] },
        { key: "chi_n1_1", text: "{name} names everyday objects in Chinese.", levels: ["N1"] },
        { key: "chi_n1_2", text: "{name} answers simple questions in short Chinese phrases.", levels: ["N1"] },
        { key: "chi_n1_3", text: "{name} sings Chinese songs and rhymes from memory.", levels: ["N1"] },
        { key: "chi_n1_4", text: "{name} recognises a few simple characters, such as 人, 大 and 口.", levels: ["N1"] },
        { key: "chi_n2_1", text: "{name} speaks in short Chinese sentences.", levels: ["N2"] },
        { key: "chi_n2_2", text: "{name} recognises about fifty common Chinese characters.", levels: ["N2"] },
        { key: "chi_n2_3", text: "{name} traces and writes the basic strokes correctly.", levels: ["N2"] },
        { key: "chi_n2_4", text: "{name} retells a short story in Chinese with the help of pictures.", levels: ["N2"] },
        { key: "chi_k1_1", text: "{name} reads about a hundred and fifty common characters and short phrases.", levels: ["K1"] },
        { key: "chi_k1_2", text: "{name} writes simple characters in the correct stroke order.", levels: ["K1"] },
        { key: "chi_k1_3", text: "{name} reads and says Hanyu Pinyin initials and finals.", levels: ["K1"] },
        { key: "chi_k1_4", text: "{name} talks about a picture in full Chinese sentences.", levels: ["K1"] },
        { key: "chi_k2_1", text: "{name} reads short Chinese passages and simple storybooks.", levels: ["K2"] },
        { key: "chi_k2_2", text: "{name} writes words and short sentences in Chinese.", levels: ["K2"] },
        { key: "chi_k2_3", text: "{name} uses Hanyu Pinyin to read unfamiliar characters.", levels: ["K2"] },
        { key: "chi_k2_4", text: "{name} answers questions about a Chinese passage.", levels: ["K2"] },
        { key: "chi_k2_5", text: "{name} shares {his/her} own ideas and feelings in Chinese.", levels: ["K2"] },
      ],
    },
    {
      key: "mat",
      name: "Mathematics",
      shortName: "Maths",
      icon: "mat",
      skills: [
        { key: "mat_pg_1", text: "{name} sorts objects by colour, size or shape.", levels: ["PG"] },
        { key: "mat_pg_2", text: "{name} says “more” and “bigger” when comparing things.", levels: ["PG"] },
        { key: "mat_pg_3", text: "{name} counts from one to five with an adult.", levels: ["PG"] },
        { key: "mat_pg_4", text: "{name} fits shapes into a shape sorter or puzzle.", levels: ["PG"] },
        { key: "mat_n1_1", text: "{name} counts objects up to ten, one by one.", levels: ["N1"] },
        { key: "mat_n1_2", text: "{name} recognises the numerals one to ten.", levels: ["N1"] },
        { key: "mat_n1_3", text: "{name} names a circle, a square and a triangle.", levels: ["N1"] },
        { key: "mat_n1_4", text: "{name} copies and continues a simple pattern, such as red-blue-red-blue.", levels: ["N1"] },
        { key: "mat_n2_1", text: "{name} counts, reads and writes numbers to twenty.", levels: ["N2"] },
        { key: "mat_n2_2", text: "{name} says one more and one less than a number up to twenty.", levels: ["N2"] },
        { key: "mat_n2_3", text: "{name} adds two small groups by counting them all.", levels: ["N2"] },
        { key: "mat_n2_4", text: "{name} compares and orders things by length and size.", levels: ["N2"] },
        { key: "mat_n2_5", text: "{name} names flat shapes and describes their sides and corners.", levels: ["N2"] },
        { key: "mat_k1_1", text: "{name} counts, reads and writes numbers to a hundred, and counts in twos, fives and tens.", levels: ["K1"] },
        { key: "mat_k1_2", text: "{name} adds and subtracts within ten, and knows the number bonds to ten.", levels: ["K1"] },
        { key: "mat_k1_3", text: "{name} solves simple word problems with pictures.", levels: ["K1"] },
        { key: "mat_k1_4", text: "{name} tells the time to the hour and names the days of the week.", levels: ["K1"] },
        { key: "mat_k1_5", text: "{name} recognises coins and their values.", levels: ["K1"] },
        { key: "mat_k2_1", text: "{name} adds and subtracts within twenty without objects, and within a hundred using tens and ones.", levels: ["K2"] },
        { key: "mat_k2_2", text: "{name} solves one-step addition and subtraction word problems.", levels: ["K2"] },
        { key: "mat_k2_3", text: "{name} understands place value in tens and ones.", levels: ["K2"] },
        { key: "mat_k2_4", text: "{name} tells the time to the hour and half hour, and reads a calendar.", levels: ["K2"] },
        { key: "mat_k2_5", text: "{name} uses money to pay and work out change in simple sums.", levels: ["K2"] },
      ],
    },
    {
      key: "sed",
      name: "Social-Emotional Development",
      shortName: "Social",
      icon: "sed",
      skills: [
        { key: "sed_pg_1", text: "{name} settles into class and says goodbye to {his/her} parents happily.", levels: ["PG"] },
        { key: "sed_pg_2", text: "{name} shows {his/her} feelings and takes comfort from teachers.", levels: ["PG"] },
        { key: "sed_pg_3", text: "{name} plays alongside friends.", levels: ["PG"] },
        { key: "sed_pg_4", text: "{name} begins to follow the class routines.", levels: ["PG"] },
        { key: "sed_n1_1", text: "{name} takes turns and shares with reminders.", levels: ["N1"] },
        { key: "sed_n1_2", text: "{name} names basic feelings, such as happy, sad and angry.", levels: ["N1"] },
        { key: "sed_n1_3", text: "{name} tidies up and follows the class routines.", levels: ["N1"] },
        { key: "sed_n1_4", text: "{name} asks for help when {he/she} needs it.", levels: ["N1"] },
        { key: "sed_n2_1", text: "{name} shares and takes turns without reminders.", levels: ["N2"] },
        { key: "sed_n2_2", text: "{name} plays well with friends in small groups.", levels: ["N2"] },
        { key: "sed_n2_3", text: "{name} says how {he/she} feels and why.", levels: ["N2"] },
        { key: "sed_n2_4", text: "{name} shows kindness and cares for friends.", levels: ["N2"] },
        { key: "sed_k1_1", text: "{name} works with a group towards a shared goal.", levels: ["K1"] },
        { key: "sed_k1_2", text: "{name} solves small disagreements with words.", levels: ["K1"] },
        { key: "sed_k1_3", text: "{name} looks after {his/her} own belongings and finishes tasks on {his/her} own.", levels: ["K1"] },
        { key: "sed_k1_4", text: "{name} keeps trying when something is difficult.", levels: ["K1"] },
        { key: "sed_k2_1", text: "{name} follows instructions and works on {his/her} own for a sustained time.", levels: ["K2"] },
        { key: "sed_k2_2", text: "{name} leads and cooperates in group activities.", levels: ["K2"] },
        { key: "sed_k2_3", text: "{name} manages {his/her} feelings and calms down on {his/her} own.", levels: ["K2"] },
        { key: "sed_k2_4", text: "{name} shows responsibility and is ready for Primary One routines.", levels: ["K2"] },
      ],
    },
    {
      key: "enr",
      name: "Self-Enrichment",
      shortName: "Enrichment",
      icon: "enr",
      skills: [
        { key: "enr_pg_1", text: "{name} explores messy play, paint and play dough.", levels: ["PG"] },
        { key: "enr_pg_2", text: "{name} moves to music and joins in action songs.", levels: ["PG"] },
        { key: "enr_pg_3", text: "{name} runs, climbs and balances in outdoor play.", levels: ["PG"] },
        { key: "enr_n1_1", text: "{name} uses scissors, glue and crayons with control.", levels: ["N1"] },
        { key: "enr_n1_2", text: "{name} sings songs and keeps a simple beat.", levels: ["N1"] },
        { key: "enr_n1_3", text: "{name} throws, kicks and catches a large ball.", levels: ["N1"] },
        { key: "enr_n1_4", text: "{name} shows curiosity and asks questions.", levels: ["N1"] },
        { key: "enr_n2_1", text: "{name} creates {his/her} own art and talks about it.", levels: ["N2"] },
        { key: "enr_n2_2", text: "{name} performs songs and actions with the class.", levels: ["N2"] },
        { key: "enr_n2_3", text: "{name} hops, skips and balances with control.", levels: ["N2"] },
        { key: "enr_n2_4", text: "{name} explores and talks about nature and science activities.", levels: ["N2"] },
        { key: "enr_k1_1", text: "{name} plans and makes art and craft projects.", levels: ["K1"] },
        { key: "enr_k1_2", text: "{name} takes part in performances with confidence.", levels: ["K1"] },
        { key: "enr_k1_3", text: "{name} shows good coordination in sports and games.", levels: ["K1"] },
        { key: "enr_k1_4", text: "{name} makes predictions and talks about simple experiments.", levels: ["K1"] },
        { key: "enr_k2_1", text: "{name} expresses ideas creatively through art, music and drama.", levels: ["K2"] },
        { key: "enr_k2_2", text: "{name} performs confidently in front of an audience.", levels: ["K2"] },
        { key: "enr_k2_3", text: "{name} plays team games and follows the rules.", levels: ["K2"] },
        { key: "enr_k2_4", text: "{name} investigates questions and explains what {he/she} found out.", levels: ["K2"] },
      ],
      love: { key: "enr_love", text: "What did {name} love most this semester?" },
      homeIdeas: DEFAULT_HOME_IDEAS,
    },
  ],
  neverUse: NEVER_USE,
};

type LegacySkill = { key: string; text?: string; name?: string; statement?: string; levels?: string[] };
type LegacyArea = Omit<Area, "skills"> & { skills: LegacySkill[] };

/**
 * Reviews written before v0.3 froze an older question shape (seven Cambridge areas, skills with a name and a
 * statement). This reads either shape, so old reports still open and print.
 */
export function normaliseRubric(raw: unknown): Rubric {
  const r = (raw ?? {}) as { version?: number; areas?: LegacyArea[]; neverUse?: string[]; level?: ClassLevel };
  return {
    version: typeof r.version === "number" ? r.version : 0,
    neverUse: Array.isArray(r.neverUse) ? r.neverUse : NEVER_USE,
    areas: (r.areas ?? []).map((a) => ({
      key: a.key,
      name: a.name,
      shortName: a.shortName ?? a.name,
      ...(a.subName ? { subName: a.subName } : {}),
      ...(a.icon ? { icon: a.icon } : {}),
      ...(a.love ? { love: a.love } : {}),
      ...(a.homeIdeas ? { homeIdeas: a.homeIdeas } : {}),
      skills: a.skills.map((s) => ({
        key: s.key,
        text: s.text ?? `{name} ${(s.statement ?? (s.name ?? s.key).replace(/^./, (c) => c.toLowerCase())).replace(/^\s+|[.\s]+$/g, "")}.`,
        ...(Array.isArray(s.levels) ? { levels: s.levels.filter((l): l is ClassLevel => CLASS_LEVEL_KEYS.includes(l as ClassLevel)) } : {}),
      })),
    })),
    ...(r.level && CLASS_LEVEL_KEYS.includes(r.level) ? { level: r.level } : {}),
  };
}

/** Is this question asked at this level? A question with no levels (older sets) is asked at every level. */
export const askedAt = (s: Skill, level: ClassLevel) => !s.levels || s.levels.includes(level);

/** The questions one level is asked: what a review freezes when it is opened. */
export function rubricForLevel(rubric: Rubric, level: ClassLevel): Rubric {
  return { ...rubric, level, areas: rubric.areas.map((a) => ({ ...a, skills: a.skills.filter((s) => askedAt(s, level)) })) };
}
