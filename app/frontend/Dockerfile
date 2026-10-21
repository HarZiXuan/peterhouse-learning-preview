# syntax=docker/dockerfile:1
# Frontend image. Build from the REPO ROOT:
#   docker build -f app/frontend/Dockerfile --build-arg BACKEND_URL=http://backend:4100 -t peterhouse-frontend .

FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/shared/package.json app/shared/
COPY app/backend/package.json app/backend/
COPY app/frontend/package.json app/frontend/
RUN pnpm install --frozen-lockfile --filter @peterhouse/shared --filter @peterhouse/frontend
COPY app/shared app/shared
COPY app/frontend app/frontend
# next.config.ts bakes the /api rewrite target in at build time, so this must be the backend's address on the compose network.
ARG BACKEND_URL=http://backend:4100
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1
# next/font downloads the Google fonts here (needs internet during the build) and serves them from this site afterwards.
RUN pnpm --filter @peterhouse/frontend build

FROM node:22-bookworm-slim AS runtime
ARG BACKEND_URL=http://backend:4100
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    BACKEND_URL=$BACKEND_URL
RUN useradd --system --uid 10002 --create-home --home-dir /home/app --shell /usr/sbin/nologin app
WORKDIR /app
# Standalone output keeps the monorepo layout: the server is at app/frontend/server.js.
COPY --from=build --chown=app:app /app/app/frontend/.next/standalone ./
COPY --from=build --chown=app:app /app/app/frontend/.next/static ./app/frontend/.next/static
COPY --from=build --chown=app:app /app/app/frontend/public ./app/frontend/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "app/frontend/server.js"]
