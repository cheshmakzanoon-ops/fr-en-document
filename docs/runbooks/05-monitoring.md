# Runbook 05 — Monitoring (minimal)

> Phase 3, Step 9. The smallest monitoring surface that tells us "the
> product is up": one external uptime check, container logs, and a weekly
> disk check. **Full observability (metrics, tracing, log shipping, alert
> routing) is a later-phase decision — deliberately NOT built now** (D-021).

---

## 1. External uptime — UptimeRobot (free)

Create a monitor for the **health endpoint** added in Phase 3 Step 8:

| Setting | Value |
|---|---|
| Monitor type | HTTP(s) |
| URL | `https://app.northsign.ca/api/health` |
| Interval | 5 minutes (free plan) |
| Alert contacts | your email (free plan supports email) |
| Expected status | 200 OK |

The endpoint returns `{"status":"ok"}` with **no side effects and no
database access** — it answers as long as the app process is alive, which
is exactly what an uptime check should measure. A 200 from UptimeRobot
does **not** mean the DB is healthy; that's acceptable for this phase
(DB problems surface through the product smoke tests and backups, not a
monitor).

Notes:

- UptimeRobot checks from outside AWS — this is outbound monitoring of a
  public endpoint and stores no customer data (residency claim unaffected,
  see DEPLOYMENT.md Sec. 4).
- Free plan is fine for MVP (50 monitors / 5-min checks). No paid
  monitoring until Phase 9 (hardening).
- Add a second monitor for `https://northsign.ca` (the redirect) if you
  want to catch DNS/Caddy issues on the apex — optional.

## 2. Container logs

All services log to stdout/stderr inside Docker (the app's pino logger
writes to stdout unless `NEXT_PRIVATE_LOGGER_FILE_PATH` is set — it is not
in production):

```bash
# tail the app
docker compose -f docker-compose.prod.yml logs -f --tail=200 app

# everything (app, database, caddy)
docker compose -f docker-compose.prod.yml logs -f --tail=200

# last hour of app errors only
docker compose -f docker-compose.prod.yml logs --since=1h app | grep -i error | tail -50
```

**Where the log bytes live on disk:** Docker's default `json-file` driver
writes each container's log under
`/var/lib/docker/containers/<container-id>/<container-id>-json.log`
(`sudo ls /var/lib/docker/containers` to find IDs). You normally never
touch these directly — always go through `docker compose logs`.

**Recommended (small, do it at deploy time):** add log rotation to the
compose file so the json logs cannot grow unbounded:

```yaml
  app:
    logging:
      driver: json-file
      options:
        max-size: "20m"
        max-file: "3"
```

(the same block for `caddy` and `database`). This is config, not an
observability build-out.

## 3. Weekly disk-space check

The 4 GB MVP instance has a small root volume; S3 holds the documents, so
the risk is logs + docker images + postgres data growth. Check weekly:

```bash
# quick look
df -h /
docker system df

# what is actually big
sudo du -sh /var/lib/docker 2>/dev/null
docker compose -f docker-compose.prod.yml ps --format '{{.Name}} {{.Size}}'
```

**Expected state:** root volume used < 80%. If it creeps up:

- prune unused images: `docker system prune -f` (safe; keep the last image
  by default with `-a` only if you know what you are removing)
- check `database` volume growth: `docker system df -v | grep -A2 database`
- if Postgres data is the driver, that is expected growth — plan a volume
  size bump or move to a larger EBS volume in Phase 9.

To make the weekly check not-optional, add a reminder to the same crontab
as the backups (Sunday 09:00):

```bash
# crontab -e
0 9 * * 0 df -h / | mail -s "NorthSign disk check" ops@northsign.ca
```

(Replace with whatever alert channel you use — a cron + email is the
minimum for this phase.)

## 4. What we are intentionally NOT doing (yet)

- No metrics/APM agent (no Prometheus/Grafana/DataDog/Datadog).
- No structured log shipping (no Loki/ELK/CloudWatch Logs).
- No synthetic sign-flow monitoring.
- No paging/on-call rotation.

All of that is Phase 9 (hardening, load & security testing). The rule is
the same as everywhere else: when observability lands, its storage must
satisfy the Canadian-region requirement (D-017).
