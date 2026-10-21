# Deploying the Learning Review

A dedicated Ubuntu 24.04 VPS in Singapore (2 vCPU / 4 GB RAM / 40+ GB disk). Nothing else should run on it.

```
browser ─TLS─▶ nginx ─▶ /api/*  → backend  (127.0.0.1:4100) ─▶ Postgres (private Docker network, no published port)
                    └─▶ others  → frontend (127.0.0.1:3000)
admin ──Tailscale──▶ SSH (port 22 is closed to the internet)
```

Files: `docker-compose.prod.yml`, `infra/nginx/*`, `infra/server/{harden,backup,restore}.sh`, `infra/server/dc.sh`,
`.github/workflows/{ci,deploy}.yml`, `.env.production.example`.

## 0. Before you start
- A domain you control (e.g. `reviews.yourschool.sg`). Create an **A record** pointing at the VPS IP.
- A [Tailscale](https://tailscale.com) account (free tier is enough) and Tailscale on your laptop.
- The VPS provider's **web console** bookmarked: it is your way back in if a firewall step goes wrong.

## 1. Buy and prepare the VPS
Pick the **Singapore** region, Ubuntu 24.04, 2 vCPU / 4 GB. Add your SSH public key at purchase time, so you can log in as root once.
Enable the provider's own firewall and snapshots if offered (extra layers; not a replacement for steps below).

## 2. Harden the server — phase 1 (SSH still open, so you cannot lock yourself out)
From your laptop, copy the repo's `infra` folder and compose file over, then run the script on the server:

```bash
scp -r infra docker-compose.prod.yml root@<server-ip>:/root/ph/
ssh root@<server-ip>
cd /root/ph
DEPLOY_USER=deploy SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" \   # (paste your public key if running on the server)
DOMAIN=reviews.yourschool.sg LE_EMAIL=you@yourschool.sg \
  ./infra/server/harden.sh phase1
```

It: updates the system; creates the `deploy` user (key-only, sudo); disables root and password SSH; configures `ufw` (deny all,
allow 80/443 and — for now — 22); installs Tailscale, fail2ban, unattended-upgrades (security patches, reboot at 03:30 SGT if needed),
sysctl hardening, persistent logs + auditd, Docker (log rotation, `no-new-privileges`), nginx, and a Let's Encrypt certificate that
renews itself. **Open a second terminal and confirm `ssh deploy@<server-ip>` works before closing the first.**

## 3. Join Tailscale, then close public SSH — phase 2
```bash
sudo tailscale up --hostname=peterhouse-reviews        # open the printed URL and approve the machine
```
From your laptop (on Tailscale): `ssh deploy@peterhouse-reviews` and run `sudo -n true && docker ps`. Only if that works:
```bash
sudo /root/ph/infra/server/harden.sh phase2 --confirmed-tailscale-ssh-works
```
Port 22 is now reachable only on `tailscale0`. From a machine **not** on Tailscale, `ssh deploy@<public-ip>` should time out.
Lost access? Use the provider's web console and run `ufw allow 22/tcp`.

## 4. Keys and secrets
On your laptop:
```bash
pnpm --filter @peterhouse/backend gen-key          # → k1:xxxxxxxx…   = DATA_ENCRYPTION_KEYS
openssl rand -hex 24                # → POSTGRES_PASSWORD
age-keygen -o peterhouse-backup-key.txt   # prints the PUBLIC key (age1…); the file is the PRIVATE key
```
> **Back up `DATA_ENCRYPTION_KEYS` in a password manager *and* an offline copy (printed / USB in a safe).** Child names, notes,
> reports and photos are encrypted with it. **If it is lost, every backup and the live database become permanently unreadable.**
> Keep it separate from the database backups (a backup next to its key is no protection; a backup *without* its key is useless).
> Also store the age **private** key (`peterhouse-backup-key.txt`) somewhere safe and **off the server**: you need it to restore.

On the server, as `deploy`:
```bash
sudo cp -r /root/ph/docker-compose.prod.yml /root/ph/infra /opt/peterhouse/ && sudo chown -R deploy: /opt/peterhouse   # (CI refreshes these on every deploy)
cd /opt/peterhouse
umask 077 && nano .env.production   # paste the contents of .env.production.example from the repo, then fill in
                                    # POSTGRES_PASSWORD, DATA_ENCRYPTION_KEYS, PUBLIC_ORIGIN and (optional) an AI key
```

## 5. First start
The normal route is GitHub Actions: add the secrets listed at the top of `.github/workflows/deploy.yml`, then
**Actions → Deploy → Run workflow**. It builds and pushes the images, joins Tailscale, and runs `docker compose pull && up -d`.

Manual alternative (slow on 4 GB; fine for a first try): `infra/server/dc.sh up -d --build`.

Check: `infra/server/dc.sh ps` shows `db`, `backend`, `frontend` healthy; `curl -s http://127.0.0.1:4100/healthz` → `{"ok":true}`.
The backend applies database migrations itself on start-up.

Create the first administrator (the password is prompted; they must change it at first sign-in):
```bash
infra/server/dc.sh exec backend node dist/create-admin.js you@yourschool.sg "Your Name"
```
Open `https://reviews.yourschool.sg`, sign in, then add teachers under **Settings → People and sign-ins**.

## 6. Backups
```bash
sudo mkdir -p /etc/peterhouse
sudo tee /etc/peterhouse/backup.env >/dev/null <<ENV
AGE_RECIPIENT=age1…your-PUBLIC-key…
KEEP_DAYS=14
# Strongly recommended: an off-site S3-compatible bucket in ANOTHER provider (e.g. Backblaze B2, Cloudflare R2, AWS S3 ap-southeast-1).
# Configure it once as root with `sudo rclone config` (remote name "offsite"), then:
RCLONE_REMOTE=offsite:your-bucket/peterhouse
ENV
sudo chmod 600 /etc/peterhouse/backup.env
sudo cp /opt/peterhouse/infra/server/peterhouse-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now peterhouse-backup.timer
sudo systemctl start peterhouse-backup.service && journalctl -u peterhouse-backup -n 20 --no-pager   # run one now
```
Each night at 02:30 SGT: one `pg_dump` (the whole database, photos included), encrypted to your **public** key, kept 14 days locally,
copied off-site. The server cannot read its own backups. Without `RCLONE_REMOTE` the job warns loudly: a lost VPS then means lost backups.
Give the off-site bucket a lifecycle rule (e.g. delete after 90 days); rclone here only ever adds files.

### Restore drill (do this once now, then every term)
Copy the private key to the server only for the drill, then shred it:
```bash
scp peterhouse-backup-key.txt deploy@peterhouse-reviews:/tmp/key.txt
sudo /opt/peterhouse/infra/server/restore.sh /var/backups/peterhouse/peterhouse-<stamp>.dump.age /tmp/key.txt    # verify only
shred -u /tmp/key.txt
```
It restores into a scratch database, prints a row count for every table (next to the live counts), and drops the scratch database. Nothing live changes.
To really restore: add `--into-live` (asks you to type YES, takes a safety copy first, stops and restarts the backend).
After a real restore, open a child's record: if it displays, the encryption key matches.

## 7. Rotating the encryption key
1. Generate a new key: `pnpm --filter @peterhouse/backend gen-key` → `k2:…`.
2. In `.env.production` put the new key **first** and keep the old one: `DATA_ENCRYPTION_KEYS=k2:NEW,k1:OLD`.
3. `infra/server/dc.sh up -d backend`. New and edited data is now written with `k2`; existing rows still read with `k1`.
4. **Never remove `k1` while any row or backup still uses it.** There is no bulk re-encryption command yet; until one exists
   (or you have confirmed nothing uses `k1`), keep both. Update the password-manager copy to hold both keys.

## 8. Routine
- Deploy a new version: Actions → Deploy. Roll back: re-run an older commit's workflow, or `IMAGE_TAG=<old sha>` in `/opt/peterhouse/.deploy.env` then `dc.sh up -d`.
- Logs: `infra/server/dc.sh logs -f backend`; the app's own activity log is under Settings → Activity log.
- Patching: the OS patches itself; images are rebuilt on each deploy (re-run Deploy monthly to pick up base-image fixes).

## What protects what

| Threat | Protection |
|---|---|
| Someone scans the server | `ufw` default-deny; only 80/443 public; SSH only on Tailscale; Postgres and the backend have no public port |
| Password guessing | nginx 5/min on sign-in, backend per-IP limit and 5-try account lockout, scrypt hashing, fail2ban on SSH |
| Stolen login cookie | HttpOnly + Secure + SameSite, session ends after 12 h idle / 7 days, server stores only a hash of it |
| Cross-site request tricks | SameSite cookies + origin check on every change + strict CSP/`frame-ancestors 'none'` |
| Eavesdropping | TLS 1.2/1.3 only, HSTS, certificate auto-renewal |
| Stolen database or backup file | Names, birthdays, notes, reports and photos are AES-256-GCM encrypted by the app; the key is not in the database |
| Stolen server backup copy | Backups are `age`-encrypted to a public key; the private key is never on the server |
| A bug in one container | non-root users, read-only filesystems, all capabilities dropped, `no-new-privileges`, memory limits, DB on an internal network |
| Teacher sees another class | Class-scoped access enforced in the backend; other classes look like "not found" |
| "Who did that?" | Per-person accounts + activity log (no child names in it) |
| Server lost | Nightly encrypted off-site backups + a tested restore drill |
| Unpatched software | unattended security updates, reboot window 03:30 SGT, rebuilt images on deploy |

**Not covered:** the provider can read the VM's RAM/disk while it runs (the app-level encryption protects data at rest, not in use);
there is no two-step sign-in yet; losing `DATA_ENCRYPTION_KEYS` loses the data; the backup key holder can read every backup.
