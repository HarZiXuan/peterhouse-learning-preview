# Peterhouse Learning Review

Semester learning reviews for Peterhouse Preschool. Teachers rate each child on short sentences and add a highlight; the
system writes a warm first draft from **anonymous** answers; the teacher edits it; families receive a branded A4 PDF.
Semester 2 shows each child's Semester 1 ratings beside the new ones.

```
Browser → nginx (TLS) ─┬─ /      → frontend  (Next.js: pages only, no database, no secrets)
                       └─ /api   → backend   (Express: auth, access control, encryption, AI, PDF)
                                      └→ PostgreSQL (private network; migrations in db/migrations)
```

| Folder | What it is |
| --- | --- |
| `frontend/` | Next.js 15 UI. Talks only to the backend. |
| `backend/` | Express 5 + TypeScript API. The only code that touches the database. |
| `shared/` | Types and the pure rating/report calculations both sides use. |
| `db/migrations/` | Plain SQL, applied in order and checksummed. |
| `infra/`, `docker-compose.prod.yml`, `.github/` | Production packaging, server hardening, backups, CI. See `docs/DEPLOY.md`. |
| `docs/WRITEUP.md` | The architecture and security write-up. |

## Run it locally

Needs Node 22+, Docker (for Postgres) and Google Chrome (for PDFs).

```bash
npm install
npm run db:up                    # Postgres on 127.0.0.1:5432
npm run create-admin -w backend -- you@school.sg "Your Name"   # first sign-in; you choose a new password at login
npm run dev:backend              # http://localhost:4100
npm run dev:frontend             # http://localhost:3000  ← open this
```

The backend applies database migrations when it starts. `npm run migrate` applies them by hand.
Optional settings go in `backend/.env` (see `backend/.env.example`); with no AI key the built-in writer is used.

```bash
npm test            # backend tests on a throwaway Postgres (needs npm run db:up)
npm run typecheck
npm run lint
```

## Moving the old single-computer data

```bash
npm run import-sqlite -w backend -- /path/to/old/data     # into an EMPTY database; photos and text are encrypted on the way in
```

## Security in one paragraph

Child names, birthdays, notes, ratings detail, written reports and photos are encrypted by the backend (AES-256-GCM) with a
key that is not in the database. People sign in with their own account; teachers see only their own class; everything is
in an activity log. Only anonymous answers ever go to the AI service (`backend/src/domain/anonymise.ts`, tested in
`backend/tests/anonymise.test.ts`). See `docs/WRITEUP.md` and `docs/DEPLOY.md`.
