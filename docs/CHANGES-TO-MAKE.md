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

Status: **Agreed**

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

---

## 6. Show the semester less

Status: **Agreed** (21 Oct 2026)

Peterhouse keeps **two learning reports a year**, so the semester stays in the system: it dates each report, lets the
December report show June's ratings beside the new ones, keeps each half-year as a record, and moves classes up a level
in January. What changes is how often staff see it.

- **Remove it from everyday screens:** the sidebar, the phone header, the class board, the Classes page, the ratings
  page header, and the sidebar progress card ("Semester progress" becomes "Report progress").
- **Keep it only where it matters, in plain words:** "December 2026 reports" instead of "Semester 2 2026", on
  Approvals, Settings → Report details, Start next semester, and the report itself.
- **On the report families read:** "↑ since June" and "June: Regularly" instead of "since Semester 1".
- Nothing changes underneath: the same two periods (January to June, July to December) and the same rules.
