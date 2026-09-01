# Runbook 04 — VM hardening (Ubuntu 24.04 LTS)

> Phase 3, Step 7. The application VM baseline. Run top-to-bottom on a
> fresh Ubuntu 24.04 LTS instance **in ca-central-1 (Montreal)** — the
> residency line starts here.
>
> Instance sizing for MVP: 2 vCPU / 4 GB RAM (e.g. `t3.medium` or
> `c7g.medium`). The 2 GB swap step below matters for 4 GB instances.

**Order matters:** hardening steps that could lock you out (SSH) are done
in a way that keeps your current session alive — read the warnings.

---

## 1. Update the base system

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y --no-install-recommends \
  ca-certificates curl gnupg ufw unattended-upgrades \
  software-properties-common fail2ban
```

## 2. Timezone — America/Toronto (business hours, logs, cron)

```bash
sudo timedatectl set-timezone America/Toronto
timedatectl   # confirm "Local time" is ET and NTP is active
```

## 3. Swap (2 GB) — small instances only

Skip if the instance already has ≥ 8 GB RAM. For the 4 GB MVP instance:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
sudo sysctl --system
free -h   # expect ~2G in the swap row
```

## 4. SSH — key-only, no root login

> Do this from a terminal you are already connected to, and TEST a second
> connection before closing the first.

```bash
# 4a. If you have not already, install your public key:
mkdir -p ~/.ssh && chmod 700 ~/.ssh
# paste your key into ~/.ssh/authorized_keys (e.g. from your laptop:
#   cat ~/.ssh/id_ed25519.pub | ssh ubuntu@<vm-ip> "cat >> ~/.ssh/authorized_keys")
chmod 600 ~/.ssh/authorized_keys

# 4b. Lock sshd down:
sudo tee /etc/ssh/sshd_config.d/99-northsign.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
EOF
sudo sshd -t && sudo systemctl restart ssh
```

**Verify before closing your session:** open a NEW SSH session from your
laptop. It must connect with the key and **without a password prompt**. If
it fails, fix `authorized_keys` before closing the working session.

## 5. Firewall — ufw: only 22, 80, 443

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH — change to your static IP if you have one: allow from <your-ip> to any port 22
sudo ufw allow 80/tcp    # Caddy ACME + redirects
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
sudo ufw status verbose  # 22, 80, 443 ONLY
```

Anything else (5432 for Postgres, 3000 for the app) must NOT appear here —
the compose stack keeps Postgres and the app on the internal Docker network
(`expose:` only). If you ever need `docker port` access for debugging, SSH
tunnel instead of opening a port.

## 6. Unattended security upgrades

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades   # answer Yes
# or non-interactively:
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";' \
  | sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null

# Verify it actually runs:
sudo unattended-upgrade --dry-run --debug | tail -5
```

Automatic reboot at 03:00 (quiet hours) keeps the box patched; Docker
`restart: unless-stopped` brings the stack back up automatically.

## 7. Deploy user (non-root) in the docker group

```bash
sudo adduser --gecos "" northsign
sudo usermod -aG docker northsign
# copy your SSH key to the new user:
sudo mkdir -p /home/northsign/.ssh
sudo cp ~/.ssh/authorized_keys /home/northsign/.ssh/authorized_keys
sudo chown -R northsign:northsign /home/northsign/.ssh
sudo chmod 700 /home/northsign/.ssh && sudo chmod 600 /home/northsign/.ssh/authorized_keys
```

From now on: `ssh northsign@<vm-ip>` and **never** run anything as root
except sudo for maintenance. `docker` commands work as `northsign` (docker
group membership — re-login once for the group to apply).

## 8. Install Docker + compose plugin (as the deploy user)

```bash
# docker engine + compose plugin (Ubuntu 24.04, official repo):
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker northsign   # (already added in step 7 — idempotent)
newgrp docker

docker --version
docker compose version    # compose v2 plugin required by docker-compose.prod.yml
```

## 9. Install aws CLI v2 (needed by scripts/backup.sh)

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp/aws-cli && sudo /tmp/aws-cli/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws-cli
aws --version
```

Configure the **BackupUser** credentials (from runbook 01) for the deploy
user:

```bash
mkdir -p ~/.aws && chmod 700 ~/.aws
# ~/.aws/credentials:
#   [northsign-backup]
#   aws_access_key_id = <BackupUser key>
#   aws_secret_access_key = <BackupUser secret>
chmod 600 ~/.aws/credentials
aws s3 ls s3://northsign-backups --profile northsign-backup --region ca-central-1   # smoke test
```

## 10. fail2ban (cheap SSH brute-force protection)

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

Default Ubuntu config bans 10 failed SSH attempts for 10 minutes — good
enough for MVP. (The box has no other exposed ports, so this is the only
service it protects.)

## 11. Deploy-time permissions (`.env` and secrets)

When the stack is deployed (DEPLOY.md):

```bash
chmod 600 ~/northsign/.env          # secrets readable by deploy user only
chmod 600 ~/northsign/cert.p12      # signing certificate
```

Rule: **any file containing secrets on this VM is chmod 600 and owned by
the deploy user.** Verify occasionally:

```bash
find ~/northsign -maxdepth 1 -name ".*" -o -name "*.p12" | xargs ls -l
```

## 12. Final verification checklist

- [ ] `timedatectl` → America/Toronto
- [ ] `sudo ufw status` → 22, 80, 443 only; default deny incoming
- [ ] `ss -tlnp` → nothing listening on public interfaces except 22/80/443
- [ ] SSH login with key only (password auth refused)
- [ ] `sudo unattended-upgrade --dry-run` works
- [ ] `free -h` shows the 2 GB swapfile
- [ ] `docker run --rm hello-world` works as `northsign`
- [ ] `aws s3 ls s3://northsign-backups --profile northsign-backup` works
- [ ] 2 GB swap + swapiness 10 applied (`cat /proc/sys/vm/swappiness`)
