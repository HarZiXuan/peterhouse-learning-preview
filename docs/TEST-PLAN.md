# Staff system test plan

Manual pass of the local app at `http://localhost:3000` (API on port 4100). Sign in as the local QA administrator, then as the local QA teacher. Credentials are in `app/backend/.env` (`QA_ADMIN`, `QA_TEACHER`). Do not change passwords, approve or send back a real report, delete a child or class, or reset a calendar link. Observe and move on.

Each case is **Pass**, **Fail** (what you saw), or **Blocked** (could not reach it).

## 1. Sign-in

| ID | Check |
| --- | --- |
| A1 | Wrong password stays on the login page and says why. |
| A2 | QA administrator lands on Classes. |
| A3 | Log out returns to the login page. A refresh of a staff page does not stay signed in. |
| A4 | QA teacher lands on their own home, not Classes. |

## 2. Administrator: classes

| ID | Check |
| --- | --- |
| C1 | Classes groups PG, N1, N2, K1 and K2, with a child count and the lead teacher. |
| C2 | Opening a class shows its children, teachers and report progress. |
| C3 | Add-a-child form asks for a birthday and only offers classes of that level. Cancel without saving. |
| C4 | A child whose birthday does not fit the class level is flagged. |

## 3. Administrator: children

| ID | Check |
| --- | --- |
| H1 | Children table columns: name, birthday, level, class, class teachers, report. |
| H2 | Search, level, class and report-status filters change the rows and the count. |
| H3 | Column headings sort. The first cell is a link to the child. |
| H4 | With more than 10 children, the footer shows a range, rows-per-page (10 / 25 / 50) and Previous / Next. |
| H5 | A profile shows photo consent, parents and the semester list. |

## 4. Administrator: teachers

| ID | Check |
| --- | --- |
| T1 | Teachers table columns: name, classes, subjects, last sign-in, status. |
| T2 | Search by name and the class filter change the rows. |
| T3 | A row’s name opens that teacher. The options menu can be opened and closed without changing the account. |
| T4 | Pagination matches Children: once there are more than 10 teachers, the same footer (range, 10 / 25 / 50, Previous / Next). With 10 or fewer, the footer stays hidden. Record the count. |

## 5. Administrator: reports

| ID | Check |
| --- | --- |
| R1 | Reports opens on the current period (December 2026). The waiting count in the tab matches the queue. |
| R2 | Only one year is expanded. The other year is one line. The arrow points up on the open year and down on the closed year. |
| R3 | Opening 2025 closes 2026 and the page becomes a 2025 past period. Both June and December are listed. December is selected. |
| R4 | Approved for that 2025 semester lists the children. Opening one report shows the family report and the ratings beside it, and does not error. |
| R5 | Closing the open year hides its semesters. Opening 2026 returns to the current queue. |
| R6 | Waiting, Changes requested, Approved and With teachers each load. Class and teacher filters do not error. |

## 6. Administrator: one rating

| ID | Check |
| --- | --- |
| V1 | Open a current-semester child review. Statements, the 1–5 scale and the note box are usable. The note is full width. The photo note sits beside it, not on top of it. |
| V2 | A child with photo consent can add a photo control. Do not upload. |

## 7. Calendar, timetable, settings

| ID | Check |
| --- | --- |
| K1 | Calendar loads Upcoming, Week and Month. An existing entry opens. Close it without saving. |
| K2 | Timetable page loads for a class. |
| K3 | Settings lists its sections. People, account, subjects, semester, report period and activity each open without a server error. |

## 8. Teacher

Sign out, then sign in as the QA teacher.

| ID | Check |
| --- | --- |
| E1 | Home lists only that teacher’s children. There is no Add child and no Classes admin page (the menu should not offer class setup). |
| E2 | Opening a child shows the rating form. Moving Previous / Next changes the learning area. |
| E3 | Reports shows that teacher’s semesters. Expanding a past year does not show another teacher’s classes. |
| E4 | Calendar is visible and has no Add entry control. |
| E5 | Account settings open. The teacher cannot open Settings → People or the administrator Teachers page (those should redirect or refuse). |

## Results (23 Oct 2026)

Walked by the staff tester against the local app. 32 cases passed. One case could not be completed, and it is not a broken page.

| Result | Cases |
| --- | --- |
| Pass | A1–A4, C1–C4, H1–H5, T1–T4, R1–R6, V1–V2, K2–K3, E1–E5 |
| Not completed | K1 |

**K1.** The administrator calendar has Week and Month only. Upcoming is the teacher’s list (“My upcoming events”), which the teacher pass confirmed. There are no calendar events in the database, so an entry could not be opened. Lessons on the week grid are edited from the timetable, which opened for Explorers and was not saved.
