// Dummy teachers, classes, children and weekly timetables for a development database: `pnpm --filter @peterhouse/backend seed-dummy`.
// Everything goes into the semester that is open now, through the same functions the app uses, so names are encrypted
// and each child lands in a class of their own level. No reports are written. Running it again adds nothing new; a class
// that already has lessons keeps its timetable.
import type { ClassLevel, Guardian, Pronoun } from "@peterhouse/shared";
import { birthYearOf, CLASS_LEVEL_KEYS } from "@peterhouse/shared";
import { many, one, pool, run } from "../db";
import { migrate } from "../migrate";
import { addChild, createClass, setClassStaff } from "../domain/classes";
import { createSubject, saveLesson } from "../domain/timetable";
import { createUser } from "../domain/users";
import { workspace } from "../domain/workspace";

const PASSWORD = "peterhouse-teacher-2026";

const TEACHERS = [
  { email: "ms.tan@peterhouse.test", name: "Ms Tan Hui Min" },
  { email: "ms.lim@peterhouse.test", name: "Ms Lim Pei Shan" },
  { email: "ms.priya@peterhouse.test", name: "Ms Priya Raman" },
  { email: "mr.wong@peterhouse.test", name: "Mr Wong Kai Jie" },
  { email: "ms.nur@peterhouse.test", name: "Ms Nurul Aisyah" },
  { email: "ms.chen@peterhouse.test", name: "Ms Chen Xiao Yu" },
  { email: "ms.goh@peterhouse.test", name: "Ms Goh Mei Ling" },
];

/** One class per level, with the teachers (by email) who lead it and help in it, and how many children to put in it. */
const CLASSES: { name: string; level: ClassLevel; lead: string; co: string[]; children: number }[] = [
  { name: "PG Poopy Playtime", level: "PG", lead: "ms.goh@peterhouse.test", co: [], children: 6 },
  { name: "Sunflower", level: "N1", lead: "ms.tan@peterhouse.test", co: ["ms.nur@peterhouse.test"], children: 12 },
  { name: "Rainbow", level: "N2", lead: "ms.lim@peterhouse.test", co: ["ms.chen@peterhouse.test"], children: 14 },
  { name: "MiaoMeow", level: "K1", lead: "ms.priya@peterhouse.test", co: [], children: 12 },
  { name: "Explorers", level: "K2", lead: "mr.wong@peterhouse.test", co: ["ms.chen@peterhouse.test"], children: 16 },
];

// Chinese, Malay, Indian and Eurasian names, as at a Singapore preschool. The Chinese name is left blank where a family would not have one.
const GIRLS: [string, string][] = [
  ["Chloe", "可儿"], ["Emma", "艾玛"], ["Sophia", "思菲"], ["Isabelle", "依莎"], ["Hannah", "汉娜"], ["Zoe", "子怡"], ["Charlotte", "夏洛"],
  ["Abigail", "雅琪"], ["Ava", "艾娃"], ["Grace", "恩典"], ["Olivia", "奥莉"], ["Ellie", "爱莉"], ["Megan", "美琴"], ["Kayla", "凯拉"],
  ["Nur Aisyah", ""], ["Siti Hajar", ""], ["Aleesya", ""], ["Ananya", ""], ["Diya", ""], ["Kavya", ""], ["Meera", ""], ["Sarah", ""],
];
const BOYS: [string, string][] = [
  ["Ethan", "以森"], ["Lucas", "卢卡"], ["Jayden", "杰登"], ["Ryan", "瑞安"], ["Caleb", "凯勒"], ["Nathan", "南森"], ["Aiden", "艾登"],
  ["Isaac", "以撒"], ["Matthew", "马修"], ["Dylan", "迪伦"], ["Javier", "家伟"], ["Marcus", "马可"], ["Ezra", "以斯"], ["Jonah", "约拿"],
  ["Muhammad Irfan", ""], ["Adam", ""], ["Rayyan", ""], ["Arjun", ""], ["Vihaan", ""], ["Rohan", ""], ["Daniel", ""], ["Liam", ""],
];
const CHINESE_SURNAMES: [string, string][] = [["Tan", "陈"], ["Lim", "林"], ["Lee", "李"], ["Ng", "黄"], ["Ong", "王"], ["Goh", "吴"], ["Chua", "蔡"], ["Koh", "许"], ["Teo", "张"], ["Chan", "曾"]];
const OTHER_SURNAMES: Record<string, string[]> = {
  malay: ["Binte Rahman", "Bin Ismail", "Binte Hassan", "Bin Yusof"],
  indian: ["Nair", "Pillai", "Krishnan", "Menon", "Subramaniam"],
  eurasian: ["De Souza", "Pereira", "Oliveiro"],
};
const MALAY = new Set(["Nur Aisyah", "Siti Hajar", "Aleesya", "Muhammad Irfan", "Adam", "Rayyan"]);
const INDIAN = new Set(["Ananya", "Diya", "Kavya", "Meera", "Arjun", "Vihaan", "Rohan"]);

const NOTES = ["", "", "", "Allergic to peanuts.", "Picked up by grandmother on Tuesdays and Thursdays.", "Shy at first; settles well with a familiar adult.", "Speaks Mandarin at home.", "Has an older sibling in K2.", "Needs an afternoon nap.", "Lactose intolerant."];

// A fixed seed, so every run makes the same children.
let state = 20261022;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const pad = (n: number) => String(n).padStart(2, "0");

function makeChild(level: ClassLevel, year: number, used: Set<string>) {
  for (;;) {
    const pronoun: Pronoun = rand() < 0.5 ? "she" : "he";
    const [first, givenZh] = pick(pronoun === "she" ? GIRLS : BOYS);
    let last: string;
    let chinese = "";
    if (MALAY.has(first)) last = pick(OTHER_SURNAMES.malay);
    else if (INDIAN.has(first)) last = pick(OTHER_SURNAMES.indian);
    else if (!givenZh) last = pick(OTHER_SURNAMES.eurasian);
    else {
      const [surname, surnameZh] = pick(CHINESE_SURNAMES);
      last = surname;
      chinese = surnameZh + givenZh;
    }
    if (used.has(`${first} ${last}`)) continue;
    used.add(`${first} ${last}`);
    const born = birthYearOf(level, year);
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    // Most have been here since January; a few joined at the start of this semester.
    const joinedOn = rand() < 0.8 ? `${year}-01-0${2 + Math.floor(rand() * 5)}` : `${year}-07-01`;
    const parentFirst = pick(["David", "Michelle", "Kelvin", "Rachel", "Faizal", "Sharmila", "Jason", "Wei Ling", "Hafiz", "Deepa"]);
    const phone = `+65 9${Math.floor(1000000 + rand() * 8999999)}`;
    const guardians: Guardian[] = [
      { name: `${parentFirst} ${last.replace(/^Bin(te)? /, "")}`, relationship: rand() < 0.55 ? "Mother" : "Father", phone, email: `${parentFirst.toLowerCase().replace(/\s/g, "")}.${last.split(" ").pop()!.toLowerCase()}@example.com` },
    ];
    if (rand() < 0.4) guardians.push({ name: `Grandma ${last.split(" ").pop()}`, relationship: "Grandmother", phone: `+65 8${Math.floor(1000000 + rand() * 8999999)}`, email: "" });
    return { firstName: first, lastName: last, chineseName: chinese, pronoun, dateOfBirth: `${born}-${pad(month)}-${pad(day)}`, joinedOn, guardians, notes: pick(NOTES) };
  }
}

// Subjects a preschool day needs besides the school's four, with their timetable colours.
const SUBJECTS: [string, string][] = [
  ["Circle Time", "stone"],
  ["Snack Time", "peach"],
  ["Outdoor Play", "leaf"],
  ["Music & Movement", "lilac"],
  ["Art & Craft", "peach"],
  ["Science & Discovery", "sun"],
  ["Story Time", "lilac"],
];

type Slot = [start: string, end: string, subjects: string[]];
const DAY = (...xs: string[]) => xs;

/**
 * One school day per level, Monday to Friday: each slot names its subject for each day (one name means every day).
 * Playgroup has a short morning; the older the children, the longer the day and the more English, Chinese and Maths.
 */
const WEEKS: Record<ClassLevel, Slot[]> = {
  PG: [
    ["08:30", "09:00", ["Circle Time"]],
    ["09:00", "09:30", DAY("Music & Movement", "Story Time", "Music & Movement", "Story Time", "Art & Craft")],
    ["09:30", "10:00", ["Snack Time"]],
    ["10:00", "10:30", DAY("English", "Chinese 华文", "English", "Chinese 华文", "Story Time")],
    ["10:30", "11:15", DAY("Outdoor Play", "Outdoor Play", "Outdoor Play", "Outdoor Play", "Happy Hour")],
  ],
  N1: [
    ["08:30", "09:00", ["Circle Time"]],
    ["09:00", "09:40", DAY("English", "Chinese 华文", "English", "Chinese 华文", "English")],
    ["09:40", "10:10", ["Snack Time"]],
    ["10:10", "10:50", DAY("Maths", "Art & Craft", "Music & Movement", "Science & Discovery", "Story Time")],
    ["10:50", "11:40", DAY("Outdoor Play", "Outdoor Play", "Outdoor Play", "Outdoor Play", "Happy Hour")],
    ["11:40", "12:00", ["Story Time"]],
  ],
  N2: [
    ["08:30", "09:00", ["Circle Time"]],
    ["09:00", "09:45", DAY("English", "Chinese 华文", "English", "Chinese 华文", "English")],
    ["09:45", "10:15", ["Snack Time"]],
    ["10:15", "11:00", DAY("Maths", "Science & Discovery", "Maths", "Art & Craft", "Music & Movement")],
    ["11:00", "11:45", DAY("Outdoor Play", "Outdoor Play", "Outdoor Play", "Outdoor Play", "Happy Hour")],
    ["11:45", "12:30", DAY("Chinese 华文", "English", "Chinese 华文", "Story Time", "Chinese 华文")],
  ],
  K1: [
    ["08:30", "09:00", ["Circle Time"]],
    ["09:00", "09:45", DAY("English", "Chinese 华文", "English", "Chinese 华文", "English")],
    ["09:45", "10:15", ["Snack Time"]],
    ["10:15", "11:00", DAY("Maths", "Science & Discovery", "Maths", "Art & Craft", "Maths")],
    ["11:00", "11:45", DAY("Outdoor Play", "Music & Movement", "Outdoor Play", "Outdoor Play", "Happy Hour")],
    ["11:45", "12:30", DAY("Chinese 华文", "English", "Chinese 华文", "Maths", "Chinese 华文")],
    ["12:30", "13:00", ["Story Time"]],
  ],
  K2: [
    ["08:30", "09:00", ["Circle Time"]],
    ["09:00", "09:45", DAY("English", "Chinese 华文", "English", "Chinese 华文", "English")],
    ["09:45", "10:15", ["Snack Time"]],
    ["10:15", "11:00", DAY("Maths", "Maths", "Science & Discovery", "Maths", "Maths")],
    ["11:00", "11:45", DAY("Outdoor Play", "Art & Craft", "Outdoor Play", "Music & Movement", "Happy Hour")],
    ["11:45", "12:30", DAY("Chinese 华文", "English", "Chinese 华文", "English", "Chinese 华文")],
    ["12:30", "13:15", DAY("English", "Chinese 华文", "Story Time", "Maths", "Story Time")],
  ],
};

/** Who takes a subject: the co-teacher takes Chinese and the creative lessons when there is one; the lead the rest. */
const COTAUGHT = new Set(["Chinese 华文", "Art & Craft", "Music & Movement", "Story Time"]);

if (process.env.NODE_ENV === "production") {
  console.error("seed-dummy is for development databases only.");
  process.exit(1);
}

try {
  await migrate(pool, () => {});
  const { termId } = await workspace();
  const year = (await one<{ year: number }>("SELECT year FROM terms WHERE id = $1", [termId]))!.year;

  const ids = new Map<string, number>();
  let newTeachers = 0;
  for (const t of TEACHERS) {
    const found = await one<{ id: number }>("SELECT id FROM users WHERE email = $1", [t.email]);
    const id = found?.id ?? (await createUser(null, null, { ...t, role: "teacher", password: PASSWORD }));
    // Dummy accounts sign straight in, without choosing a new password first.
    if (!found) await run("UPDATE users SET must_change_password = false WHERE id = $1", [id]);
    if (!found) newTeachers++;
    ids.set(t.email, Number(id));
  }

  const used = new Set<string>();
  let newChildren = 0;
  for (const k of [...CLASSES].sort((a, b) => CLASS_LEVEL_KEYS.indexOf(a.level) - CLASS_LEVEL_KEYS.indexOf(b.level))) {
    const existing = await one<{ id: number }>("SELECT id FROM classes WHERE term_id = $1 AND name = $2 AND level = $3", [termId, k.name, k.level]);
    const classId = existing?.id ?? (await createClass(k.name, k.level));
    // Teachers already in the class stay; the dummy ones are added beside them.
    const staff = await many<{ user_id: number; role: string }>("SELECT user_id, role FROM class_staff WHERE class_id = $1", [classId]);
    const lead = Number(staff.find((s) => s.role === "lead")?.user_id ?? ids.get(k.lead)!);
    const co = [...new Set([...staff.map((s) => Number(s.user_id)), ids.get(k.lead)!, ...k.co.map((e) => ids.get(e)!)])].filter((x) => x !== lead);
    await setClassStaff(classId, lead, co);

    const have = (await one<{ n: number }>("SELECT count(*)::int AS n FROM reviews r JOIN children c ON c.id = r.child_id WHERE r.class_id = $1 AND c.status = 'active'", [classId]))!.n;
    const room = k.children - have;
    for (let i = 0; i < room; i++) {
      await addChild({ ...makeChild(k.level, year, used), classId });
      newChildren++;
    }
    console.log(`${k.level} ${k.name}: ${have + Math.max(0, room)} children, ${1 + co.length} teachers`);
  }

  const subjectId = new Map((await many<{ id: number; name: string }>("SELECT id, name FROM subjects")).map((x) => [x.name, Number(x.id)]));
  for (const [name, color] of SUBJECTS) if (!subjectId.has(name)) subjectId.set(name, Number(await createSubject({ name, color })));

  const admin = { id: 0, role: "admin", name: "seed", email: "" } as Parameters<typeof saveLesson>[0];
  let timetables = 0;
  const classes = await many<{ id: number; name: string; level: ClassLevel }>("SELECT id, name, level FROM classes WHERE term_id = $1 ORDER BY id", [termId]);
  for (const [room, k] of classes.entries()) {
    if (await one("SELECT 1 FROM lessons WHERE class_id = $1", [k.id])) continue;
    // A teacher limited to some subjects in this class can only be named on those; anyone else on any subject.
    const staff = await many<{ user_id: number; role: string; subjects: string[] | null }>(
      `SELECT s.user_id, s.role, array_agg(sub.name) FILTER (WHERE sub.id IS NOT NULL) AS subjects
         FROM class_staff s LEFT JOIN class_subject_teachers x ON x.class_id = s.class_id AND x.user_id = s.user_id LEFT JOIN subjects sub ON sub.id = x.subject_id
        WHERE s.class_id = $1 GROUP BY s.user_id, s.role ORDER BY s.role DESC, s.user_id`,
      [k.id],
    );
    const may = (subject: string) => staff.filter((x) => !x.subjects || x.subjects.includes(subject));
    const teacherFor = (subject: string, weekday: number) => {
      const lead = may(subject).filter((x) => x.role === "lead");
      const co = may(subject).filter((x) => x.role === "co");
      // Co-teachers take turns by day, so one with two classes is not always in both at once.
      const pickFrom = COTAUGHT.has(subject) && co.length ? co : lead.length ? lead : co;
      return pickFrom.length ? Number(pickFrom[weekday % pickFrom.length].user_id) : null;
    };
    try {
      for (let weekday = 1; weekday <= 5; weekday++) {
        for (const [start, end, subjects] of WEEKS[k.level]) {
          const subject = subjects.length === 1 ? subjects[0] : subjects[weekday - 1];
          await saveLesson(admin, { classId: k.id, subjectId: subjectId.get(subject)!, weekday, start, end, teacherId: teacherFor(subject, weekday), room: `Room ${room + 1}`, weekOf: null });
        }
      }
    } catch (e) {
      // A class is given a whole week or nothing.
      await run("DELETE FROM lessons WHERE class_id = $1", [k.id]);
      throw e;
    }
    timetables++;
  }

  console.log(`\nAdded ${newTeachers} teachers, ${newChildren} children and ${timetables} class timetables. Teachers sign in with password "${PASSWORD}".`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
