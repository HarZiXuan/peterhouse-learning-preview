# Staff design system

The rules for every staff screen (`app/frontend/src/app/(staff)`, settings, approvals, reports). Follow them for any
new page or change. The look is a calm, clear admin tool: neutral greys, near-black text, hairline borders, small type,
the Peterhouse crest red for the main action, and a fixed set of status colours so anyone can tell at a glance where a
report is. It is not the family report: the printed report (`components/report/`) keeps its own playful fonts and
colours, and none of these rules apply there.

Reference pages that already follow this: the class page (`classes/[id]`), the teacher profile (`teachers/[id]`), the
child profile (`children/[id]`), the Children and Teachers lists. Copy their patterns before inventing new ones.

## 1. Components: shadcn first

- Build from `@/components/ui/*` (shadcn, new-york style, Radix). Add a missing one with `npx shadcn@latest add <name>`
  from `app/frontend`, never hand-roll a look-alike.
- Phone numbers always use `PhoneInput` (`@/components/phone-input`): a country code picker (Singapore first) and the
  number spaced as it is typed, stored as `+65 9123 4567`. Forms refuse to save a number of the wrong length
  (`guardiansPhoneProblem`), and pages show stored numbers with `displayPhone`.
- Choices: `Select` for one of a short list, `Popover` with a button list for a richer picker (a person with a line
  of detail), `Checkbox` for many-of, `RadioGroup` for one-of with descriptions, `Tabs` (`variant="line"`) for sections
  of one page.
- Overlays: `Dialog` for a form, `AlertDialog` for anything destructive, `DropdownMenu` for row actions (the `…`
  button), `Popover` for pickers, `sonner` toasts for results (with Undo where it can be undone).
- Shared admin pieces in `@/components/admin.tsx`: `PageTitle` (h1 with its icon), `StatStrip` (the numbers row under
  a page header) and `SectionCard` (a titled card holding a table or list). Status badges: `StatusBadge` in
  `(staff)/classes/shared.tsx`.
- No native `<select>`, raw `<button>` styling or one-off CSS classes in new code. `legacy.css` is being retired: do
  not add to it.

## 2. Tables: always `DataTable`

Every list of records is a `DataTable` from `@/components/data-table` (shadcn `Table` + TanStack Table). Never build a
table from `<Table>` rows by hand, and never a list of `<div>` rows pretending to be a table. The calendar's week grid
is the one exception: it is a grid, not a list.

- **Sorting is standard.** Every column with an `accessorFn` sorts: first click ascending, the next descending, the next
  back to the table's own order. The heading shows ↕ when unsorted and ↑ / ↓ when sorted. Text sorts ignoring case and
  with numbers in order; empty values always go last. Give status columns a numeric `accessorFn` (a rank) so they sort
  in workflow order, not alphabetically. Turn sorting off (`enableSorting: false`) only for action columns.
- Columns are `ColumnDef<T>[]`: `id`, `accessorFn` (the sort value), `header` (a short word), `cell` (the rendering).
  Use `meta.align: "right"` for numbers, dates and actions, `meta.className` for widths or `hidden md:table-cell`.
- Order: the subject (name with avatar, a real link) first, facts next, status, actions last and right-aligned. The
  table pads its first and last columns itself.
- `initialSort` sets the order before anyone clicks (usually by name); leave it out when the data already comes in a
  meaningful order (newest first, waiting first).
- `pageSize` for lists that can grow past a screen (25 or 50; 10 for logs). `empty` says what to do next in one sentence.
- `rowClassName` tints rows that need attention (`bg-warn/10`) or mutes inactive ones (`text-muted-foreground`);
  `onRowClick` only when the first cell also has a link.
- Toolbar above the table: `TableSearch`, then `TableFilter`s (shadcn `Select` with an "All …" choice), then the result
  count on the right (`ml-auto text-sm text-muted-foreground`).
- A server page cannot pass `cell` functions to the client: put the columns and the `DataTable` in a small
  `"use client"` file next to the page (see `teachers/[id]/TeacherTables.tsx`), and keep shared pure helpers in a plain
  `.ts` module both can import (see `reports/reportState.ts`).
- Row actions: one visible action (ghost button) plus a `…` `DropdownMenu` for the rest. Destructive items go last,
  after a separator, in red, and always open an `AlertDialog`.
- Inactive rows (children who left) go in a `Collapsible` at the bottom of the same card.

## 3. Type

- One family: **Inter** (`font-sans`; `font-heading` is the same face). Chinese falls back to Noto Sans SC.
- Hierarchy comes from size and weight, not new fonts or colour:

| Use | Classes |
| --- | --- |
| Page title (h1) | `PageTitle` (`text-2xl font-semibold tracking-tight`) |
| Card / section title (h2) | `SectionCard` title (`text-sm font-semibold`, count after it in `font-normal text-muted-foreground`) |
| Body, table cells | `text-sm` (14px, the body default) |
| Help text, labels, stat labels | `text-xs text-muted-foreground` or `text-sm text-muted-foreground` |
| Stat value | `text-xl font-semibold tabular-nums` |

- Weights: 400 body, 500 for names and emphasis in tables, 600 for titles. Never 700+ or `font-extrabold`.
- No uppercase tracked labels, no 40px display numbers, no `font-heading text-[40px]` style headings.
- Numbers in tables and stats use `tabular-nums`.

## 4. Colour

Tokens live in `app/frontend/src/app/globals.css`. Use the token classes, never hex values in components.

### Brand and neutrals

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#ae1d25` Peterhouse crest red | The main action per screen (filled button), the sidebar's current page, counts that need action |
| `background` | `#fafafa` | Page ground |
| `card` | `#ffffff` | Cards, tables, popovers |
| `foreground` | `#18181b` | Text |
| `muted-foreground` | `#71717a` | Secondary text, help, empty states |
| `secondary` / `muted` / `accent` | `#f4f4f5` | Hover, selected rows, quiet badges |
| `border` / `input` | `#e4e4e7` | Every hairline and input edge |
| `destructive` | `#dc2626` | Delete and remove only |
| `warn` | `#d97706` | A problem to look at (wrong class, a clash); `warn-foreground` for its text |

- One filled red (`primary`) button per screen at most; everything else is `outline` or `ghost`.
- Links in text and tables are `text-foreground` with `hover:underline`, not red or blue. A link that acts like a
  button (Open report) is `Button variant="ghost" size="sm" asChild`.

### Status colours

Every report or account state uses one of these five, each with a strong colour (dots, bars, rings), a soft tint (badge
ground) and a deep shade (text on the tint): `status-<name>`, `status-<name>-soft`, `status-<name>-fg`.

| Status | Colour | Means |
| --- | --- | --- |
| `approved` | green `#16a34a` | Approved, written, done, active |
| `waiting` | red `#dc2626` | Waiting for review (with the office), locked |
| `changes` | amber `#d97706` | Changes requested, needs a new password, not in a class |
| `progress` | blue `#2563eb` | In progress, ready to write, ready to send |
| `idle` | grey `#a1a1aa` | With teachers, not started, deactivated, left |

- A report status is always `StatusBadge` (tinted badge, coloured dot, the word). The word must always be there:
  colour helps, it never carries the meaning alone.
- Other states use `Badge className="border-transparent bg-status-<name>-soft text-status-<name>-fg"`.
- Progress bars are green: shadcn `Progress` (its fill is `success`). Rings and bars still filling use `progress`
  blue and turn green when complete. A bar split by stage uses `STAGE_FILL`.
- Subjects show as outline badges with their small colour dot (`SUBJECT_SWATCH`), never filled tinted pills.

## 5. Icons

- Lucide only, through `Icon` from `@/components/icons` (add a name there rather than importing ad hoc). Never emoji.
- Every page title has its icon via `PageTitle`, the same icon as the page in the sidebar: Classes `classes`,
  Children `children`, Reports `reports`, Calendar `calendar`, Teachers `people`, Settings `settings`.
- Every `SectionCard` has an `icon`, every `StatStrip` item an `icon`, and every tab an icon before its label. Use the
  same icon for the same thing everywhere: children `children`, teachers `teachers`, classes `classes`, reports
  `reports`, waiting for review `reviews`, learning areas `questions`, semesters `semester`, dates `calendar`,
  parents `users`, notes `info`, photos `camera`, approved `check`.
- Sizes: 18px in a page title tile, 16px in tabs and section titles, 14px in stat labels and badges. Icons sit in
  `text-muted-foreground` next to their word; an icon alone (a button) needs an `aria-label`.

## 6. Layout

- Page shell: `<main className="mx-auto max-w-6xl px-4 pb-16 pt-4 md:px-8 md:pt-6">`, then `BackLink` (detail pages),
  then the header.
- Header: `PageTitle` (plus an outline `Badge` for level or role), one muted line of facts under it indented to the
  title text (`sm:pl-[2.875rem]`), actions on the right (`flex flex-wrap items-end justify-between gap-4`). Profiles
  show the person's avatar in place of the icon tile.
- Under the header: a `StatStrip` of at most four facts, then the content.
- Sections: `Tabs` with `variant="line"` when a page has several areas (see the class page), otherwise stacked
  `SectionCard`s with `gap-6`. Two short cards may sit side by side (`md:grid-cols-2`).
- Radius is `rounded-lg` (8px) for cards and `rounded-md` for controls. No `rounded-[20px]`, no `shadow` on cards
  (`shadow-none`); borders do the separating.
- Avatars are small (32px in tables, 48px in a profile header) with neutral initials.
- Every page works at phone width: toolbars and headers wrap, wide tables scroll inside their card.

## 7. Words and behaviour

- Plain words a teacher uses: "Waiting for review", not "submitted". Sentence case everywhere.
- Every setting explains itself in one line where it is changed (for example "Why: Teaches Maths").
- Problems are surfaced, not hidden: an `Alert` at the top of the section saying what is wrong and what to do.
- Shared work is sorted by whose turn it is. When several people work on one thing (a report in parts), group the
  pieces into **Yours to rate** (blue `progress`, pencil icon), **Sent to you to check** (green `approved`, check icon)
  and **With other teachers** (grey `idle`, clock icon). Show the three groups in a summary strip at the top, label the
  tabs and lists by group (yours first), name the person and their progress on every piece that is not yours, and open
  a not-yours piece with a one-line `Alert` saying who has it and what happens next. See `child/[id]/ReviewForm.tsx`.
- Changes save as you go where safe, with a toast and Undo. Forms in dialogs have Cancel and one primary button whose
  label says what happens ("Save and move", "Take off class").
- Accessibility: real buttons and links, labels on every input (`aria-label` when there is no visible one), `sr-only`
  header text for action columns, 4.5:1 text contrast (muted-foreground on white passes; do not go lighter).

## 8. Do not

- Add fonts, colours or radii that are not tokens here, or use a status colour for decoration.
- Build a table without `DataTable`, or a table whose columns cannot be sorted.
- Use big rounded cards with lots of empty space, coloured backgrounds on whole sections, or gradients.
- Use filled coloured pills for subjects, or a status shown by colour without its word.
- Put long explanations on screen: one line of help per section at most.
- Build a second way to set the same thing on the same page.
