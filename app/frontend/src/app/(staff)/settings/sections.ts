// Every settings page, grouped. The side menu and the overview cards both read this list, so they never disagree.
import type { IconName } from "@/components/icons";

export type SettingsItem = {
  href: string;
  title: string;
  icon: IconName;
  description: string;
  /** The link on the overview card. */
  action: string;
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
    description: "What every report says, and the subjects on the timetable.",
    items: [
      {
        href: "/settings/report",
        title: "Report details",
        icon: "school",
        description: "The school name, and whether these are the June or December reports.",
        action: "Edit report details",
        adminOnly: true,
        keywords: "school name semester year period print",
      },
      {
        href: "/settings/subjects",
        title: "Subjects",
        icon: "calendar",
        description: "The subjects on each class’s weekly timetable, and their colours.",
        action: "Manage subjects",
        adminOnly: true,
        keywords: "timetable lessons english chinese maths happy hour",
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
    title: "Report period",
    description: "Which June or December reports teachers are writing.",
    items: [
      {
        href: "/settings/semester",
        title: "Report period",
        icon: "semester",
        description: "See where this period stands, move on to the next one, or go back if you moved on too soon.",
        action: "Choose semester",
        adminOnly: true,
        keywords: "semester term start new year move up undo revert back",
      },
    ],
  },
];

/** The groups and items this person can open. */
export function settingsFor(admin: boolean): SettingsGroup[] {
  return SETTINGS_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => admin || !i.adminOnly) })).filter((g) => g.items.length > 0);
}
