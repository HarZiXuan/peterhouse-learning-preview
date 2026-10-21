# syntax=docker/dockerfile:1
# Backend image. Build from the REPO ROOT:  docker build -f app/backend/Dockerfile -t peterhouse-backend .

# ── 1. Build: install the workspace, bundle shared + backend with tsup ──────────────────────────
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/shared/package.json app/shared/
COPY app/backend/package.json app/backend/
COPY app/frontend/package.json app/frontend/
RUN pnpm install --frozen-lockfile --filter @peterhouse/shared --filter @peterhouse/backend
COPY app/shared app/shared
COPY app/backend app/backend
RUN pnpm --filter @peterhouse/backend build

# ── 2. Production dependencies only (no dev tools, no TypeScript) ───────────────────────────────
FROM node:22-bookworm-slim AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/shared/package.json app/shared/
COPY app/backend/package.json app/backend/
COPY app/frontend/package.json app/frontend/
COPY app/shared app/shared
COPY app/backend app/backend
# Self-contained production node_modules for the backend only (no dev tools, no TypeScript).
RUN pnpm install --frozen-lockfile --filter @peterhouse/backend... && pnpm --filter @peterhouse/backend deploy --prod --legacy /prod/backend

# ── 3. Runtime ──────────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
# Chromium prints the PDFs; the Noto fonts make Chinese (and emoji) render correctly in them.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-cjk fonts-noto-color-emoji fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --create-home --home-dir /home/app --shell /usr/sbin/nologin app

ENV NODE_ENV=production \
    PORT=4100 \
    HOME=/tmp \
    CHROME_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=1 \
    MIGRATIONS_DIR=/app/app/backend/db/migrations \
    SKILL_DIR=/app/app/backend/skills

WORKDIR /app/app/backend
COPY --from=deps /prod/backend/node_modules ./node_modules
COPY --from=build /app/app/backend/dist ./dist
COPY app/backend/package.json ./
COPY app/backend/skills ./skills
COPY app/backend/db/migrations /app/app/backend/db/migrations

USER app
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4100/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
