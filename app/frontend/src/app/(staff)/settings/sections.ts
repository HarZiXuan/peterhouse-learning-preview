// Every settings page, grouped. The side menu and the overview cards both read this list, so they never disagree.
import type { IconName } from "@/components/icons";

export type SettingsItem = {
  href: string;
  title: string;
  icon: IconName;
  description: string;
  /** The link on the overview card. */
  action: string;
  /** For a teacher, when the page is read-only for them. */
  teacherAction?: string;
  adminOnly?: boolean;
  /** Extra words the search matches. */
  keywords?: string;
};

export type SettingsGroup = { key: string; title: string; description: string; items: SettingsItem[] };

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: "personal",
    title: "Personal",
    description: "Your sign-in and password.",
    items: [
      {
        href: "/settings/account",
        title: "My account",
        icon: "user",
        description: "See your name, email, role and classes, and change your password.",
        action: "Manage account",
        keywords: "password profile email sign in",
      },
    ],
  },
  {
    key: "school",
    title: "School",
    description: "What every report says, and what teachers rate.",
    items: [
      {
        href: "/settings/report",
        title: "Report details",
        icon: "school",
        description: "The school name, and whether these are the June or December reports.",
        action: "Edit report details",
        teacherAction: "View report details",
        keywords: "school name semester year period print",
      },
      {
        href: "/classes",
        title: "Classes",
        icon: "classes",
        description: "Levels, classes, their lead and co-teachers, and the children in each.",
        action: "Manage classes",
        adminOnly: true,
        keywords: "level children teachers ratio",
      },
      {
        href: "/questions",
        title: "Questions",
        icon: "questions",
        description: "The statements teachers rate in each area, published as versions.",
        action: "Edit questions",
        adminOnly: true,
        keywords: "rubric statements domains publish",
      },
    ],
  },
  {
    key: "people",
    title: "People",
    description: "Who can sign in, and what they did.",
    items: [
      {
        href: "/settings/people",
        title: "People and sign-ins",
        icon: "people",
        description: "Add staff, edit accounts, reset passwords and unlock sign-ins.",
        action: "Manage people",
        adminOnly: true,
        keywords: "teachers staff accounts users unlock reset password",
      },
      {
        href: "/settings/activity",
        title: "Activity log",
        icon: "activity",
        description: "Who signed in, opened a child’s record, or wrote and downloaded a report.",
        action: "View activity",
        adminOnly: true,
        keywords: "audit log history",
      },
    ],
  },
  {
    key: "semester",
    title: "Semester",
    description: "Move the school on to the next semester.",
    items: [
      {
        href: "/settings/semester",
        title: "Start next semester",
        icon: "semester",
        description: "Close this semester and open the next. In January every class moves up a level.",
        action: "Review and start",
        adminOnly: true,
        keywords: "term new year move up",
      },
    ],
  },
];

/** The groups and items this person can open. */
export function settingsFor(admin: boolean): SettingsGroup[] {
  return SETTINGS_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => admin || !i.adminOnly) })).filter((g) => g.items.length > 0);
}
