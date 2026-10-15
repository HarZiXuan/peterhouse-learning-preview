# Peterhouse Learning Review

June and December learning reviews for Peterhouse Preschool, built from
`Peterhouse-Learning-Review-Specification.pdf` (v1.0, 14 October 2026).

Teachers pick the descriptor that sounds most like the child, tick what they
saw and add one highlight. The system writes a warm first draft from
**anonymous** answers; the lead teacher edits and approves it; families receive
a branded A4 PDF.

## Using it

1. Open the app and **add each child** (first name is enough).
2. Click the child and **rate 14 short sentences from 1 to 5** (still learning → really shines).
   Answers save by themselves.
3. Press **Create report**. The AI writes a warm report from the answers (names are
   never sent). Edit any wording if you like, then **Download PDF**.

Put the AI key, teacher name(s), class name and June/December in **Settings**.

## Running it

Requires Node.js 20+ and Google Chrome (to print PDFs).

```bash
npm install
npm run dev       # or: npm run build && npm start
```

Open http://localhost:3000. In development there is no login unless `APP_LOGIN_USER` and `APP_LOGIN_PASSWORD` are set; in production a login is always required.

To keep API keys out of the app, copy `.env.example` to `.env.local` and fill it in
(restart the server afterwards). Keys set this way show as "configured on the server"
in Settings and are never stored in the database.

Other commands: `npm test`, `npm run typecheck`, `npm run lint`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATA_DIR` | Data folder (default `./data`): `learning-review.db` plus `photos/`. |
| `CHROME_PATH` | Browser used to print PDFs, if not in a standard location. |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Writing-service keys (set in `.env.local`; if unset, can be entered in Settings). |
| `APP_LOGIN_USER` / `APP_LOGIN_PASSWORD` | The one shared staff login. Required in production (the app refuses to open without it). |
| `SESSION_SECRET` | Long random string that signs the login cookie. |
| `COOKIE_SECURE=1` | Set when served over HTTPS. |

The writing service is configured only through environment variables (there is no
setting for it in the app): set `GEMINI_API_KEY` or `OPENAI_API_KEY` and that service
is used, or set `AI_PROVIDER` (`gemini`, `openai`, `local`, `sentence_bank`) to choose.
With no key the built-in sentence bank is used, and it is also the automatic fallback
whenever the service fails. The writing guide the AI follows is in
`skills/report-writing/SKILL.md`.

## Privacy (section 06)

* `src/lib/anonymise.ts` builds the only text ever sent for writing. It receives
  the answers and the roster, never the child record, so it cannot send the
  name, birthday, photo, class, teachers or school. Free text is name-scrubbed
  against every child and staff name (siblings become "[Friend]"), and emails,
  phone and NRIC numbers are removed.
* The name is put back on the school computer after writing.
* "What was sent?" on the draft page shows the exact request text.
* `tests/anonymise.test.ts` runs the real draft pipeline against a stubbed AI
  service with names, a sibling, a phone number and a private note typed into
  the answers, and fails if any identifying text would leave the school.
* Photos are cropped, resized to 800 × 800 and re-encoded, which removes
  location and camera data. They are served only to signed-in staff of that
  class.

**Encrypted storage** (7.10) is provided by the operating system: keep the data
folder on a disk with FileVault (Mac) or BitLocker (Windows) turned on, and put
the backup folder on an encrypted external drive.

## Backups and retention

Settings › Backups makes a dated copy of the data folder (a consistent copy of
the database plus the photos) once a day automatically, keeps the last 30 days,
and restores any copy (a safety copy is taken first). Settings › Retention lists
children past the retention period (default three years after leaving), with a
"family data request" export and permanent removal.

## What is built

Every **Must** feature in the specification, and every **Should**:
spreadsheet (CSV) import with a preview, roll forward, moving a child
mid-term, school details, a photo per term, child history, notes per area, copy
from last term, keyboard shortcuts (1–5, 0, ↑ ↓), private staff notes, "who
changed what", "is editing" notices with overwrite protection, "What was sent?",
rewrite one paragraph, quality checks, sentence-bank fallback and editor,
whole-class drafts, choice of AI service, report version numbers, print-ready
layout, school progress against target dates, class overview grid, backups,
activity log and retention.

**Could** features included: tone buttons (Shorter, Warmer, Simpler), version
history with restore, AI on the school computer, one combined print file per
class, export levels to Excel (CSV), family data request export.

Not built yet: two-step sign-in for administrators, password-protected PDFs,
bulk photo upload, descriptors by age group, adding or removing areas and
skills, the optional principal check, emailing families, and everything listed
as **Later**.

## Wording to review

The Communication and Language descriptors are the specification's own. The
other 18 skills' descriptors, the "ideas to try at home" and the sentence-bank
templates in `src/lib/rubric-default.ts` are drafts for a senior teacher to
review (decision 3 in section 14); all of it is editable in Settings without
a developer.

## Layout

```
src/lib/            domain logic: db, auth, reviews (statuses and rules),
                    calc (section 05), anonymise + writer/ (section 06),
                    pdf, photos, backup, records, seed
src/app/(staff)/    staff screens (home, class, review form, draft, history, admin)
src/app/report/     the A4 report page that Chrome prints to PDF
src/app/api/        PDF, zip, photo, export downloads
tests/              vitest suites
```
