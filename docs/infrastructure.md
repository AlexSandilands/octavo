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
   placeholder branding. Deploy behaviour is config-as-code in `railway.json`:
   migrations run as the pre-deploy step (`npm run db:migrate`), and the deploy
   health check polls `GET /api/health` (200 when the DB answers, 503 otherwise —
   point UptimeRobot at the same path). The R2 env vars are **required in
   production**: `src/lib/env.ts` refuses to boot without them, because Railway's
   filesystem is ephemeral and the local-disk image fallback would lose uploads on
   every redeploy.
4. **Email** — create the provider account; verify the sending domain by adding its
   **SPF, DKIM, and DMARC** records in Cloudflare DNS (do this carefully — it's what
   keeps blasts out of spam); get the API key.
5. **Auth** — set `AUTH_SECRET` (generate with `npx auth secret`). Sign-in is
   magic-link only; the email provider from step 4 delivers the links.
6. **First admin** — `/admin` only admits users with `is_admin`, and only an admin
   can manage members, so bootstrap the first one from the command line:
   `railway run npm run db:admin -- you@example.com` (drop the `railway run` prefix
   locally). Idempotent — it creates the user or promotes an existing one. Then
   sign in at `/signin` with that email.
7. **Monitoring** — add the Sentry DSN; create an UptimeRobot monitor on the site URL
   with email/SMS alerts to the developer.
8. **Deploy** — confirm a test magic-link email arrives, signing in works, and an
   image upload lands in R2.

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
cleared the actionable findings, incl. a high in drizzle-orm). One finding remains,
**not exploitable here and unfixable on any stable Next** — re-check on updates:

- `postcss <8.5.10` (exact-pinned inside `next`; verified still pinned in the latest
  Next 16.2 — only 16.3 canaries bump it). Build-time processing of our own CSS; the
  XSS scenario needs attacker-controlled CSS. Clears when a stable Next bumps it.

Related notes:

- `drizzle-orm`/`drizzle-kit` are on **1.0.0-rc** (the 0.x kit line bundled a
  vulnerable esbuild via a deprecated loader; the 1.0 line dropped it). Move to
  1.0 stable when released.
- Never run `npm audit fix --force` — it downgrades `next` to a 9.x "fix".

## Email bounces (new-issue blasts)

Publishing an issue sends ~1 email per subscribed member via Resend. Some will bounce
(closed mailboxes, full inboxes, typo'd addresses). The app does **not** yet process
bounces automatically — handle them manually for now:

1. After a blast, open the **Resend dashboard → Emails** and filter by `Bounced` /
   `Complained`. Resend retains per-message delivery status.
2. For a **hard bounce** (mailbox doesn't exist) or a **spam complaint**, stop mailing
   that address: either remove the member, or set `subscribed = false` on their `users`
   row (the same flag the unsubscribe link flips). Continuing to mail hard-bounced
   addresses hurts domain reputation and pushes future blasts toward spam folders.
3. **Soft bounces** (temporary — mailbox full, greylisting) usually clear on their own;
   only act if the same address bounces across several issues.
4. The `Bounced` pill already exists in the members UI (`components/ui.tsx`) for when
   this is surfaced in-app.

**Stretch (not built):** a Resend **webhook** (`email.bounced` / `email.complained`)
posting to a route that sets `subscribed = false` (or a `bounced` flag) on the matching
`users` row would automate steps 1–2. Deferred deliberately — it needs a verified
webhook signature and a new endpoint, and the manual process above is fine at club scale.

## Recurring landlord tasks (rare)

- Keep domain auto-renew on and billing cards current (a lapse takes the site down).
- Apply dependency/security updates occasionally.
- Watch Sentry/UptimeRobot alerts; check email deliverability if blasts start hitting
  spam.
- Verify Railway Postgres backups exist and a restore has been tested once (Phase 4).
