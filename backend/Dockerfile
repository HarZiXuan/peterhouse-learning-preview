# syntax=docker/dockerfile:1
# Backend image. Build from the REPO ROOT:  docker build -f backend/Dockerfile -t peterhouse-backend .

# ── 1. Build: install the workspace, bundle shared + backend with tsup ──────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --no-audit --no-fund -w shared -w backend
COPY shared shared
COPY backend backend
RUN npm run build -w backend

# ── 2. Production dependencies only (no dev tools, no TypeScript) ───────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --no-audit --no-fund -w backend && npm cache clean --force

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
    MIGRATIONS_DIR=/app/db/migrations \
    SKILL_DIR=/app/backend/skills

WORKDIR /app/backend
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/backend/dist ./dist
COPY backend/package.json ./
COPY backend/skills ./skills
COPY db/migrations /app/db/migrations

USER app
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4100/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
