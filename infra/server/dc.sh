#!/usr/bin/env bash
# docker compose for the production stack, with the right env files. Usage: infra/server/dc.sh up -d | ps | logs -f backend …
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/peterhouse}"
cd "$APP_DIR"
args=(-f docker-compose.prod.yml --env-file .env.production)
[[ -f .deploy.env ]] && args+=(--env-file .deploy.env)   # image names/tag written by the deploy workflow
exec docker compose "${args[@]}" "$@"
