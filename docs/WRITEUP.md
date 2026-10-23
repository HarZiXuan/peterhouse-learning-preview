# Peterhouse Learning Review: write-up

## 1. Tech stack

| Layer | What | Why |
| --- | --- | --- |
| **Frontend** | Next.js 15 (React 19), TypeScript, plain CSS (global styles + CSS modules, no UI library). Fonts are self-hosted through `next/font`. | Server-rendered pages load fast on a school tablet, and the same React report component is used for the on-screen preview *and* the PDF, so they cannot drift apart. The frontend has no database connection and holds no secrets: it only calls the backend. |
| **Backend** | Node 22, Express 5, TypeScript. `zod` validates every input, `helmet` sets headers, `express-rate-limit` slows guessing. | A small, well-understood API that is the single place where login, access control, encryption, AI calls and PDF generation happen. Types are shared with the frontend (`app/shared/`), so the two sides cannot disagree about a shape. |
| **Database** | PostgreSQL 17 in Docker on a private network (not reachable from the internet). Schema is plain SQL in `app/backend/db/migrations`, applied in order and checksummed. | One real database with transactions and constraints (one review per child per term, valid statuses, foreign keys). Migrations make every server and every developer end up with the same schema. |
| **Ratings, comments, narratives** | `review_areas` (ratings, one comment, and for Self-Enrichment the "loved most" answer and home-idea picks, per area), `reviews` (written report). | Personal text is **encrypted by the backend** before it reaches Postgres (see section 3). |
| **Photos** | Re-encoded (upright, max 1600 px, location/camera data stripped), then **encrypted and stored in Postgres** (`review_photos.data`). | One backup contains everything, and there is no loose folder of photos on the server to forget about or leave unprotected. |
| **AI** | Google Gemini (`gemini-3.5-flash`) by default; OpenAI or a model on the school's own machine (Ollama) are options; the built-in sentence bank is the offline fallback. | The writer is chosen by the server's environment only. If the service fails, the sentence bank writes the report instead and the teacher is told. |
| **PDF** | Headless Chromium (`puppeteer-core`) prints the frontend's A4 report page. | Real brand fonts and layout, exactly what was previewed. The backend signs the print browser in with a two-minute session that is deleted straight after. |
| **Login / access** | Per-person accounts, `scrypt` password hashes, server-side sessions in an HttpOnly cookie, roles (admin, teacher), class-based access, activity log. | Details below. |

**How the AI drafts in the school's style without inventing details**

- *Style:* the system prompt is `app/backend/skills/report-writing/SKILL.md`: voice (warm, plain, British spelling, short sentences), structure (70–100 words per paragraph), how to speak at each level, bold keywords, and worked examples. It is a plain file the school can edit without touching code.
- *No invention:* the model only receives the teacher's own facts: each statement with its 1–5 score or "not seen yet", the name-scrubbed comment per area, what the child loved most and the home ideas the teacher picked (Teacher Questions v0.3, section 5). 4–5 are written as strengths, 1–2 gently, and "not seen yet" is never described as a weakness. The prompt says "never invent an event, place, object or person; write fewer sentences rather than guess". Families never see the numbers. Output is requested as strict JSON; a bad reply is retried once, then the sentence bank is used.
- *Checking afterwards:* every paragraph is checked in code and flagged for the teacher if it contains a number or score, a banned word ("behind", "weak", …), a comparison with other children, a skill that was not observed, another child's or a teacher's name, a left-over placeholder, or is too short or long. Flags are shown next to the text; nothing is silently rewritten.
- *Teacher in control:* the teacher can edit any paragraph or rewrite just one (shorter / warmer / simpler). Changing an answer after the report is written marks that paragraph "stale" instead of rewriting it.
- *Privacy:* the AI never learns who the child is. `anonymise.ts` is the only way answers reach it: it receives the answers and the roster, never the child record, and replaces the child with `[Child]`, siblings with `[Friend]`, staff with `[Teacher]`, and strips phone numbers, emails and NRIC numbers from free text. The name is put back on the school's side. "What was sent?" shows the exact text. `app/backend/tests/anonymise.test.ts` runs the real pipeline against a stubbed AI service and fails if any identifying text would leave.

**Chinese in the PDF.** The report page's font stack falls back to Noto Sans SC / PingFang SC, and the backend container installs `fonts-noto-cjk` and `fonts-noto-color-emoji`, so Chromium always has a Chinese font even on a bare server. I rendered a PDF for a child called 陈小明 and checked the name, cover initial and body text visually. The cover initial uses the first Unicode character rather than the first byte.

**Login and access control**
- Each person has their own account; there is no shared password. New accounts get a temporary password and *must* choose their own at first sign-in.
- Passwords: `scrypt` (memory-hard), at least 10 characters. Unknown email and wrong password give the same message and take the same time.
- Five wrong passwords lock the account for 15 minutes; sign-in is also rate-limited per IP address.
- Sessions: a random token in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie. The database stores only its SHA-256. Sessions end after 12 hours idle or 7 days total; deactivating someone or resetting their password signs them out immediately.
- Roles: *teachers* see only the classes they belong to (a child in another class looks like it does not exist); *administrators* see every class and manage people, settings and the activity log.
- Every state-changing request is checked for a matching site origin (cross-site request protection) on top of `SameSite`.
- The activity log records sign-ins (and failures), opening a child's record, writing/editing/downloading a report, photo changes and account changes. It never contains a child's name.

## 2. Storing progress across semesters

A **term** is one portfolio period: `terms(year, semester)` where semester 1 is January–June and semester 2 is July–December (unique per year+semester). Each term has its own class(es).

A child exists once (`children`) and has **one review per term** (`reviews`, unique on `(child_id, term_id)`). Everything for that semester hangs off the review:

```
children ─┬─ reviews (child, term, class, status, written report, frozen question set + rubric_version_id)
          │     ├─ review_areas   one row per area: ratings (1–5 or not seen, per question key), comment, loved-most, home picks
          │     ├─ review_photos  encrypted photos, up to three per area
          │     └─ draft_versions earlier versions of the written report
terms ────┘
domains ── questions (permanent key, wording, order, active/retired)   ← the administrator's draft
rubric_versions (version, frozen snapshot)                              ← what "Publish" creates
```

- **Ratings are never overwritten between semesters.** "Start next semester" (administrator only, one click) closes the current term and creates a *new, blank review* in the new term for every child still enrolled, carrying the class and its teachers forward. Reports keep their status: approval stays the administrator's decision. A report the old semester closed on before approval can still be finished, sent and approved afterwards, so no family misses theirs.
- **An approved report is frozen.** On approval the report's pages, the school details and the date are stored with it (`reviews.approved_snapshot`), and the child's profile photo is copied in as the report's own cover. The PDF prints from that copy, so later changes to names, photos, class teachers or settings never change what a family was given. Sending it back clears the copy.
- **Semester 2 shows Semester 1.** When the report for semester 2 is built, the backend finds the child's most recent earlier written review at the same level and attaches each skill's previous rating; the report prints "Semester 1: Growing" under the new rating. Skills that were not observed before, or did not exist, simply show nothing. (A test covers this: Semester 1 data is byte-for-byte unchanged after rollover, and the Semester 2 report carries the right previous ratings.)
- **Question wording is frozen per review.** The administrator edits a draft (`domains`, `questions`) and publishes it as a new `rubric_versions` row. A review copies the latest version the first time it is opened (`reviews.rubric`, `reviews.rubric_version_id`) and keeps it, so later edits never change a past or in-progress report.
- **Question keys are permanent.** Rewording keeps the key, so Semester 1 and Semester 2 scores still line up; replacing a question with a different skill retires it and creates a new key, so the next report shows no comparison instead of a misleading one. Retired questions stay in history. Each domain keeps 3–6 questions, and every change is in the activity log.
- Comments and narratives are per review, so each semester keeps its own written report, with the earlier drafts in `draft_versions`.

## 3. Hosting and security

**Today:** the prototype runs on a shared test server (RackNerd, 1 vCPU, 1.9 GB RAM, alongside other projects). That is fine for trying it with made-up children, not for real ones. Before real children's data goes in, it moves to the server below.

**Where (for real data):** a dedicated VPS in **Singapore** (2 vCPU, 4 GB RAM, Ubuntu 24.04 LTS, ~US$12–25/month; DigitalOcean, Hetzner or Hostinger all have Singapore regions). Singapore keeps the children's data in the school's country, which makes the PDPA conversation straightforward and gives teachers low latency. It is a separate machine from anything else I run, so a problem elsewhere cannot touch it. 4 GB is the realistic minimum: Postgres, the API, the frontend and a headless browser for PDFs all fit, whereas 2 GB would swap whenever a class's PDFs are printed.

**Server setup** (`infra/server/harden.sh`, idempotent, written for a fresh Ubuntu 24.04 VPS)
- Non-root `deploy` user, SSH keys only, no root login, no passwords, modern ciphers, `AllowUsers deploy`.
- **Firewall:** default-deny. Only 80 and 443 are open to the internet. **SSH is reachable only over Tailscale** (a private network): a two-phase script keeps public SSH open until the Tailscale login is confirmed, so you cannot lock yourself out, then closes it. The provider's own cloud firewall is set to the same rules as a second layer.
- `fail2ban`, automatic security updates with a reboot window, kernel network hardening (`sysctl`), persistent logs, `auditd` watching SSH/sudo/secret files.
- Everything runs in Docker with `cap_drop: ALL`, `no-new-privileges`, read-only filesystems and memory limits. **Postgres has no published port and sits on an internal network with no internet route.** The backend and frontend are published only on `127.0.0.1`; nginx is the only way in.
- nginx terminates TLS 1.2/1.3 (Let's Encrypt, auto-renewed), redirects HTTP→HTTPS, sends HSTS, a Content-Security-Policy and other security headers, rate-limits `/api/auth/login` more strictly than the rest, and hides its version.

**Encryption**
- **In transit:** HTTPS everywhere to the browser; the AI call is HTTPS; backend ↔ Postgres stays on the server's private Docker network.
- **At rest, in the application:** child names, birthdays, highlights, notes, comments, written reports and photos are encrypted with **AES-256-GCM by the backend before they reach Postgres**. Each value has its own random nonce and is bound to its column (a value copied elsewhere will not decrypt); tampering is detected. The key is **not in the database** (`DATA_ENCRYPTION_KEYS` in the server's environment), so a stolen database file, dump or backup is unreadable without it. This also protects against the VPS provider reading the disk, which full-disk encryption on a VPS does not. Keys support rotation (a new key encrypts, old keys still decrypt). Ratings stay as plain numbers inside their encrypted JSON, so nothing is searchable in the clear.
- Passwords are `scrypt` hashes; session tokens are stored only as hashes.
- Tested: `app/backend/tests/flow.test.ts` writes a child, notes, ratings and a photo, then dumps every table and fails if any name, birthday, note or report text appears in the clear.

**Backups** (`infra/server/backup.sh` + systemd timer)
- Daily at 02:30 Singapore time: `pg_dump` → encrypted with `age` to a **public key** (the private key never lives on the server) → kept 14 days locally → copied **off-site** to a bucket at a different provider with `rclone`. One dump contains everything, photos included.
- `restore.sh` restores into a scratch database first and prints row counts next to the live ones; the runbook includes a restore drill to repeat after any change.
- The encryption keys are backed up **separately** (password manager + offline copy): backups without `DATA_ENCRYPTION_KEYS` cannot be read.

**Access control and deployment**
- Per-person accounts and roles as in section 1; admin-only pages for people and the activity log.
- CI (GitHub Actions) runs typecheck, tests against a real Postgres, lint and builds both images. Deploys are a manual workflow that builds and pushes images, joins the server's Tailscale network with an ephemeral key, and runs `docker compose pull && up -d`. There are no secrets in the repository; migrations run when the backend starts.

**Honest status:** the code, tests and the local stack are working and verified on my machine. The Docker images, `harden.sh`, the GitHub workflows and the backup timer have been reviewed and partly exercised (compose config, nginx syntax, backup/restore against a local Postgres) but have **not yet been run on a real VPS**; the first deployment is where I would expect to fix small things. Not yet built: two-step sign-in, PDF password protection, bulk re-encryption after a key rotation.

## 4. Future features

1. **Two-step sign-in (TOTP)** for administrators, then everyone; account lock-out alerts by email.
2. **Family delivery:** a secure, expiring download link or a parent portal instead of emailing PDFs; optional password-protected PDFs; parent acknowledgement.
3. **Bilingual reports:** Chinese narrative alongside English (with the same anonymisation and quality checks), plus per-family language choice.
4. **Pre-filling a new semester** from the last one ("copy from last semester", suggested next steps from last time's goals) and a progress-over-time view per child (Nursery → K1 → K2).
5. **Managing several classes**, with class transfers mid-term.
6. **Stronger data protection:** Postgres row-level security as a second line behind the API, a key-rotation command that re-encrypts everything, `pgaudit`, and automatic deletion after the retention period with a family data-request export.
7. **Operations:** uptime and backup-failure alerts, monthly automated restore test, log shipping, and Playwright end-to-end tests in CI.
8. **Offline-friendly teacher entry** on tablets (draft answers saved locally and synced), and photo upload straight from the camera with face-blur options.
