#!/usr/bin/env bash
# Deploys the last COMMITTED version to the VPS. Run from the project root on your Mac:
#   deploy/deploy.sh plan     show what would happen, change nothing
#   deploy/deploy.sh setup    one-time server preparation (swap, Chrome, nginx site, service)
#   deploy/deploy.sh release  upload code, build, write env, restart
#   deploy/deploy.sh https    get the free HTTPS certificate
set -euo pipefail
cd "$(dirname "$0")/.."

get() { grep -E "^$1=" .env.deploy | head -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//'; }
HOST=$(get VPS_HOST); PORT=$(get VPS_PORT); USER_=$(get VPS_USER); KEY=$(get VPS_SSH_KEY_PATH); KEY="${KEY/#\~/$HOME}"
DOMAIN=$(get DOMAIN); LE_EMAIL=$(get LETSENCRYPT_EMAIL)
# No domain: nip.io turns the IP into a name, which lets Let's Encrypt issue a real certificate.
HOST_NAME="${DOMAIN:-$(echo "$HOST" | tr . -).nip.io}"
SSH=(ssh -i "$KEY" -p "${PORT:-22}" -o BatchMode=yes "$USER_@$HOST")
SCP=(scp -i "$KEY" -P "${PORT:-22}" -o BatchMode=yes)

case "${1:-plan}" in
  plan)
    cat <<PLAN
Server:   $USER_@$HOST   Site name: $HOST_NAME   App port: 3200 (localhost only)
setup:    user 'peterhouse', /opt/peterhouse/{app,data,backups}, 2 GB extra swap if needed,
          Google Chrome, certbot, ONE new nginx site (/etc/nginx/sites-enabled/peterhouse),
          systemd service 'peterhouse', nightly backup cron. Other sites/services are not changed.
release:  git archive HEAD -> /opt/peterhouse/app, npm ci, next build (memory-capped so it cannot
          starve the other services), write /opt/peterhouse/.env (login, keys, secrets), restart.
https:    certbot --nginx for $HOST_NAME, then COOKIE_SECURE=1.
PLAN
    ;;
  setup)
    "${SCP[@]}" deploy/nginx-peterhouse.conf deploy/peterhouse.service "$USER_@$HOST:/tmp/"
    "${SSH[@]}" "HOST_NAME='$HOST_NAME' bash -s" < deploy/server-setup.sh
    ;;
  release)
    [ -z "$(git status --porcelain)" ] || { echo "Uncommitted changes: commit first (only committed code is deployed)."; exit 1; }
    LOGIN_USER=$(get APP_LOGIN_USER); LOGIN_PASS=$(get APP_LOGIN_PASSWORD)
    [ -n "$LOGIN_USER" ] && [ -n "$LOGIN_PASS" ] || { echo "Fill APP_LOGIN_USER and APP_LOGIN_PASSWORD in .env.deploy first."; exit 1; }
    git archive --format=tar.gz HEAD | "${SSH[@]}" 'rm -rf /opt/peterhouse/app.new && mkdir -p /opt/peterhouse/app.new && tar -xzf - -C /opt/peterhouse/app.new'
    # Env file: keep an existing SESSION_SECRET so logins survive a redeploy.
    {
      echo "NODE_ENV=production"
      echo "DATA_DIR=/opt/peterhouse/data"
      echo "CHROME_PATH=/usr/bin/google-chrome-stable"
      echo "CHROME_NO_SANDBOX=1"
      echo "COOKIE_SECURE=$([ -f .deploy-https ] && echo 1 || echo 0)"
      echo "APP_LOGIN_USER=$LOGIN_USER"
      echo "APP_LOGIN_PASSWORD=$LOGIN_PASS"
      echo "GEMINI_API_KEY=$(get GEMINI_API_KEY)"
      echo "OPENAI_API_KEY=$(get OPENAI_API_KEY)"
    } | "${SSH[@]}" 'umask 077; cat > /opt/peterhouse/.env.new; grep -q "^SESSION_SECRET=" /opt/peterhouse/.env 2>/dev/null && grep "^SESSION_SECRET=" /opt/peterhouse/.env >> /opt/peterhouse/.env.new || echo "SESSION_SECRET=$(openssl rand -hex 32)" >> /opt/peterhouse/.env.new; mv /opt/peterhouse/.env.new /opt/peterhouse/.env'
    "${SSH[@]}" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/peterhouse/app.new
chown -R peterhouse:peterhouse /opt/peterhouse/app.new
# Build under a memory cap so an out-of-memory only ever kills this build, never the neighbours.
# npm ci is strict about optional platform packages that a Mac lockfile can omit; fall back to npm install.
runuser -u peterhouse -- bash -c 'cd /opt/peterhouse/app.new && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund)'
systemd-run --scope -p MemoryMax=1100M -p MemorySwapMax=2G --quiet runuser -u peterhouse -- bash -c 'cd /opt/peterhouse/app.new && NODE_OPTIONS=--max-old-space-size=1000 npx next build'
systemctl stop peterhouse 2>/dev/null || true
[ -d /opt/peterhouse/app ] && mv /opt/peterhouse/app /opt/peterhouse/app.prev
mv /opt/peterhouse/app.new /opt/peterhouse/app
systemctl start peterhouse
sleep 4
curl -fsS -o /dev/null -w "local health check: %{http_code}\n" http://127.0.0.1:3200/login
rm -rf /opt/peterhouse/app.prev
REMOTE
    ;;
  https)
    [ -n "$LE_EMAIL" ] || { echo "Fill LETSENCRYPT_EMAIL in .env.deploy first."; exit 1; }
    "${SSH[@]}" "certbot --nginx -d '$HOST_NAME' --non-interactive --agree-tos -m '$LE_EMAIL' --redirect"
    touch .deploy-https
    echo "HTTPS is on. Run '$0 release' once more so cookies are marked secure."
    ;;
  *) echo "usage: $0 plan|setup|release|https"; exit 1 ;;
esac
