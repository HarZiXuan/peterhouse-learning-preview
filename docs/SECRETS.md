# Secrets and environment variables

How the Learning Review keeps its secrets, and where each one lives. **No real value is ever written in this repo.**
Only the two example files (`.env.production.example`, `app/backend/.env.example`) are committed, and they hold placeholders.

## Where the secrets live

| Place | What is there | Who can read it |
|---|---|---|
| Your laptop, `~/peterhouse-secrets/` (folder `700`, files `600`) | `production.env`: the production database password and encryption key. `admin-login.txt`: the temporary passwords (one for administrators, one for teachers) set when the prototype data was copied to the server | Only your Mac user |
| Prototype server `204.152.218.202`, `/opt/peterhouse/.env.production` (`600`, root) | The same values, plus the Gemini API key | Only root on the server |
| `app/backend/.env` on your laptop | Local development settings and the local test sign-ins | Only your Mac user; git-ignored |
| GitHub | Nothing secret. The deploy workflow's secrets (SSH key, Tailscale) go in **repo Settings → Secrets**, never in files | GitHub Actions only |

Keep a copy of `DATA_ENCRYPTION_KEYS` in a password manager **and** offline. The laptop folder alone is not a backup.

## What git ignores

`.gitignore` keeps out every `.env*` file except the two examples, `.deploy.env`, private keys (`*.pem`, `*.key`, `*backup-key*.txt`),
database dumps and backups (`*.dump`, `*.age`, `*.sql.gz`), a `/secrets/` folder, logs, build output and the whole `legacy/` folder
(the old version's data and env files). The history was checked: no key, password or real env file has ever been committed.

## Every setting the backend reads

The backend validates its environment at start-up (`app/backend/src/config.ts`) and refuses to start in production without an encryption key.

| Variable | Secret? | What it does |
|---|---|---|
| `DATA_ENCRYPTION_KEYS` | **Yes, the most important** | `k1:<base64 32 bytes>`. Encrypts child names, birthdays, Chinese names, parents, notes, reports and photos before they reach the database. Lose it and the data is unreadable for ever |
| `POSTGRES_PASSWORD` | Yes | The database password. Compose puts it into `DATABASE_URL` |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Yes | AI writing. Optional: without one the built-in sentence bank writes the reports |
| `DATABASE_URL` | Contains the DB password | Set by compose, not by hand |
| `PUBLIC_ORIGIN` | No | The address in the browser (`https://204-152-218-202.nip.io`). Requests from any other site are refused |
| `COOKIE_SECURE` | No | `1`: the sign-in cookie only travels over HTTPS |
| `AI_PROVIDER`, `GEMINI_MODEL`, `OPENAI_MODEL` | No | Which writer and model to use. Empty provider = Gemini if its key is set |
| `SESSION_IDLE_HOURS`, `SESSION_MAX_DAYS`, `LOGIN_RATE_LIMIT` | No | Sign-in limits (12 h idle, 7 days at most, 20 tries per address per 15 min) |
| `NODE_ENV`, `PORT`, `FRONTEND_INTERNAL_URL`, `CHROME_*`, `MIGRATIONS_DIR`, `SKILL_DIR` | No | Set inside the images / compose |

The frontend has **no secrets at all**: it only knows where the backend is.

## How the backend protects the data

- **Encryption in the database.** Personal fields and photos are encrypted with AES-256-GCM (`app/backend/src/crypto.ts`), a fresh random
  nonce per value. Separate sub-keys for text and for photos are derived with HKDF. Each text value is bound to its column, so a value copied
  into another column fails to decrypt. The key is only ever in the environment, never in the database, so a stolen database or dump is unreadable.
- **Key rotation.** Put a new key first and keep the old one: `DATA_ENCRYPTION_KEYS=k2:NEW,k1:OLD`. New data uses `k2`, old data still reads with `k1`.
  Never remove a key while any row or backup still uses it.
- **Passwords** are hashed with scrypt (`passwords.ts`). Nobody, not even an administrator, can see one. New accounts must choose their own at first sign-in.
- **Sessions** are a random 32-byte token in an HttpOnly, SameSite, HTTPS-only cookie. The server stores only its SHA-256, so a stolen
  database cannot be used to sign in. Sessions end after 12 hours idle or 7 days.
- **Sign-in limits:** nginx allows 5 tries a minute per address, the backend 20 per 15 minutes, and an account locks after 5 wrong passwords.
- **Cross-site requests** are refused: every change must come from `PUBLIC_ORIGIN`.
- **AI writing never sees names.** Children's names are replaced before anything is sent (`domain/anonymise.ts`).
- **The activity log** records who did what, without children's names.

## How the server protects them

- `.env.production` is readable by root only. Docker passes it only to the backend container; the frontend and database never see the API keys.
- The database has **no port open to anything**: it sits on an internal Docker network that only the backend can reach.
- The backend (4100) and frontend (3000) listen on `127.0.0.1` only. The internet reaches them only through nginx over HTTPS.
- The containers run as non-root users with read-only file systems, no extra Linux capabilities and memory limits.

## Changing a secret on the server

```bash
ssh root@204.152.218.202
nano /opt/peterhouse/.env.production         # change the value (keep it on one line, no quotes)
cd /opt/peterhouse && docker compose -f docker-compose.prod.yml --env-file .env.production up -d backend
```
Then update the copy in `~/peterhouse-secrets/production.env` and your password manager.
**Never change `POSTGRES_PASSWORD` this way** once the database exists: the database keeps its first password. Change it inside Postgres first.
