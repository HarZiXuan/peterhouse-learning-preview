import type { Area, Rubric } from "./types";

// Teacher Questions v0.3, section 2. The wording is a placeholder for a Peterhouse teacher to approve:
// it is copied into the database on first start and the administrator edits it from there.

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
        { key: "eng_1", text: "{name} listens well and responds in a group." },
        { key: "eng_2", text: "{name} speaks in clear sentences to share ideas." },
        { key: "eng_3", text: "{name} enjoys stories and can talk about what happened in them." },
        { key: "eng_4", text: "{name} recognises letters and the sounds they make." },
      ],
    },
    {
      key: "chi",
      name: "Chinese",
      shortName: "Chinese",
      subName: "华文",
      icon: "chi",
      skills: [
        { key: "chi_1", text: "{name} understands simple instructions in Chinese." },
        { key: "chi_2", text: "{name} speaks simple Chinese words and phrases." },
        { key: "chi_3", text: "{name} joins in Chinese songs, rhymes and stories." },
        { key: "chi_4", text: "{name} recognises some familiar Chinese characters." },
      ],
    },
    {
      key: "mat",
      name: "Mathematics",
      shortName: "Maths",
      icon: "mat",
      skills: [
        { key: "mat_1", text: "{name} counts objects one by one accurately." },
        { key: "mat_2", text: "{name} compares size and amount (“more”, “fewer”, “bigger”)." },
        { key: "mat_3", text: "{name} names basic shapes and spots them around the room." },
        { key: "mat_4", text: "{name} sorts things and notices simple patterns." },
      ],
    },
    {
      key: "sed",
      name: "Social-Emotional Development",
      shortName: "Social",
      icon: "sed",
      skills: [
        { key: "sed_1", text: "{name} settles into the class routine happily." },
        { key: "sed_2", text: "{name} shares and takes turns with friends." },
        { key: "sed_3", text: "{name} can say how {he/she/they} feels." },
        { key: "sed_4", text: "{name} shows kindness and cares for others." },
      ],
    },
    {
      key: "enr",
      name: "Self-Enrichment",
      shortName: "Enrichment",
      icon: "enr",
      skills: [
        { key: "enr_1", text: "{name} joins in music and movement." },
        { key: "enr_2", text: "{name} enjoys art and making things." },
        { key: "enr_3", text: "{name} joins in active outdoor play." },
      ],
      love: { key: "enr_love", text: "What did {name} love most this semester?" },
      homeIdeas: DEFAULT_HOME_IDEAS,
    },
  ],
  neverUse: NEVER_USE,
};

type LegacySkill = { key: string; text?: string; name?: string; statement?: string };
type LegacyArea = Omit<Area, "skills"> & { skills: LegacySkill[] };

/**
 * Reviews written before v0.3 froze an older question shape (seven Cambridge areas, skills with a name and a
 * statement). This reads either shape, so old reports still open and print.
 */
export function normaliseRubric(raw: unknown): Rubric {
  const r = (raw ?? {}) as { version?: number; areas?: LegacyArea[]; neverUse?: string[] };
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
      })),
    })),
  };
}
