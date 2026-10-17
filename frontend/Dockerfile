# syntax=docker/dockerfile:1
# Frontend image. Build from the REPO ROOT:
#   docker build -f frontend/Dockerfile --build-arg BACKEND_URL=http://backend:4100 -t peterhouse-frontend .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --no-audit --no-fund -w shared -w frontend
COPY shared shared
COPY frontend frontend
# next.config.ts bakes the /api rewrite target in at build time, so this must be the backend's address on the compose network.
ARG BACKEND_URL=http://backend:4100
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1
# next/font downloads the Google fonts here (needs internet during the build) and serves them from this site afterwards.
RUN npm run build -w frontend

FROM node:22-bookworm-slim AS runtime
ARG BACKEND_URL=http://backend:4100
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    BACKEND_URL=$BACKEND_URL
RUN useradd --system --uid 10002 --create-home --home-dir /home/app --shell /usr/sbin/nologin app
WORKDIR /app
# Standalone output keeps the monorepo layout: the server is at frontend/server.js.
COPY --from=build --chown=app:app /app/frontend/.next/standalone ./
COPY --from=build --chown=app:app /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=app:app /app/frontend/public ./frontend/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "frontend/server.js"]
