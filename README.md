# Peterhouse Learning Review

Semester learning reviews for Peterhouse Preschool. Teachers rate each child on short statements in five areas (English,
Chinese 华文, Mathematics, Social-Emotional Development, Self-Enrichment) on a fixed 1–5 scale, with an optional comment and
photos per area; the system writes a warm first draft from **anonymous** answers; the teacher edits it; families receive a
branded A4 PDF that shows marks and words, never numbers. Semester 2 shows each child's Semester 1 ratings beside the new
ones. An administrator edits the questions and publishes them as versions (Teacher Questions v0.3).

```
Browser → nginx (TLS) ─┬─ /      → frontend  (Next.js: pages only, no database, no secrets)
                       └─ /api   → backend   (Express: auth, access control, encryption, AI, PDF)
                                      └→ PostgreSQL (private network; migrations in app/backend/db/migrations)
```

| Folder | What it is |
| --- | --- |
| `app/frontend/` | Next.js 15 UI. Talks only to the backend. |
| `app/backend/` | Express 5 + TypeScript API. The only code that touches the database. |
| `app/shared/` | Types and the pure rating/report calculations both sides use. |
| `app/backend/db/migrations/` | Plain SQL, applied in order and checksummed. |
| `infra/`, `docker-compose.prod.yml`, `.github/` | Production packaging, server hardening, backups, CI. See `docs/DEPLOY.md`. |
| `docs/WRITEUP.md` | The architecture and security write-up. |

## Run it locally

Needs Node 22+, Docker (for Postgres) and Google Chrome (for PDFs).

```bash
pnpm install
pnpm db:up                    # Postgres on 127.0.0.1:5432
pnpm --filter @peterhouse/backend create-admin -- you@school.sg "Your Name"   # first sign-in; you choose a new password at login
pnpm dev:backend              # http://localhost:4100
pnpm dev:frontend             # http://localhost:3000  ← open this
```

The backend applies database migrations when it starts. `pnpm migrate` applies them by hand.
Optional settings go in `app/backend/.env` (see `app/backend/.env.example`); with no AI key the built-in writer is used.

```bash
pnpm test            # backend tests on a throwaway Postgres (needs pnpm db:up)
pnpm typecheck
pnpm lint
```

## Moving the old single-computer data

```bash
pnpm --filter @peterhouse/backend import-sqlite -- /path/to/old/data     # into an EMPTY database; photos and text are encrypted on the way in
```

## Security in one paragraph

Child names, birthdays, notes, ratings detail, written reports and photos are encrypted by the backend (AES-256-GCM) with a
key that is not in the database. People sign in with their own account; teachers see only their own class; everything is
in an activity log. Only anonymous answers ever go to the AI service (`app/backend/src/domain/anonymise.ts`, tested in
`app/backend/tests/anonymise.test.ts`). See `docs/WRITEUP.md` and `docs/DEPLOY.md`.
