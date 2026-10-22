# Peterhouse Learning Review: Changes to Make

This is the build list. We agree each change here first, then it is built exactly as written.

Every message the screens show (pop-ups, on-page notes, confirm boxes) is listed in `MESSAGES.md`.

Each change has a status:

- **Agreed**: decided, ready to build.
- **To discuss**: the idea is agreed, but the questions under it still need answers.
- **Built**: done and in the system.

---

## 1. Teachers own the report; admin reviews it

Status: **Built** (21 Oct 2026), together with change 3

### Why teachers should own it

- **They saw the child.** The ratings, comments and photos come from them, and the AI draft is built from those. If an
  admin rewrites the text, the report can drift away from the ratings behind it.
- **A clear author means someone is accountable** for what goes to families. If a report is wrong, you know who to ask.
- **Admin edits do not scale.** Editing 8 or more reports per class turns the admin into a bottleneck.

### What admin should get instead

- **A review step.** See every report with its status (draft, ready, approved) and approve it before it goes to
  families. This is the Review tab in change 3.
- **"Request changes"** with a short note back to the teacher. This fixes most problems, such as tone, a name slip, or
  something too negative.
- **A fallback for the last-minute case**, such as the day before reports go out when the teacher is away. Admin can
  "take over" a report. The edit is logged with who did it, and the report shows "edited by admin". This reuses the
  activity log the system already has.

### Today vs after the change

| | Today | After |
|---|---|---|
| Who approves | Nobody. Written reports become Approved automatically when the admin starts the next semester. | Admin approves each report before it goes to families. |
| Sending back to the teacher | Not possible | "Request changes" with a note |
| Admin editing a report | Allowed, the same as a teacher, with no separate mark | Only through "take over", which is logged and shown as "edited by admin" |
| Status order | Draft → Ready → Written → Approved (at semester end) | Draft → Ready → Written → Submitted → Approved, or back to the teacher as Changes requested |

### Decided

1. **The PDF for families downloads only once the report is approved**, for everyone. Before that the report can be
   read and checked in the app. Clicking Download explains why it is not ready.
2. **A "Request changes" note shows in both places:** at the top of the child's report, and as "Changes requested" (with
   a warning mark) in the class lists.
3. **"Edited by admin" is for staff only.** It never appears on the PDF.
4. **Starting the next semester no longer approves reports by itself.** The semester page first says how many reports
   are not approved; they stay as they are. Semester 2 still shows Semester 1's ratings beside the new ones.

### Who can change a report, and when

| Report is… | Teacher | Administrator |
|---|---|---|
| Being written, or Changes requested | Changes ratings, photos and wording; submits | Reads it; can take it over |
| Waiting for review | Reads it; can **take it back** to change something | Approves, requests changes, or takes it over |
| Taken over | Reads it only | Changes anything, then approves or sends it back |
| Approved | Reads it; downloads the PDF | Downloads the PDF; can send it back if something is wrong |

The server enforces this for every change (ratings, comments, photos, photo consent, wording), not only the screens.

---

## 2. Admin manages teacher accounts

Status: **Built** (21 Oct 2026)

The admin is in charge of everyone's login. Teachers cannot create or change accounts.

### What admin can do today (Settings → People)

- Add a person (name, email, admin or teacher, temporary password)
- Reset a password (the person must choose a new one at next sign-in)
- Deactivate or reactivate an account (deactivating signs them out straight away)

### What to add

- **Edit a person:** change their name, email and role (teacher ↔ admin). The system can already change name and role,
  but the screen has no buttons for it yet.
- **Assign classes:** choose which class(es) each teacher belongs to, as lead or co-teacher. This is done on the Classes
  page (change 4), and the People page shows each teacher's classes.
- **See each teacher's progress:** next to each teacher, how many of their children are done, for example "6 of 8
  reports written".
- **Unlock an account:** after 5 wrong passwords an account is locked for 15 minutes. Admin can unlock it straight away.

### Decided

1. **Deactivate only, never delete.** The record of who wrote which report is kept.
2. **Only admin changes a name or email.** Teachers can change only their own password.

### What was built (Settings → People and sign-ins)

- **Edit** a person: name, email and role. A new email becomes their sign-in: they are signed out everywhere and sign in
  again with the new email and the same password. An email already in use is refused. Admins cannot change their own
  role or deactivate themselves. Making a teacher an administrator takes them out of their classes (admins see every
  class).
- **Classes and progress** under each teacher: their classes this semester with lead or co-teacher (each links to the
  class's page), and a bar with "6 of 8 reports written". A teacher in no class is shown in red with a link to place
  them.
- **Unlock:** a locked account shows "Locked until 3:15 pm" and an Unlock button. It lets them try again at once without
  changing their password.
- The activity log records what changed ("name, email"), never the new email itself.
- Code: `app/backend/src/domain/users.ts`, `app/frontend/src/app/(staff)/settings/people/People.tsx`. Tests: "lets the
  administrator edit, unlock and follow teachers" in `app/backend/tests/api.test.ts`.

---

## 3. Review tab: admin sees what teachers have submitted

Status: **Built** (21 Oct 2026)

A new tab, shown only to admin, called **Review**. The admin uses it as the reviewer of every child's portfolio
(learning report).

### What it shows

- **Every report across all classes**, with the teacher who wrote it, the class, the status and when it was last changed.
- **Filters:** by class, by teacher, by status (Waiting for review, Changes requested, Approved).
- **Open a report** to read it the way the family will see it, with the teacher's ratings, comments and photos beside it.
- **Versions:** each time the teacher submits, a version is kept (v1, v2, …), so admin can see what changed since the
  last review. The system already keeps old drafts when a report is rewritten, so this builds on that.
- **Actions on each report:** Approve, Request changes (with a note), or Take over (change 1).

### Rough layout

```
Review                                   [Class ▾] [Teacher ▾] [Status ▾]
─────────────────────────────────────────────────────────────────────────
Child         Class   Teacher     Status               Version  Updated
Ava T.        K1      Ms Lim      Waiting for review   v2       today
Ben K.        K1      Ms Lim      Changes requested    v1       2 days ago
Chloe W.      K2      Mr Tan      Approved             v3       last week
```

### Decided

1. **A Submit for review button**, so teachers decide when a report is finished.
2. **Changed paragraphs are marked:** the review page lists the paragraphs that changed since the version before.
3. **No email.** The menu shows how many reports are waiting, as a number on Approvals.
4. **It is called Approvals, and it replaces the administrator's Reports tab** (decided while building). The
   administrator's menu already has Reviews, so a "Review" tab beside it would read as the same thing.

### What was built

- **Teacher, on a child's report:** a status box at the top. "Ready to send?" with **Submit for review**; then
  "Waiting for review" with **Take back**; "Changes requested" with the administrator's note and **Submit again**;
  "Approved" with the PDF unlocked; or "An administrator is finishing this report" while it is taken over. While a
  report is locked the wording and ratings are read-only and say why.
- **Administrator, Approvals** (in the menu, with the number waiting): tabs for Waiting for review, Changes requested,
  Approved and Not sent yet, each with a count; filters by class and teacher; each row shows the child, class, teacher,
  status, version, "Edited by admin" and when it last changed.
- **Administrator, one report:** the report exactly as the family will see it, and beside it the paragraphs changed
  since the last version, the teacher's ratings and comments for each area, and the history (each version, who sent
  it, and what was decided, with any note). Buttons: **Approve**, **Request changes** (with a note), **Take over**
  (confirm box first).
- **Versions:** each submit freezes the report as v1, v2, … When the administrator takes over and approves, their edit
  is saved as its own version, so the record shows exactly what families get.
- **Lists:** Class, Reviews and the sidebar show Waiting for review, Changes requested (with a warning mark) and
  Approved.
- **Activity log:** submitted (with the version), taken back, approved, changes requested (the note itself is not
  logged, as it may name the child) and taken over.
- **Existing reports:** reports already written stay "Written". Their teachers submit them, and their PDFs download
  once approved.
- Code: `app/backend/db/migrations/0004_review_workflow.sql`, `app/backend/src/domain/approval.ts`,
  `app/frontend/src/app/(staff)/WorkflowPanel.tsx`, `app/frontend/src/app/(staff)/approvals/`. Tests:
  `app/backend/tests/approval.test.ts`.

---

## 4. Admin manages classes and children

Status: **Built** (21 Oct 2026)

Today there is only one class, every new teacher is put into it, and teachers add and remove children themselves. After
this change the admin sets up the school: the classes, who teaches each one, and which children are in it. Teachers then
see only their own class.

### Classes are grouped by age level, set from the child's birth year

Each class belongs to one level. A level can have several classes, for example K1 Sunflower and K1 Rainbow.

| Level | Who is in it | Teacher ratio | Most children per teacher |
|---|---|---|---|
| PG (Playgroup) | Year they turn 2 (about 18 months to 2 years; the school's site gives no age, so this needs confirming) | 1:6 | 6 |
| N1 | Year they turn 3 | 1:8 | 8 |
| N2 | Year they turn 4 | 1:10 | 10 |
| K1 | Year they turn 5 | 1:12 | 12 |
| K2 | Year they turn 6 | 1:15 | 15 |

**How the level is worked out:**

- The level comes from the **year the child is born**, not their exact age today. A child turning 4 in January and one
  turning 4 in December are both N2.
- Level = the age they turn **this calendar year**. In 2026: born 2022 → turns 4 → N2. Born 2021 → turns 5 → K1.
- The date of birth is already stored on each child, so the system works this out. Admin does not choose the level.
- **No exceptions.** A child is only ever in a class of their own level: a six-year-old can never join PG. A child who
  is too young for PG, or turns 7 or older this year, cannot be added to any class.
- No cut-off date or age-in-months rule is published, so the calendar year is the only rule.

**What this means in the app:**

- When admin adds a child, the level is filled in from the date of birth and admin picks one of that level's classes.
  A child cannot be put in a class of a different level, and a birthday is required.
- Each class shows its birth year, for example "K1 Sunflower · turning 5 in 2026".
- The system already stores a level on each class, but only Nursery, K1 and K2. These become PG, N1, N2, K1 and K2.
  Existing "Nursery" classes need mapping to N1 or N2.
- **Teacher ratio:** each class warns when it has more children than its teachers allow. For example, a K1 class with one
  teacher warns at 13 children, and adding a co-teacher raises the limit to 24.

### What admin can do (a new Classes page)

- **See all classes**, grouped by level. For each class: the name, the **lead teacher**, the **co-teachers**, the number
  of children, and whether it is within the teacher ratio.
- **Create, rename and remove a class.** A class can only be removed when it has no children left in it.
- **Assign teachers:** pick one lead teacher and any number of co-teachers for each class. A teacher can be in more than
  one class.
- **Open a class** to see its children, with each child's review status (Draft, Ready, Written, Approved).
- **Add a child** (preferred name, legal name, Chinese name, date of birth, pronoun, photo consent). The level is set from
  the date of birth, and admin picks the class.
- **Move a child** to another class at the same level, for example if they were placed in the wrong one.
- **Mark a child as left** when they leave the school. Their past reports are kept.

### What changes for teachers

- Teachers **no longer add or remove children**. They see the children the admin has put in their class.
- Teachers see **only their own class(es)**. A teacher in two classes can switch between them.
- Lead and co-teachers can both fill in reviews and write reports for the class.

### At the start of a new semester

- **Semester 1 to Semester 2 (same year):** nothing moves. Classes, teachers and children carry over as they are.
- **Semester 2 to Semester 1 (new year):** every child moves up one level, because they turn a year older. N1 becomes N2,
  N2 becomes K1, K1 becomes K2, and K2 children are marked as left (they go on to primary school). Admin then sorts the
  children into the new year's classes. Each child's earlier ratings and reports stay with them, so the new report can
  still show last semester beside the new one.

### Decided

1. **PG is "the year they turn 2"** for now. Still to confirm with the school (admin@peterhouse.sg); it is one line to
   change in `app/shared/src/classes.ts`.
2. **Lead and co-teacher are equal.** Both can rate and write; "lead" is a label (one per class).
3. **Classmates stay together in the new year.** "K1 Sunflower" becomes "K2 Sunflower" with the same children and teachers;
   admin adjusts afterwards. A class named without its level in front keeps its name.
4. **Teacher ratio only warns.** Admin can still add the child.
5. **Every active child is in a class.** There is no "not yet placed".
6. **No level exceptions** (decided 21 Oct 2026). A child can only join, or move to, a class of their own level. A
   corrected birthday that gives another level moves the child to a class of that level at the same time.
7. **One menu item for the admin** (decided 21 Oct 2026). The admin's menu has **Classes** only, not "Class" and
   "Classes": Classes is the admin's home, and the list of every child is under Reviews ("Everyone"). A teacher's menu
   keeps **Class** for their own class, since teachers have no Classes page.

### What was built

- **Classes page** (admin only; **Classes** replaces "Class" in the admin's menu and is their home page): every class this semester grouped by level (PG, N1, N2, K1, K2), with
  its birth year, lead and co-teachers, children count against the ratio, and a list of children whose level needs a
  check (no birthday, too young, too old, or a birthday that no longer fits the class).
- **A class's page:** rename, change level (only while empty), remove (only while empty), choose the lead and
  co-teachers, and the class's children with their review status. Per child: edit details, move to another class of the same level, mark
  as left the school (and return), or remove a child added by mistake. Children who left are listed separately.
- **Add a child** (admin only): the birthday is required and shows the level ("Turns 5 in 2026, so K1"), and only that
  level's classes can be chosen. Moving a child offers only other classes of the same level. The server refuses any
  other placement, whatever the screen sends.
- **Teachers** no longer see Add or Remove. They see only their own classes; with more than one class, a class filter
  appears on Class, Reviews and Reports. A teacher in no class is told to ask the administrator.
- **New year** (starting Semester 1): every class moves up a level with its children and teachers, K2 classes end, and
  K2 children are marked as left. Semester 1 to Semester 2 changes nothing.
- **Reports** now print the child's own class name and its teachers (lead, then co-teachers). The old "Class name" and
  "Teacher name(s)" settings are gone from Settings.
- **Existing data:** "Nursery" classes become N2. The old automatic class keeps its name ("Class", or the class name
  that was in Settings). When several teachers were all "lead", the longest-standing stays lead and the rest become
  co-teachers. New teacher accounts are no longer put in a class automatically: place them on the class's page.
- Code: `app/backend/db/migrations/0003_classes.sql`, `app/shared/src/classes.ts`, `app/backend/src/domain/classes.ts`,
  `app/frontend/src/app/(staff)/classes/`. Tests: `app/backend/tests/classes.test.ts`.

## 5. Class calendar

Status: **Built** (21 Oct 2026)

A calendar that shows what is coming up for each class. **Admin manages it; teachers can only see it.** It is for staff
only; families do not see it.

### What goes on the calendar

| Type | Example | Repeats? | Who it applies to |
|---|---|---|---|
| **Weekly timetable** | K1 Sunflower meets Mon to Fri, 8:30–12:30 | Every week | One class |
| **Class event** | K1 Sunflower trip to the Science Centre, 14 Nov | Once | One or more classes |
| **School event** | Sports Day, Graduation, Children's Day | Once | Whole school, or one or more levels |
| **Closure / holiday** | Public holiday, school holiday, staff training day | Once, or a date range | Whole school |
| **Report deadline** | "Semester 2 reports due for review: 28 Nov" | Once | Staff |

Every entry has a title, a date (or date range), an optional start and end time, an optional place and an optional note.

### What admin can do (a new Calendar page)

- **Set each class's weekly timetable:** which days it meets and its hours. Nothing more detailed (no hour-by-hour
  activities).
- **Add, edit and remove events,** and choose who they apply to: the whole school, one or more levels (for example all
  K1 and K2 classes), or one or more classes.
- **Add closures and holidays.** On those days the weekly timetable is hidden, so nobody sees a normal school day.
- **Set report deadlines,** linked to the review step in changes 1 and 3. Teachers see how many days are left.
- Every change is recorded in the activity log.

### What teachers see

- **Only their own class(es),** plus school-wide events and closures. A teacher in two classes sees both, colour-coded.
- **Three views:**
  - **Upcoming:** a short list on the home (Class) page of the next 7 days, for example "Tomorrow: Library visit, 10:00".
  - **Week:** Monday to Friday, with the timetable and any events.
  - **Month:** a month grid with events and closures.
- Teachers **cannot add or change entries.** If something is wrong they ask the admin.

### Link to Google Calendar or Outlook

- Each person gets a **calendar link** on the Calendar page, with "Add to Google Calendar" and "Add to Outlook"
  buttons. Once added, the Peterhouse calendar appears in their own calendar app and **updates by itself** when admin
  changes something.
- The link shows only what that person can see: a teacher gets their own classes plus school-wide entries; admin gets
  everything.
- **Reminders come from Google Calendar or Outlook,** not from this system. Each teacher sets their own reminder (for
  example 1 day before) in their calendar app, and it emails or notifies them. The system does not send emails itself.
- The link is private to each person and can be **reset** if it is shared by mistake. Deactivating a teacher stops their
  link working.
- Calendar entries never contain a child's name, so nothing private leaves the system through the link.
- Note: Google Calendar refreshes a linked calendar every few hours, so a change can take a while to show on phones. The
  app itself always shows the latest.

### Rough layout (Week view, teacher)

```
Calendar     K1 Sunflower ▾        ‹  10–14 Nov 2026  ›     [Upcoming] [Week] [Month]
────────────────────────────────────────────────────────────────────────────────────
Mon 10        Tue 11          Wed 12         Thu 13           Fri 14
8:30–12:30    8:30–12:30      8:30–12:30     8:30–12:30       School closed
                                                           Staff training day
                              Library 10:00
```

### Decided

1. **Staff only** for now. Families do not see the calendar.
2. **Timetable is days and hours only,** not activities hour by hour.
3. **Reminders through Google Calendar or Outlook,** using the calendar link above. No emails from this system.
4. **Teachers cannot propose events** for now. Admin only. This may be added later.
5. **Link to Google Calendar and Outlook** (a calendar link that stays up to date), not a one-off download.
6. **The calendar link carries the events, closures and report deadlines, not the weekly hours** (decided while
   building). Hours every school day would fill everyone's own calendar; they show in the app's Week view instead.
7. **On phones, Questions and People leave the bottom bar** (decided while building), so it fits five buttons with
   Calendar added. Both stay in the desktop sidebar and on Settings.

### What was built

- **Calendar in the menu** for everyone. Three views: **Upcoming** (the next four weeks as a list, with "in 5 days"
  beside a report deadline), **Week** (Monday to Friday, plus a weekend day only when something is on, with each class's
  hours; no hours on a closed day) and **Month** (a grid; on a phone, a list). A teacher in two classes sees each class's
  hours in its own colour, and anyone with several classes can narrow it to one.
- **Teacher's Class page:** "Coming up this week", for example "Tomorrow: Library visit, 9:00 · Bishan Library" and
  "Monday: Reports due: December reports · 5 days left".
- **Administrator:** **Add an entry** (Event, School closed or Report deadline; dates, all day or times, place, note,
  and who it is for: whole school, some levels or some classes). Clicking any entry opens it to change or remove it.
  A closure is always for the whole school. (The hours-only **Timetables** tab built here was replaced by change 7:
  a class's hours now come from its lessons.)
- **Calendar link:** **Add to Google Calendar**, **Add to Outlook**, **Copy link** and **Reset link** (confirm box).
  Each link shows only what that person can see. Deactivating someone stops their link for good; resetting stops the
  old one at once. Times are sent in Singapore time. On this computer (localhost) the page says Google and Outlook
  cannot reach it; on the school's server they can.
- **New semester:** each class keeps its hours and its class entries.
- **Activity log:** entries added, changed and removed, timetables set, links reset (never the entry's wording).
- Code: `app/backend/db/migrations/0005_calendar.sql`, `app/backend/src/domain/calendar.ts`,
  `app/backend/src/routes/calendar.ts`, `app/frontend/src/app/(staff)/calendar/`, `app/frontend/src/lib/calendar.ts`.
  Tests: `app/backend/tests/calendar.test.ts`.

---

## 6. Show the semester less

Status: **Built** (21 Oct 2026)

Peterhouse keeps **two learning reports a year**, so the semester stays in the system: it dates each report, lets the
December report show June's ratings beside the new ones, keeps each half-year as a record, and moves classes up a level
in January. What changes is how often staff see it.

- **Remove it from everyday screens:** the sidebar, the phone header, the class board, the Classes page, the ratings
  page header, and the sidebar progress card ("Semester progress" becomes "Report progress").
- **Keep it only where it matters, in plain words:** "December 2026 reports" instead of "Semester 2 2026", on
  Approvals, Settings → Report details, Start next semester, and the report itself.
- **On the report families read:** "↑ since June" and "June: Regularly" instead of "since Semester 1".
- Nothing changes underneath: the same two periods (January to June, July to December) and the same rules.

---

## 7. Subject timetable

Status: **Built** (21 Oct 2026)

Each class has a **fixed weekly timetable of subjects**: which subject, on which day, at what time. It repeats every
week of the semester. The administrator manages it; teachers see it. This replaces the "days and hours only"
timetable of change 5: a class's hours become its first lesson to its last.

### Subjects (admin)

- A **subject list** the administrator manages: name and colour, for example English, Chinese 华文, Mathematics,
  Circle time, Outdoor play, Music, Art, Snack.
- A subject can be **linked to a learning area** (English, Chinese, Maths, Social-Emotional, Self-Enrichment), so the
  timetable and the learning reviews use the same words. Others (Snack, Outdoor play) are not rated.
- A subject in use cannot be deleted, only hidden from new timetables.

### A class's weekly timetable (admin)

- A **week grid** for each class: Monday to Friday (Saturday if needed) down the side, time across, one block per
  lesson. Each block: subject, start and end time, and optionally the teacher and the room.
- **Rules:** lessons in one class cannot overlap; a teacher cannot be in two classes at the same time (warning).
- **Copy to other classes:** "Copy K1 Sunflower's timetable to K1 Rainbow", since classes of a level are often the same.
- **New semester:** the timetable carries over with the class, like its teachers.

### What staff see

- **Calendar → Week:** each day lists that class's lessons in order ("9:00 English · 9:45 Chinese · 10:30 Snack…"),
  with events beside them. On a closed day, no lessons.
- **A Timetable view** in Calendar: the class's week as a grid, the way a printed timetable looks. Layout to follow:
  the shadcn "Class timetable" block (http://shadcn.io/blocks/calendar-class-timetable), in Peterhouse's light theme.

  ```
  K1 Sunflower timetable                                    ‹  This week  ›   [K1 Sunflower ▾]
  ───────────────────────────────────────────────────────────────────────────────────────────
             Mon            Tue            Wed            Thu            Fri
   8:30   Circle time    Circle time    Circle time    Circle time    Circle time
   9:00   English        Chinese 华文    English        Chinese 华文    Maths
          Room 2         Room 2         Room 2         Room 2         Room 2
   9:45   Snack          Snack          Snack          Snack          Snack
  10:15   Maths          Outdoor play   Music          Maths          Art
  ───────────────────────────────────────────────────────────────────────────────────────────
  English · Room 2 · Ms Lim                                              (the lesson you tapped)
  ```

  - Days across the top, times down the side, one coloured block per lesson with the subject and room.
  - Each subject keeps its own soft colour everywhere (a tint, with dark text so it stays readable).
  - Tapping a block shows its details underneath: subject, room, teacher. For the administrator, tapping opens it to
    change it, and tapping an empty slot adds a lesson there.
  - ‹ › moves week to week, so a closed day or an event shows on the right week.
  - On a phone the grid becomes one day at a time, with Mon–Fri tabs.
- **Teacher's Class page:** "Today" under "Coming up this week", for example "Now: Chinese until 10:30 · Next: Snack".

### Decided

1. **Subjects to start with: English, Chinese 华文, Maths and Happy Hour.** The school manages the list itself in the
   app (add, rename, recolour, hide), so this is only the start. English, Chinese and Maths are linked to their learning
   areas. Social-Emotional and Self-Enrichment are not timetabled subjects; they stay as rated areas in the review.
2. **Subject teachers exist and manage their own lessons.** A lesson names its teacher. A teacher who teaches a
   subject in a class:
   - sees that class and its children (calendar, timetable, child list);
   - **rates and comments only their subject's area** (the Chinese teacher rates Chinese) and can add photos for it;
   - **adds, moves and removes their own lessons** of that subject in that class. Only the administrator puts a
     teacher on a class's timetable in the first place, so nobody can give themselves access to other children.
   The class's lead and co-teachers still rate the other areas, write the report and submit it.
3. **One timetable per class**, with "copy to other classes".
4. **Lessons stay out of the personal calendar link.** The app shows them.
5. **Any time in 5-minute steps**, not fixed blocks.

### What was built

- **Settings → Subjects** (admin): the subject list with name, colour and the learning area it is rated in ("Not
  rated" for Happy Hour). Add, rename, recolour, hide; remove only when no lesson uses it. Starts with English,
  Chinese 华文, Maths and Happy Hour.
- **Timetable page** (everyone; its own menu item, apart from Calendar, which is for events, closures and deadlines):
  one class's week as a drag-and-drop grid: days across, hours down, class chips on top, a subject list beside it.
  Drag across empty hours or drag a subject onto the week to add a one-hour lesson; drag a lesson to move it, drag its
  bottom edge to resize; overlaps are refused. Click a lesson to change its subject, teacher or room (saved as you go,
  with Undo). It is the same every week, so there are no week arrows. On a phone, one day at a time with Mon–Fri tabs
  and a tap-to-add row for each free hour. `/calendar?view=timetable` redirects here.
- **Editing lessons:** the administrator adds a lesson (button, or the + in an empty slot), changes or removes one,
  and **copies a timetable to other classes**. A subject teacher adds, moves and removes their own lessons of their
  subject in that class. Overlaps in a class are refused ("It overlaps English (9:00–9:45) in this class."); a teacher
  booked in two classes at once is allowed with a warning.
- **Calendar → Week:** with one class in view, each day lists its lessons ("9:00 English · 9:45 Chinese…"); with
  several, each class's hours (first lesson to last).
- **Teacher's Class page:** "Now: English until 9:45 · Next: Chinese 华文, 9:45 · Room 2".
- **Subject teachers in reviews:** they see the class's children, rate only their subject's area (and add its photos),
  and are told so at the top of the form. They cannot write or submit the report. People and sign-ins lists their
  classes as, for example, "K1 Sunflower (Chinese 华文)".
- **New semester:** each class keeps its lessons.
- **Activity log:** lessons added, changed, removed and copied; subjects added, changed and removed.
- Code: `app/backend/db/migrations/0006_subject_timetable.sql`, `app/backend/src/domain/timetable.ts`,
  `app/backend/src/routes/timetable.ts`, `app/frontend/src/app/(staff)/calendar/TimetableGrid.tsx`,
  `app/frontend/src/app/(staff)/settings/subjects/`. Tests: `app/backend/tests/timetable.test.ts`.

---

## 8. Different review questions for different ages

Status: **Built** (21 Oct 2026). Live once an administrator publishes the questions (see below).

(Written in another session as "change 6" on 21 Oct 2026; restored here as change 8 because 6 and 7 were
already used. Wording unchanged.)

Today every child gets the same 16 questions. That does not work across the whole school. A Playgroup child cannot
"recognise letters" or "count objects one by one", so they would score 1 on most of the form, and families would read that
as "behind" when it is normal for the age. After this change the questions depend on the child's level (change 4).

### What Singapore's official guidance says

- **Birth to 3 years: [ECDA Early Years Development Framework (EYDF) 2023](https://www.ecda.gov.sg/early-childhood-educators-(ece)/curriculum-frameworks/early-years-development-framework).**
  Four areas: Cognitive, Communication and Language, Physical, and Social and Emotional. Each area has developmental goals
  with example behaviours for "Toddlers (18 months to below 4 years)". The examples are there so educators can observe
  and document. The framework warns that children develop at very different rates and timing, and it gives no numeric scale.
- **Ages 4 to 6: [MOE Nurturing Early Learners (NEL) Framework 2022](https://nel.moe.edu.sg/the-nel-framework/overview/).**
  Five learning areas: Aesthetics and Creative Expression, Discovery of the World, Health, Safety and Motor Skills,
  Language and Literacy (English and Mother Tongue), and Numeracy. A separate strand covers values, social-emotional skills
  and six learning dispositions (perseverance, reflectiveness, appreciation, inventiveness, sense of wonder and curiosity,
  engagement). The [end-of-preschool outcomes](https://moe.gov.sg/preschool/curriculum) include sharing and playing with
  others, communicating thoughts and feelings, and being curious.
- **How children are assessed:** by teachers observing and documenting, using open-ended questions. No formal tests are
  mentioned. The 1 to 5 scale is Peterhouse's own.

### What could not be confirmed

The detailed age-by-age pages for ages 4 to 6 are in linked PDFs that have not been read (for example "Learning and
Development of Reading Skills (From Birth to K2)" and the numeracy guides). No Mother Tongue (Chinese) detail was found, so
the Chinese questions below are the weakest and most need a Peterhouse teacher.

### Two question sets, with a lighter Playgroup version

Singapore's split is at age 4, which fits the school's levels:

| Set | Levels | Based on |
|---|---|---|
| A | PG and N1 | EYDF toddler band (18 months to below 4 years) |
| B | N2, K1, K2 | NEL (ages 4 to 6) |

- **Playgroup is lighter:** 3 questions per area instead of 4, and more weight on photos and short notes than on ratings.
  "Not seen yet" will be common at this age, and that is fine.
- **The scale is "how the child is doing for their age".** 3 (Regularly) means typical for the age group. The scale labels
  stay fixed for everyone (see the existing rule that labels are not editable).
- **Keep a few shared questions across both sets** (for example "settles into the routine", "joins in music and
  movement"), so a child moving from N1 to N2 can still be compared on those. Questions that exist in only one set show no
  comparison, which matches the existing rule that a different skill gets a new question ID.
- **Reports use growing language for the youngest** ("is beginning to…", "is starting to…") and never rank a child.

### Draft questions (placeholders for a Peterhouse teacher to approve)

Wording is adapted from the EYDF toddler examples and the NEL area descriptions.

| Area | Set A: PG and N1 | Set B: N2, K1, K2 |
|---|---|---|
| **English** | {name} follows simple directions, such as putting away a toy. | {name} listens well and responds in a group. |
| | {name} describes what they are doing in 2 to 3 words. | {name} speaks in clear sentences to share ideas. |
| | {name} asks for favourite stories, songs or rhymes. | {name} enjoys books and can talk about what happened. |
| | N1 only: {name} responds to simple "who, what, where" questions. | {name} recognises letters and the sounds they make. |
| **Chinese** | {name} joins in Chinese songs and rhymes with actions. | {name} understands simple instructions in Chinese. |
| | {name} says familiar Chinese words. | {name} speaks simple Chinese words and phrases. |
| | {name} responds to simple Chinese instructions. | {name} joins in Chinese songs, rhymes and stories. |
| | | {name} recognises some familiar Chinese characters. |
| **Mathematics** | {name} sorts, stacks and fits objects together. | {name} counts objects one by one accurately. |
| | {name} notices "more" and "bigger". | {name} compares size and amount. |
| | {name} finds a hidden object under 2 or 3 covers. | {name} names basic shapes and spots them around the room. |
| | | {name} sorts things and notices simple patterns. |
| **Social-Emotional** | {name} settles into the routine happily. | {name} settles into the class routine happily. |
| | {name} shows feelings and takes comfort from adults. | {name} can say how {he/she/they} feels. |
| | {name} plays alongside friends and begins to take turns. | {name} shares and takes turns with friends. |
| | | {name} shows kindness and cares for others. |
| **Self-Enrichment** | {name} moves to music and action songs. | {name} joins in music and movement. |
| | {name} explores messy play, paint and play dough. | {name} enjoys art and making things. |
| | {name} is active outdoors: climbs, runs and kicks a ball. | {name} joins in active outdoor play. |

**Gap to decide:** NEL treats Discovery of the World (curiosity, asking why, exploring) and learning dispositions as core,
and the current five areas have no clear home for them. Suggested: add one curiosity question to Self-Enrichment, for
example "{name} asks why and explores new things", rather than a sixth area.

### What changes in the system

- Each question set is a rubric for a level group, under the same five areas. Question IDs stay permanent, and shared
  questions use the same ID in both sets.
- When a review is opened, the set is chosen from the child's level and frozen (the existing `rubric_version` rule).
- The admin question editor gets a level switcher (PG and N1, N2 to K2) above the area list. Limits per area stay at
  3 to 6 questions.
- A child who moves up a level at the start of a new year (change 4) gets the new set. Their old reviews keep the old set.
- The AI writer is told the child's level, so it chooses age-appropriate wording and never compares a child to others.

### Changes to this proposal (agreed 21 Oct 2026)

1. **Questions are stored per level, not as two sets.** One question list; each question is ticked for the levels it
   applies to (PG, N1, N2, K1, K2). The editor shows the two sets as views (Set A: PG and N1; Set B: N2, K1, K2), but an
   "N1 only" question is simply ticked for N1, and Playgroup's lighter set is the Set A questions ticked for PG. The 3 to
   6 questions per area are checked for each level.
2. **The scale keeps its meaning.** 3 (Regularly) still means "shows it regularly in familiar situations", not "typical
   for their age". The labels describe what the child does, as the original specification chose, so a teacher never
   compares children. Age-appropriateness comes from the questions.
3. **Progress is compared only within the same level.** A question shared by both sets may ask more of an older child,
   so a child moving from N1 to N2 in January is not compared with their N1 ratings. The December report still compares
   with the June report of the same year, at the same level.

### Decided

1. **Wording:** the draft questions above go in as placeholders. A Peterhouse teacher approves or changes them on the
   Questions page; nothing waits for that.
2. **N1 is in Set A.**
3. **Playgroup has 3 questions per area.**
4. **Curiosity goes into Self-Enrichment** as one question for N2, K1 and K2: "{name} asks why and explores new
   things". No sixth area.
5. **The same report layout for all levels** (the proposal gave no suggestion; this is the simplest, and can change
   later).
6. **PG stays "the year they turn 2"** until the school confirms (as in change 4).

Where a Set A question and a Set B question say nearly the same thing, they are one shared question ticked for every
level: "settles into the class routine happily", "joins in music and movement", "joins in active outdoor play",
"understands simple instructions in Chinese", "joins in Chinese songs, rhymes and stories".

### What was built

- **One question list with levels.** Every question carries the levels it is asked at. The starting set is the
  draft above: Set A questions for PG and N1 (one English question for N1 only), the original questions for N2, K1
  and K2, the five shared questions for every level, and the curiosity question for N2 to K2. Playgroup has 3
  questions in every area; N1 has 4 in English; N2 to K2 have 4 in every area.
- **A review asks only its child's level's questions.** They are copied (frozen) when the review is first opened, with
  the level noted on the copy.
- **Questions page:** "All questions · Set A · PG, N1 · Set B · N2, K1, K2" views; five level chips on each question to
  ask it at a level or not; "3 to 6 questions for each level · PG 3, N1 3, N2 5…" per area (red when out of range); a
  level picker when adding a question. The 3-to-6 rule is checked per level, so a level can never be left with too
  few or too many. Moving questions up and down is offered in "All questions" only.
- **Preview:** a PG / N1 / N2 / K1 / K2 picker shows exactly the form each age group gets.
- **Publishing:** a change of levels is a change to publish ("Levels · Asked at N2, K1, K2").
- **"Since last time"** compares only with an earlier report at the same level.
- **Writing:** the writing service is told the child's age group and to use growing language for PG and N1, and never to
  compare children. The built-in writer no longer says "inspires friends" about a two-year-old: at PG and N1 the
  highest ratings read "is growing in confidence here: now…".
- **Existing data:** the migration tags the original questions and adds the new ones to the **draft**. Nothing reaches a
  review until an administrator presses **Publish** on the Questions page. Reviews already opened keep their questions.
- Code: `app/backend/db/migrations/0007_questions_by_level.sql`, `app/shared/src/rubric-default.ts`,
  `app/backend/src/domain/questions.ts`, `app/frontend/src/app/(staff)/questions/`. Tests: "questions by level" in
  `app/backend/tests/questions.test.ts`, "asks each age group its own questions" and "writing for the youngest" in
  `app/backend/tests/calc.test.ts`.

---

## 9. One review page for the administrator

Status: **Built** (21 Oct 2026)

The administrator has two pages that show the same reports. **Reviews** is a card for every child, with filters for
"Waiting for review", "Changes requested" and "Approved". **Approvals** is a table with tabs for the same statuses. Keep
Approvals and remove Reviews for the administrator.

### What changes

- **Administrator menu:** Classes, Approvals, Calendar, Questions, People, Settings. Reviews is removed.
- **`/reviews` for an administrator** goes to Approvals. Old links still work.
- **Approvals gains what only Reviews had:**
  - **Search by child name** next to the class and teacher filters.
  - **Progress on "Not sent yet":** a column showing "12 of 16 rated", "Ready to write" or "Report written", so the
    administrator can see who is behind before the deadline.
- **Adding a child** stays on the Classes page, where it already is.
- **Teachers are not affected.** They keep Class, Reviews and Reports.
- After "Write report", the sidebar's "all done" link goes to Approvals, as it already does.

### Decisions

1. **"Waiting for review" stays the first tab.** When nothing is waiting, its empty message links to "Not sent yet".
2. **The tab keeps the name "Not sent yet".**

### What was built

- **Administrator menu:** Classes, Approvals, Calendar, Timetable, Questions, People, Settings.
- **Old links:** `/reviews` opens "Not sent yet", `/reviews?show=all` opens Approvals, and `/reports` opens "Approved".
  A child's page highlights Approvals in the menu.
- **Search by name** sits in one row with the class and teacher filters, and the address keeps it.
- **"Not sent yet"** shows Student, Class, Class teachers and Progress. Progress is a small bar with "Not started",
  "12 of 16 rated", "Ready to write" or "Report written". Sorting by Progress puts the furthest behind first.
- **The sidebar's progress card** links to "Not sent yet" while reports are still to do, and to Approvals once all are
  written. The administrator's child list and "Add a child" button in the sidebar are gone. Children are added on
  the Classes page.
- **Also fixed:** the class and teacher filters, here and on the teacher's board, no longer stretch to full width.
- Code: `app/frontend/src/app/(staff)/approvals/`, `ClassRail.tsx`, `reviews/page.tsx`, `reports/page.tsx`.

---

## 10. Settings holds only settings

Status: **Built** (21 Oct 2026)

Classes and Questions are pages of their own in the menu, so Settings no longer lists them. People moves the other way:
it leaves the menu and is reached from Settings only.

- **Settings, for the administrator:** My account, Report details, Subjects, People and sign-ins, Activity log, Start
  next semester. Search in Settings no longer finds Classes or Questions.
- **Administrator menu:** Classes, Approvals, Calendar, Timetable, Questions, Settings. On a People page, Settings is
  highlighted.
- **Phone bar (administrator):** Classes, Approvals, Calendar, Questions, Settings. Questions used to be reachable on a
  phone only through Settings; it now has its own place, which People's removal left free. Timetable is still reached from
  Calendar.
- Code: `app/frontend/src/app/(staff)/settings/sections.ts`, `ClassRail.tsx`.

---

## 11. Wider question editor and a tidier preview

Status: **Built** (21 Oct 2026)

- **Questions page:** the right-hand Scale labels and Activity column is removed, so the questions use the full width.
  The scale labels cannot be edited anyway, and they still appear on every rating in the preview and the review form.
  The questions' history is still in Settings → Activity log.
- **Publish preview:** the area tabs were the review form's large cards squeezed into half the page, so names were cut
  off ("Eng…") and "4 questions" wrapped. They are now one-line pills (icon, name, number of questions) that wrap onto a
  second row. On a phone they scroll sideways, as on the review form.
- Code: `app/frontend/src/app/(staff)/questions/QuestionsEditor.tsx`, `questions/publish/PublishView.tsx`,
  `app/frontend/src/app/legacy.css`.

---

## 12. A class's teachers are chosen on the class, not on the timetable

Status: **Built** (21 Oct 2026)

Today, naming a teacher on any lesson quietly gives them that class (change 7). For example, george leads PG Poopy
Playtime, but being named on one MiaoMeow Maths lesson made MiaoMeow and its children appear on his board. Who teaches a
class should be decided in one place, the class itself, and the timetable should only offer those people.

### What changes

- **The class page gets a third kind of teacher:** lead, co-teachers, and **subject teachers**, each with the subjects
  they teach there ("Ms Wong · Chinese"). Only the administrator adds them, as with lead and co-teachers.
- **The timetable's teacher list shows only the class's teachers.** For a lesson, the list is the lead, the co-teachers,
  and the subject teachers for that lesson's subject. Anyone else cannot be chosen, and the server refuses them too.
- **Who sees a class comes only from the class page.** A subject teacher still rates only their subject and cannot
  write or send the report (as in change 7).
- **Removing someone from a class** clears them from that class's lessons. The lessons stay, with no teacher named.
- **Existing lessons:** a lesson whose teacher is not one of the class's teachers keeps its time and subject, but has its
  teacher cleared. Locally this is george on MiaoMeow's Tuesday Maths.

### Decisions

1. **Subject teachers are kept**, and added on the class page.
2. **Existing lessons with an outside teacher have the teacher cleared.**

### What was built

- **Class page → Subject teachers** card under Teachers: each subject teacher with their subjects, "Change subjects" and
  "Remove from class", and "Add a subject teacher" (choose the teacher, tap their subjects, Save). A lead or co-teacher
  cannot also be a subject teacher of the same class; making a subject teacher a co-teacher replaces their subject place.
- **Timetable:** a lesson's teacher list shows the class's lead and co-teachers, and the subject teachers of that
  lesson's subject. Changing a lesson's subject clears a teacher who does not teach the new one. The server refuses
  anyone else: "Choose one of this class's teachers. Add a subject teacher to the class on its Classes page first."
- **Who sees a class** (board, children, reviews, calendar, timetable, People list) comes from lead, co-teacher and
  subject teacher only. A lesson alone never gives anyone a class.
- **Taking someone off a class** (as lead, co-teacher or subject teacher) clears them from its lessons.
- **Copying a timetable** to another class leaves off teachers who do not teach that class.
- **Next semester** copies subject teachers with each class.
- **Timetable opens on your own class first**, then the classes you teach a subject in.
- **Existing data:** migration `0008_subject_teachers.sql` cleared george from MiaoMeow's Tuesday Maths lesson, so he
  now sees only PG Poopy Playtime.
- Code: `app/backend/src/domain/staff.ts`, `classes.ts` (`setSubjectTeacher`), `timetable.ts`,
  `app/frontend/src/app/(staff)/classes/[id]/ClassManager.tsx` (`SubjectTeachers`), `timetable/TimetableGrid.tsx`.
  Tests: `app/backend/tests/timetable.test.ts`.

---

## 13. One Students page for teachers

Status: **Built** (21 Oct 2026)

Teachers had Class, Reviews and Reports in the menu, and all three showed the same children (Everyone, To do, Reports
ready). They are now one item, **Students**.

- **Teacher menu:** Students, Calendar, Timetable, Settings. The phone bar shows all four.
- **Students** is the teacher's home: "Coming up this week", then their students with Everyone, To do and Reports ready.
  Each card's button goes straight to the next step: Start, Continue, Write report, or Open report.
- **Old links:** `/reviews` opens Students → To do, `/reports` opens Students → Reports ready. The class filter is kept.
- A child's review and report pages highlight Students. The report's back link reads "← Students".
- The sidebar's progress card opens To do while reports are left, then Reports ready.
- Code: `app/frontend/src/app/(staff)/ClassRail.tsx`, `Board.tsx`, `reviews/page.tsx`, `reports/page.tsx`.

---

## 14. Teacher and children tables for the administrator

Status: **Built** (21 Oct 2026)

The administrator sees teachers and children only one class at a time (Classes), or as accounts (Settings → People and
sign-ins). They need the whole school at a glance, in tables.

### What changes

- **Classes page gets three tabs:** Classes (as now) · Teachers · Children. The menu stays the same.
- **Teachers table:** one row per teacher.
  - Columns: name, classes (lead / co-teacher / subject teacher with subjects, e.g. "MiaoMeow · Maths"), number of
    children, reports written this semester ("3 of 5"), last sign-in.
  - Filters: search by name, class.
  - A teacher in no class is flagged "Not in a class". The row opens their class; the account itself is still edited in
    People and sign-ins.
- **Children table:** one row per child this semester.
  - Columns: name (with Chinese name), birthday, level, class, class teachers, report status.
  - Filters: search by name, level, class, status. Every column sorts, as on Approvals.
  - Children marked as left can be shown with "Show children who left".
  - A child whose birthday no longer fits their class's level is flagged, as on the Classes page. The row opens the
    child's class.
- **Phone:** the tables scroll sideways, with the name column fixed.

### Decisions

1. **Tabs on the Classes page**, not new menu items.
2. **A row opens the class.**

### What was built

- **Classes page tabs:** Classes · Teachers · Children, each with its count. The address keeps the tab
  (`/classes?tab=teachers`).
- **Teachers:** Teacher, Classes (each a link, with Lead, Co-teacher or the subjects taught), Children, Reports written
  ("2 of 2"), Last sign-in. Search by name and filter by class. Inactive accounts are not listed. A teacher in no class
  shows "Not in a class". A note links to Settings → People and sign-ins for accounts.
- **Children:** Child (with Chinese name), Birthday, Level, Class, Class teachers, Report. Search by name, and filter
  by level, class and report status. "Show children who left (n)" appears when any have left. A warning sign marks a
  child whose birthday no longer fits their class's level.
- **Every column sorts:** the first click sorts ascending, the next descending, the next restores the default order.
- **A row opens the class** (a teacher's own class first, before one where they only teach a subject).
- **Phone:** the tables scroll sideways with the name column fixed.
- Code: `app/frontend/src/app/(staff)/classes/Tables.tsx`, `classes/page.tsx`. The classes view now also returns
  every child this semester (`ClassesView.pupils`).
