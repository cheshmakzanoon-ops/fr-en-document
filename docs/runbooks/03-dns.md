# Runbook 03 — DNS for northsign.ca

> Phase 3, Step 5. Complete records table for `northsign.ca`. Written for
> **either Cloudflare or plain registrar DNS** — the record set is
> identical; only the proxy setting and the www handling differ (see §3).
>
> **No MX records.** NorthSign sends email only (SES outbound). Nothing
> receives mail on this domain, so no MX and no A/AAAA for an inbound mail
> server.

---

## 1. The records table

Let `<VM_IPv4>` be the public IPv4 of the application VM (provisioned in
runbook 04), and `<TOKEN1..3>` the three Easy DKIM tokens from the SES
console (runbook 02).

| Purpose | Type | Name | Value | TTL |
|---|---|---|---|---|
| App host | **A** | `app` | `<VM_IPv4>` | 300 |
| App host (v6, optional) | **AAAA** | `app` | `<VM_IPv6>` (if any) | 300 |
| Apex redirect | **A** | `@` (apex `northsign.ca`) | `<VM_IPv4>` | 300 |
| www redirect | **CNAME** | `www` | `app.northsign.ca` | 300 |
| SPF | **TXT** | `@` | `v=spf1 include:amazonses.com ~all` | 300 |
| DMARC | **TXT** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:rufo@northsign.ca; ruf=mailto:rufo@northsign.ca; adkim=s; aspf=s; pct=100` | 300 |
| DKIM #1 | **CNAME** | `<TOKEN1>._domainkey` | `<TOKEN1>.dkim.amazonses.com` | 300 |
| DKIM #2 | **CNAME** | `<TOKEN2>._domainkey` | `<TOKEN2>.dkim.amazonses.com` | 300 |
| DKIM #3 | **CNAME** | `<TOKEN3>._domainkey` | `<TOKEN3>.dkim.amazonses.com` | 300 |

Behaviour once live:

- `https://app.northsign.ca` → app (TLS by Caddy/Let's Encrypt)
- `https://northsign.ca` → 301 redirect to `https://app.northsign.ca`
- `https://www.northsign.ca` → 301 redirect to `https://app.northsign.ca`
- Email from `no-reply@mail.northsign.ca` passes SPF (amazonses) + DKIM
  (Easy DKIM) and DMARC alignment (`adkim=s; aspf=s` — both aligned to
  `northsign.ca`, which the subdomain sender inherits).

---

## 2. Cloudflare instructions

1. Add `northsign.ca` to Cloudflare (free plan is fine).
2. Create the records from the table in **DNS → Records**:
   - `app` → A → `<VM_IPv4>`
   - `@` → A → `<VM_IPv4>`
   - `www` → CNAME → `app.northsign.ca`
   - the four TXT records (SPF, DMARC, and note `_dmarc` as name)
   - the three DKIM CNAMEs (`<TOKENn>._domainkey` → `<TOKENn>.dkim.amazonses.com`)
3. **Set the app/apex records to DNS-only (grey cloud) for first deploy.**
   Caddy needs to reach its own HTTP-01 challenge over port 80, which
   requires DNS to point directly at the VM.
4. After Caddy reports certificates issued (`docker compose logs caddy`),
   you **may** flip `app` to Proxied (orange cloud) for DDoS caching — then
   set **SSL/TLS → Overview → Full (strict)**, because Caddy's origin
   certificate is a public Let's Encrypt cert Cloudflare can validate.
   Leaving everything DNS-only is perfectly fine too (recommended MVP).
5. For `www`/apex redirects: Caddy already 301s both to the app host, so no
   Cloudflare redirect rule is required. (If you ever proxy `www`/apex
   through Cloudflare, a redirect rule is an acceptable alternative.)

## 3. Registrar DNS instructions (no Cloudflare)

The same table, entered in the registrar's DNS editor (Porkbun, GoDaddy,
Namecheap, …):

- `app`, `@`, `www`, and the CNAME/TXT records exactly as above.
- **No proxy option exists** — the records point straight at the VM; this
  is fine and is actually the default recommended setup.
- `www` as a CNAME: supported by modern registrars. If your registrar only
  accepts A records for `www`, create `www` → A → `<VM_IPv4>` instead.
- The redirects are handled by Caddy (see `docker/production/Caddyfile`),
  so nothing extra is needed in DNS.

---

## 4. Verify propagation

```bash
dig +short A app.northsign.ca          # expect <VM_IPv4>
dig +short TXT northsign.ca            # expect SPF (+ any existing TXT)
dig +short TXT _dmarc.northsign.ca     # expect the DMARC record
dig +short CNAME <TOKEN1>._domainkey.northsign.ca  # expect <TOKEN1>.dkim.amazonses.com
```

Caddy issuance requires `app.northsign.ca` (and the apex) to resolve
publicly — run the checks **from a different network** (e.g. your laptop)
before `docker compose up` on the VM. `dig` against 8.8.8.8 shows the
publicly visible state:

```bash
dig @8.8.8.8 +short A app.northsign.ca
```

---

## 5. Ordering note

DNS records should be published **before** the first deploy (DEPLOY.md
step 1) so that Caddy can issue certificates on first start. DKIM/SPF/DMARC
must be live before the SES identity shows Verified (runbook 02 §5).
