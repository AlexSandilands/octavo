# Infrastructure

What's needed to host the magazine, how it's set up, and what it costs. The developer
owns these accounts (the "landlord" role — see [ROADMAP.md](ROADMAP.md)); the club never
touches them.

## Components

| Piece        | Service                       | Role                                                       |
| ------------ | ----------------------------- | ---------------------------------------------------------- |
| App hosting  | Railway                       | Runs the Next.js app + on-demand PDF generation            |
| Database     | Railway Postgres              | Issues, images metadata, users/sessions                    |
| File storage | Cloudflare R2                 | WebP images + cached PDFs (zero egress fees)               |
| CDN + DNS    | Cloudflare                    | Caches assets, serves the domain                           |
| Domain       | Any registrar (or Cloudflare) | e.g. clubmag.org                                           |
| Email        | Resend (or Postmark)          | Magic links + new-issue blasts (~1,000/issue)              |
| Auth         | Auth.js (in-app)              | Magic-link sign-in, Postgres adapter — no separate service |
| Monitoring   | Sentry + UptimeRobot          | Errors + uptime alerts to the developer                    |

## How it fits together

```
Member ── Cloudflare (DNS/CDN) ── Railway (Next.js + Postgres)
                                      │
                      images/PDFs ────┼──── Cloudflare R2  (via S3 API)
                      emails      ────┴──── Resend         (via API/SMTP)
```

- App talks to **Postgres** via `DATABASE_URL` (injected by Railway; prefer the internal
  URL — no SSL needed, no egress cost. If the public proxy URL is ever used, require
  `sslmode=require`).
- App reads/writes **R2** with the S3-compatible SDK; images served from R2 behind
  Cloudflare (serving model per ROADMAP open decision #2).
- App sends **email** via the provider's API; the sending domain is verified with DNS
  records.
- **Auth.js** issues magic links through the same email provider, sessions stored in
  Postgres.

## Setup order (one-time)

1. **Domain** — register; add it to Cloudflare; point nameservers at Cloudflare.
2. **Cloudflare R2** — create a bucket; generate an S3 API token (access key + secret);
   note the account ID and public bucket URL.
3. **Railway** — create a project; deploy the app from the repo; add the Postgres
   plugin; set env vars (below). `NEXT_PUBLIC_*` vars are **build-time inlined** — they
   must be present in the build environment, not just at runtime, or the site shows
   placeholder branding. Migrations run as a pre-deploy step (`drizzle-kit migrate`).
4. **Email** — create the provider account; verify the sending domain by adding its
   **SPF, DKIM, and DMARC** records in Cloudflare DNS (do this carefully — it's what
   keeps blasts out of spam); get the API key.
5. **Auth** — set `AUTH_SECRET`; wire Auth.js to the email provider + Postgres adapter.
6. **Monitoring** — add the Sentry DSN; create an UptimeRobot monitor on the site URL
   with email/SMS alerts to the developer.
7. **Deploy** — confirm a test magic-link email arrives and an image upload lands in R2.

### Note on PDF generation

PDF export uses headless Chromium (Playwright). It needs system dependencies in the
container — use Railway's Nixpacks/Docker config to install them, or run PDF generation
as a small separate Railway service if it bloats the main app's memory.

## Environment variables (app)

`.env.example` is the canonical list; `src/lib/env.ts` validates at boot. Summary:

```
DATABASE_URL=            # from Railway Postgres
AUTH_SECRET=             # random 32+ char secret

NEXT_PUBLIC_MAGAZINE_NAME= / _ORG_NAME= / _TAGLINE=   # branding (build-time!)

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=           # https://images.clubmag.org (Cloudflare-proxied)

EMAIL_API_KEY=           # Resend/Postmark key
EMAIL_FROM=              # "Club Magazine <hello@clubmag.org>"

SENTRY_DSN=              # once monitoring lands (Phase 4)
```

## Estimated costs

At ~1,000 members and roughly monthly issues:

| Service            | Plan                            | Est. cost   |
| ------------------ | ------------------------------- | ----------- |
| Railway            | Hobby ($5 base + usage)         | ~$5–20 / mo |
| Cloudflare R2      | Free tier (10 GB) covers it     | ~$0         |
| Cloudflare CDN/DNS | Free                            | $0          |
| Email (Resend)     | Pro (no daily cap, 50k/mo)      | ~$20 / mo   |
| Monitoring         | Sentry + UptimeRobot free tiers | $0          |
| Domain             | annual                          | ~$12 / yr   |

**≈ $25–40 / month + ~$12 / year.**

- Email is the one cost that scales with membership. Resend free tier (3k/mo, 100/day)
  can't do a 1,000-recipient blast in one go, so budget the ~$20 Pro plan. Postmark
  (~$15/mo) is an alternative.
- Storage and bandwidth stay effectively free for a long time — R2 has no egress fees
  and issues are small (a typical issue ≈ 2–4 MB).
- If membership grows past a few thousand, the email tier is the first thing to
  revisit; everything else has plenty of headroom.

## Accepted `npm audit` findings

Reviewed 2026-07 after upgrading next / drizzle-orm / drizzle-kit / next-auth (which
cleared the actionable findings, incl. a high in drizzle-orm). Two moderates remain,
both **not exploitable here** — re-check on each dependency-update pass:

- `esbuild <=0.24.2` (nested under drizzle-kit's deprecated `@esbuild-kit` loader,
  which hard-pins it — npm overrides can't take). The advisory needs esbuild's HTTP
  dev-server running; drizzle-kit only uses esbuild as a file loader. Dev machines only.
- `postcss <8.5.10` (exact-pinned inside `next`). Build-time processing of our own
  CSS; the XSS scenario needs attacker-controlled CSS. Clears when Next bumps it.

Never run `npm audit fix --force` — it downgrades `next` to a 9.x "fix".

## Recurring landlord tasks (rare)

- Keep domain auto-renew on and billing cards current (a lapse takes the site down).
- Apply dependency/security updates occasionally.
- Watch Sentry/UptimeRobot alerts; check email deliverability if blasts start hitting
  spam.
- Verify Railway Postgres backups exist and a restore has been tested once (Phase 4).
