#!/usr/bin/env bash
# One-time server preparation. Runs ON the VPS (as root). Safe to re-run.
# Usage (from deploy.sh): ssh root@host 'bash -s' < deploy/server-setup.sh  with HOST_NAME and LE_EMAIL exported.
set -euo pipefail
: "${HOST_NAME:?}"

echo "== user and folders"
id peterhouse >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/peterhouse --shell /usr/sbin/nologin peterhouse
mkdir -p /opt/peterhouse/app /opt/peterhouse/data /opt/peterhouse/backups
chown -R peterhouse:peterhouse /opt/peterhouse

echo "== extra swap for builds (only if there is little swap)"
if [ "$(swapon --show=SIZE --bytes --noheadings | awk '{s+=$1} END{print s+0}')" -lt 2000000000 ] && [ ! -f /swapfile2 ]; then
  fallocate -l 2G /swapfile2 && chmod 600 /swapfile2 && mkswap /swapfile2 >/dev/null && swapon /swapfile2
  grep -q '/swapfile2' /etc/fstab || echo '/swapfile2 none swap sw 0 0' >> /etc/fstab
fi

echo "== Google Chrome (for PDFs)"
if ! command -v google-chrome-stable >/dev/null; then
  cd /tmp && curl -fsSL -o chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  DEBIAN_FRONTEND=noninteractive apt-get install -y ./chrome.deb && rm -f chrome.deb
fi

echo "== certbot"
command -v certbot >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx

echo "== nginx site (new file only; other sites are not edited)"
sed "s/__HOST__/${HOST_NAME}/" /tmp/nginx-peterhouse.conf > /etc/nginx/sites-available/peterhouse
ln -sf /etc/nginx/sites-available/peterhouse /etc/nginx/sites-enabled/peterhouse
nginx -t && systemctl reload nginx

echo "== systemd service"
install -m 644 /tmp/peterhouse.service /etc/systemd/system/peterhouse.service
systemctl daemon-reload
systemctl enable peterhouse >/dev/null

echo "== nightly backup of the data folder (keeps 14 days)"
cat > /etc/cron.d/peterhouse-backup <<'CRON'
30 2 * * * root tar -czf /opt/peterhouse/backups/data-$(date +\%F).tgz -C /opt/peterhouse data && find /opt/peterhouse/backups -name 'data-*.tgz' -mtime +14 -delete
CRON

echo "server-setup done"
