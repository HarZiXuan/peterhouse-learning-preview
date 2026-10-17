#!/usr/bin/env bash
# Bootstrap and harden a fresh Ubuntu 24.04 VPS for the Peterhouse Learning Review. Run as root. Safe to re-run.
#
#   PHASE 1 (first run; public SSH stays open so you cannot lock yourself out):
#     DEPLOY_USER=deploy SSH_PUBKEY="ssh-ed25519 AAAA… you@laptop" \
#     DOMAIN=reviews.example.com LE_EMAIL=you@example.com  ./harden.sh phase1
#     → then run `tailscale up` (printed at the end), join the server to your tailnet, and from your laptop confirm:
#         ssh deploy@<tailscale-name-or-100.x-ip>        (must work, and `sudo -n true` must work)
#
#   PHASE 2 (only after that SSH-over-Tailscale login works):
#     ./harden.sh phase2 --confirmed-tailscale-ssh-works
#     → removes public SSH from the firewall: port 22 is then reachable ONLY over tailscale0.
#
# If you ever get locked out: use the VPS provider's web console (VNC) and run `ufw allow 22/tcp`.
set -euo pipefail

PHASE="${1:-}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/opt/peterhouse}"
TIMEZONE="${TIMEZONE:-Asia/Singapore}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # repo root, to find infra/nginx

log()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root."
[[ "$PHASE" == phase1 || "$PHASE" == phase2 ]] || die "Usage: $0 phase1|phase2"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

# ──────────────────────────────────────────────────────────────────────────────────────────────
phase2() {
  [[ "${2:-}" == "--confirmed-tailscale-ssh-works" ]] || die "Phase 2 closes public SSH. Re-run with --confirmed-tailscale-ssh-works once 'ssh $DEPLOY_USER@<tailscale-name>' works from your laptop."
  log "Phase 2.1: Tailscale must be up"
  command -v tailscale >/dev/null || die "Tailscale is not installed. Run phase1 first."
  tailscale status >/dev/null 2>&1 || die "Tailscale is not connected. Run 'tailscale up' first."
  ip link show tailscale0 >/dev/null 2>&1 || die "No tailscale0 interface."

  log "Phase 2.2: SSH only over Tailscale"
  ufw allow in on tailscale0 to any port 22 proto tcp comment 'ssh over tailscale'
  # Remove every rule that opened 22 to the world (IPv4 and IPv6, with or without a comment).
  # Highest number first, so earlier numbers do not shift while we delete.
  while read -r n; do [[ -n "$n" ]] && ufw --force delete "$n" >/dev/null; done < <(ufw status numbered | awk -F'[][]' '/ 22(\/tcp)?[ (]/ && !/tailscale0/ && /(ALLOW|LIMIT)/ {gsub(/ /,"",$2); print $2}' | sort -rn)
  ufw status verbose
  log "Done. Public SSH is closed. Test from a machine NOT on Tailscale: 'ssh $DEPLOY_USER@<public-ip>' should time out."
}
if [[ "$PHASE" == phase2 ]]; then phase2 "$@"; exit 0; fi

# ──────────────────────────────────────────────────────────────────────────────────────────────
# PHASE 1
[[ -n "${SSH_PUBKEY:-}" ]] || die "Set SSH_PUBKEY to your public key (the line from ~/.ssh/id_ed25519.pub)."
[[ "$SSH_PUBKEY" == ssh-* || "$SSH_PUBKEY" == ecdsa-* ]] || die "SSH_PUBKEY does not look like a public key."
[[ -n "${DOMAIN:-}" ]] || die "Set DOMAIN (e.g. reviews.example.com); its DNS A record must already point at this server."
[[ -n "${LE_EMAIL:-}" ]] || die "Set LE_EMAIL for certificate expiry notices."
. /etc/os-release
[[ "$VERSION_ID" == "24.04" ]] || warn "Written for Ubuntu 24.04; this is $PRETTY_NAME."

log "1. System packages and timezone"
apt-get update -y
apt-get upgrade -y
apt-get install -y --no-install-recommends ca-certificates curl gnupg ufw fail2ban unattended-upgrades apt-listchanges \
  nginx certbot age rclone auditd sudo needrestart jq
timedatectl set-timezone "$TIMEZONE"

log "2. Deploy user (key-only, sudo) — root SSH login is disabled in step 3"
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AK="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AK"; chmod 600 "$AK"; chown "$DEPLOY_USER:$DEPLOY_USER" "$AK"
grep -qxF "$SSH_PUBKEY" "$AK" || echo "$SSH_PUBKEY" >> "$AK"
usermod -aG sudo "$DEPLOY_USER"
# Passwordless sudo, because the account has no password and logs in by key only (and CI deploys use it).
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"; chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER"
visudo -cf "/etc/sudoers.d/90-$DEPLOY_USER" >/dev/null
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"

log "3. SSH hardening"
# Never lock out: only disable root/password login once the deploy user's key is in place.
[[ -s "$AK" ]] || die "Deploy user has no authorized key; refusing to harden SSH."
cat > /etc/ssh/sshd_config.d/10-peterhouse-hardening.conf <<SSHD
# Managed by harden.sh. The 10- prefix makes it win over cloud-init's 50-cloud-init.conf (first match wins).
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 20
MaxSessions 4
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
AllowUsers $DEPLOY_USER
KexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
SSHD
sshd -t || die "sshd config test failed; not restarting sshd."
systemctl restart ssh
warn "Open a SECOND terminal now and confirm 'ssh $DEPLOY_USER@<this server>' works before closing this session."

log "4. Firewall (ufw): default deny; 80/443 public; SSH still public until phase 2"
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp comment 'http (certbot, redirect)'
ufw allow 443/tcp comment 'https'
ufw allow 22/tcp comment 'ssh (public until phase2)'
ufw --force enable
ufw status verbose

log "5. Tailscale (private admin network)"
if ! command -v tailscale >/dev/null; then
  curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg -o /usr/share/keyrings/tailscale-archive-keyring.gpg
  curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list -o /etc/apt/sources.list.d/tailscale.list
  apt-get update -y && apt-get install -y tailscale
fi
systemctl enable --now tailscaled

log "6. fail2ban"
cat > /etc/fail2ban/jail.d/peterhouse.local <<'F2B'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 4
backend  = systemd
[sshd]
enabled = true
F2B
systemctl enable --now fail2ban
systemctl restart fail2ban

log "7. Automatic security updates (reboot at 03:30 local when needed)"
cat > /etc/apt/apt.conf.d/52peterhouse-unattended <<'UU'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "03:30";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
UU
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'UU'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
UU
systemctl enable --now unattended-upgrades

log "8. Kernel/network hardening (sysctl)"
# ip_forward is left alone: Docker and Tailscale need it.
cat > /etc/sysctl.d/90-peterhouse.conf <<'SYS'
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.unprivileged_bpf_disabled = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
SYS
sysctl --system >/dev/null

log "9. Swap only if RAM is small"
MEM_KB=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
if (( MEM_KB < 3000000 )) && [[ -z "$(swapon --show --noheadings)" ]]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness = 10' > /etc/sysctl.d/91-swap.conf && sysctl -p /etc/sysctl.d/91-swap.conf >/dev/null
else
  echo "RAM is $((MEM_KB / 1024)) MB or swap exists: no swap file added."
fi

log "10. Persistent logs and audit trail"
install -d /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/persistent.conf <<'J'
[Journal]
Storage=persistent
SystemMaxUse=500M
MaxRetentionSec=3month
J
systemctl restart systemd-journald
cat > /etc/audit/rules.d/peterhouse.rules <<A
-w /etc/ssh/ -p wa -k ssh_config
-w /etc/sudoers -p wa -k sudoers
-w /etc/sudoers.d/ -p wa -k sudoers
-w $APP_DIR/.env.production -p rwa -k app_secrets
-w /etc/peterhouse/ -p wa -k backup_config
A
augenrules --load >/dev/null || warn "auditd rules not loaded (reboot may be needed)"
systemctl enable --now auditd

# Where backups and their config live (backup.sh / peterhouse-backup.service).
install -d -m 700 /var/backups/peterhouse /etc/peterhouse

log "11. Docker Engine (official repository)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
install -d /etc/docker
cat > /etc/docker/daemon.json <<'D'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "no-new-privileges": true,
  "live-restore": true,
  "userland-proxy": false
}
D
systemctl enable docker && systemctl restart docker
# Membership of the docker group is root-equivalent. It is what lets the deploy user (and CI over Tailscale) run compose.
usermod -aG docker "$DEPLOY_USER"
# Published container ports are bound to 127.0.0.1 in docker-compose.prod.yml, because Docker's own iptables rules
# bypass ufw for published ports. Never publish a port without the 127.0.0.1: prefix.

log "12. nginx and the TLS certificate"
install -d /var/www/certbot
rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
install -m 644 "$REPO_DIR/infra/nginx/peterhouse-proxy.conf" /etc/nginx/peterhouse-proxy.conf
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [[ ! -s "$CERT" ]]; then
  # Chicken-and-egg: the real site needs a certificate, and getting one needs port 80. Serve only the challenge first.
  cat > /etc/nginx/conf.d/peterhouse.conf <<BOOT
server {
    listen 80 default_server;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
BOOT
  nginx -t && systemctl reload nginx
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" -m "$LE_EMAIL" --agree-tos --no-eff-email --non-interactive \
    || die "Certificate request failed. Is the DNS A record for $DOMAIN pointing at this server, and port 80 reachable?"
fi
sed "s/reviews\.example\.com/$DOMAIN/g" "$REPO_DIR/infra/nginx/peterhouse.conf" > /etc/nginx/conf.d/peterhouse.conf
nginx -t
systemctl enable nginx && systemctl reload nginx
# Reload nginx whenever certbot renews (the systemd timer from the certbot package runs twice a day).
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

log "PHASE 1 COMPLETE"
cat <<NEXT

Next steps
  1. Join the tailnet:        tailscale up --hostname=peterhouse-reviews        (open the printed URL to approve)
  2. From your laptop (on Tailscale):  ssh $DEPLOY_USER@peterhouse-reviews      and check:  sudo -n true && docker ps
  3. Only then:              sudo $REPO_DIR/infra/server/harden.sh phase2 --confirmed-tailscale-ssh-works
  4. Continue with docs/DEPLOY.md ("Configure and start the app").
NEXT
