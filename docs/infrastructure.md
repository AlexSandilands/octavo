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
- App reads/writes **R2** with the S3-compatible SDK. **Serving model (settled, issue #6):
  the bucket is public and images are served straight from their `R2_PUBLIC_URL` (Cloudflare-
  cached, zero Railway egress); `next/image` renders them `unoptimized` so nothing is proxied
  through the Railway container.** Access control is by _unguessable key_: every object lives
  at `…/<uuid>.webp`, so a URL can't be enumerated, and the page-level member gate protects the
  reading experience. A leaked image URL exposes only that one image — acceptable for club-
  magazine photos, which is why signed URLs (with their TTL/caching cost) were rejected. Keep
  the bucket's objects readable but **listing disabled** so keys can't be walked.
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
7. **Monitoring** — add the Sentry DSN (both `SENTRY_DSN` and
   `NEXT_PUBLIC_SENTRY_DSN`) and set the alert rule; create an UptimeRobot
   monitor on `/api/health` with alerts to the developer. Full steps in
   [Error tracking](#error-tracking-sentry) and
   [Uptime monitoring](#uptime-monitoring-uptimerobot).
8. **Deploy** — confirm a test magic-link email arrives, signing in works, and an
   image upload lands in R2.

### PDF generation

PDF export (issue #16) uses headless Chromium via Playwright, in the **main
service** (no separate service). How it works: the download endpoint
(`GET /api/issues/[number]/pdf`, members-only) checks R2 for a cached PDF keyed
by issue id + revision + reader theme + render version
(`pdfs/{issueId}/{revision}-{theme}-v{N}.pdf` — the theme follows the desktop
reader's toggle; `v{N}` is a code constant bumped alongside any print-rendering
change so stale artifacts regenerate); on a miss it launches
Chromium, loads the issue's print route over localhost, prints the fixed
PAGE_W×PAGE_H canvas to a paginated PDF, caches the bytes, and serves them.
Because `revision` bumps on every content write, an edit + republish yields a
fresh key with no manual invalidation, and repeat downloads of the same revision
are cache hits. Generation is coalesced per key within an instance, so the first
click after a publish launches one Chromium even if several members click at
once. Chromium is a transient, on-demand cost — not held between requests.

**Container deps — [`nixpacks.toml`](../nixpacks.toml)** installs the shared
libraries Chromium needs (`aptPkgs`) and downloads Playwright's pinned Chromium
into the image at build time. `playwright` is a **runtime** dependency (not just
dev). **This must be verified on a real Railway deploy** — the dev sandbox has
no headless Chromium, so the deploy-time browser install can only be exercised
there. Four things this setup depends on, each of which broke a deploy once
(issue #68) and will silently regress if reverted:

- **Builder must be Nixpacks.** Railway now defaults to the Railpack builder,
  which **ignores `nixpacks.toml` entirely** — so the apt libs and Chromium
  install never run and the PDF route 500s. [`railway.json`](../railway.json)
  pins `build.builder = "NIXPACKS"`; keep it.
- **Chromium must land in a real image layer, not a build cache mount.** The
  `playwright` phase must **not** set `cacheDirectories` for
  `/root/.cache/ms-playwright`: Nixpacks implements that as a Docker build cache
  mount (build-only), so the browser downloads at build but is absent at runtime
  (`Executable doesn't exist…` → `ChromiumUnavailableError`). Without the mount
  the install writes into a shipped layer, at the cost of ~30s per build (no
  download cache). This is the exact mental model to preserve.
- **`aptPkgs` names must match Ubuntu 24.04 (Noble),** the Nixpacks base. Noble's
  64-bit `time_t` transition renamed `libasound2` → `libasound2t64`; the old
  name is an ambiguous virtual package ("no installation candidate") and fails
  the apt step (exit 100). Verify package names against Noble if this list changes.
- **`engines.node` must be a version Nixpacks stocks.** It's pinned `>=22` (not
  a bleeding-edge exact like `26.x`, which Nixpacks has no package for and
  silently falls back from to EOL Node 18 for the build). Local/CI Node 26 still
  satisfies `>=22`.

**Memory:** one headless Chromium rendering a ~10–20-page issue peaks at a few
hundred MB, transiently, and only while a PDF is being generated (rare, cached
after). At club scale this fits comfortably alongside the app on a Hobby
instance. **Watch it after launch** (Railway metrics): if a generation OOMs the
main service, the fallback is to **split a tiny PDF service** — a second Railway
service from this same repo that only runs the generator, called by the download
endpoint over the private network. That is a documented option, deliberately not
built now (no new service unless memory forces it — issue #16 budget).

**Internal print route:** `/read/[n]/print` renders the issue for Chromium to
print. The reader is members-only, so this route must not be publicly reachable:
it is excluded from the edge session gate (the cookie-less localhost generator
has to reach it) and instead authorises with an **internal token** derived from
`AUTH_SECRET` (`src/lib/pdf-token.ts`) — a request without a valid token 404s.
It only ever renders already-published content, so no new secret is exposed.

## Demo project (marketing showcase)

A public, ungated copy of the site for marketing (issue #50). Provisioning it is a
manual owner action, like the other one-time setups above (cf. #39) — the app just
honours the flag once it's set. It is a **second Railway project off the same repo**,
fully isolated from the members' site:

1. **New project + its own stores.** Create a separate Railway project deploying this
   repo, with **its own** Postgres plugin and **its own** R2 bucket — never point it
   at production's DB or bucket.
2. **Set `NEXT_PUBLIC_DEMO_MODE=1` before the first build.** It's `NEXT_PUBLIC_*`, so
   it's build-time inlined (`src/lib/demo.ts`) — present at build, not just runtime, or
   the gate stays on. This ungates `/` and `/read/*`; `/admin/*`, server actions and
   uploads stay locked (see [architecture.md](architecture.md#demo-mode)).
3. **Keep `EMAIL_API_KEY` / `EMAIL_FROM` set** (the same Resend account is fine —
   `src/lib/env.ts` refuses to boot production without them). Email is still
   effectively dormant: a magic link only sends to an address that already exists in
   the demo DB's `users` table (that's just the owner), and the publish blast needs an
   admin session and is skippable per publish. This is also how the owner signs into
   `/admin` on the demo, which stays fully gated.
4. **Seed content.** `railway run npm run db:seed` populates issues, generating the
   placeholder images at seed time and writing them **straight to the project's R2
   bucket** (the seed uses the same R2-when-configured/local-otherwise storage choice
   as the app, so on the demo project the reader serves every seeded image from R2 —
   nothing else to upload). The seed **wipes issues and refuses when published issues
   exist unless `--force`** — safe against the demo project's own DB, but for that
   reason **never run it against production**. Run
   `railway run npm run db:admin -- you@example.com` to be able to sign in and author
   on the demo.

Set the usual `DATABASE_URL`, `AUTH_SECRET`, `R2_*` and `NEXT_PUBLIC_*` branding as
below — only the demo flag differs from a normal deploy.

**The demo doubles as staging.** Point this project at the **`main`** branch (while the
members' production site tracks `production` — see [Release workflow](#release-workflow)).
Every merge to `main` then redeploys the demo, so it's both the public marketing showcase
and a pre-prod smoke test: it renders real content and, because it has its own Postgres,
applies each migration against the demo DB before you ever promote to production. Know its
limits — `NEXT_PUBLIC_DEMO_MODE=1` ungates `/` and `/read/*` and leaves email dormant, so
the demo does **not** exercise the member auth gate, the signed-out `/signin?next=`
redirect, or the publish email blast. Validate those locally before promoting.

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

SENTRY_DSN=              # Sentry project DSN (server-side). Optional — app runs fine unset.
NEXT_PUBLIC_SENTRY_DSN=  # SAME DSN, browser copy (public ingest key; build-time inlined).
```

Both Sentry vars are optional everywhere: with them unset, `Sentry.init` is
skipped and every capture call is a no-op, so the app boots and behaves
identically. Set **both** to the same DSN to turn error reporting on (see
[Error tracking](#error-tracking-sentry) below).

## Error tracking (Sentry)

Wired in code (`@sentry/nextjs`, error-reporting only — no performance tracing,
no session replay). The app captures the swallow-points that would otherwise
vanish into logs: editor save/publish failures, image-upload decode + storage
errors, new-issue email-blast batch failures, and the client error boundaries
(`app/error.tsx`, `app/admin/error.tsx`, `app/global-error.tsx`). Server render/
route errors flow through `onRequestError` in `src/instrumentation.ts`. Member
emails are **not** attached to events (`sendDefaultPii: false`, and no capture
site passes an address); only counts/ids that a diagnosis needs.

**Config layout** (for reference): `sentry.server.config.ts` /
`sentry.edge.config.ts` init the two server runtimes, `src/instrumentation-client.ts`
inits the browser, `src/instrumentation.ts` registers them, and
`next.config.ts` is wrapped with `withSentryConfig`. The middleware CSP allows
the Sentry ingest host in `connect-src` (derived from the DSN) so browser events
aren't blocked by the strict nonce policy.

**Owner setup (one-time — the code is ready and inert until you do this):**

1. Create a free Sentry account and a **Next.js** project. Copy its DSN.
2. Set **both** env vars on Railway to that DSN: `SENTRY_DSN` and
   `NEXT_PUBLIC_SENTRY_DSN` (same value — the second is the browser copy and is
   build-time inlined, so it must be present in the build/deploy environment).
   Redeploy. Errors now report; no code change needed.
3. **Alert rule → developer email:** Sentry → **Alerts → Create Alert → Issues**.
   Condition "A new issue is created" (and/or "an issue changes state to
   escalating"), action **Send a notification to** your email. Save. This is
   what makes the developer hear about a break before the club does.
4. (Optional, nicer stack traces) To de-minify production stack traces, set a
   `SENTRY_AUTH_TOKEN` (+ `SENTRY_ORG`/`SENTRY_PROJECT`) in the **build**
   environment so `withSentryConfig` uploads source maps. Without it the build
   just skips the upload with a warning — nothing breaks.

**Verify:** with the DSN set, trigger a test error (e.g. temporarily throw in a
server action) and confirm it lands in Sentry with request context, then remove
the throw. With the DSN unset the app must still boot — confirmed in dev.

## Uptime monitoring (UptimeRobot)

**Owner setup:** create a free UptimeRobot account →
**Add New Monitor → HTTP(s)** → URL `https://<your-domain>/api/health` (the same
endpoint Railway's deploy health check polls; returns `200 {"status":"ok"}` when
the DB answers, `503` otherwise). Interval 5 min. Under **Alert Contacts** add
the developer's email (and SMS if wanted) and attach it to the monitor. This
catches the "site is down / DB unreachable" case that Sentry (which needs the
app running to report) can't.

## Continuous integration (GitHub Actions)

`.github/workflows/ci.yml` runs on every PR and every push to `main`: `npm ci`
→ `npm run lint` → `npx tsc --noEmit` → `npm run build`. The build runs with
`NODE_ENV=production`, so `src/lib/env.ts` requires the R2 + email vars — the
workflow supplies **dummy** values (the build never connects to Postgres or R2;
every data route is dynamic, so it only needs the vars to be present and valid).
`NEXT_PUBLIC_*` branding is set in the workflow because those are inlined into
the client bundle at build time. No `SENTRY_DSN` is set in CI on purpose — that
proves the app builds without Sentry. `actions/setup-node` caches the npm
download cache keyed on the lockfile.

**Owner action — branch protection:** GitHub → repo **Settings → Branches →
Add branch ruleset** (or classic branch protection) for `main`: require status
checks to pass before merging, and select the **`lint · types · build`** check.
Optionally require a PR review. This makes CI a merge gate, not just a signal.
Protect `production` too — see [Release workflow](#release-workflow).

## Release workflow

Two long-lived branches map to the two Railway projects, so a merge never ships
straight to members:

- **`main`** — the integration branch. PRs land here; it must stay green. The
  [demo project](#demo-project-marketing-showcase) deploys `main`, so every merge
  redeploys `demo.octavo.dev` — your pre-prod smoke test.
- **`production`** — what the members' site runs. It only ever *fast-forwards*
  from `main`; nothing is committed to it directly. The production Railway service
  deploys this branch.

**Shipping is a deliberate promotion:** open a PR from `main` → `production`, titled
`release: promote to production YYYY-MM-DD`, and merge it (Merge commit only — never
squash/rebase, which would diverge `production` from `main`). The `release:` prefix
keeps prod PRs filterable (`is:pr in:title release:`); an optional `release` label
works too. Merging triggers the production deploy, and the PR history becomes your
dated release log (handy for "what changed?" when something breaks). A fast-forward `git push origin main:production` also works but loses that
trail and needs bypass rights against the ruleset below. Because `production` only
fast-forwards from an already-green `main`, its migrations and code are exactly what
you smoke-tested on the demo first.

**Turn on "Wait for CI to pass"** (Railway → each service → Settings → Deploy) for
**both** the demo and production services, so a red `lint · types · build` never
deploys either. CI runs on every PR regardless of target branch, so the promotion
PR into `production` is checked automatically.

**Owner action — protect `production`:** add a ruleset for `production` aimed at
*preventing accidents* (the code was already quality-gated at `main`), not
re-reviewing it: block force pushes, block deletion, require a PR to update it, and
require the **`lint · types · build`** check. **Do not** require a second reviewer —
as a solo maintainer you'd be unable to approve your own promotion PR (or add
yourself to the bypass list if you do). Keep the rule that `production` only ever
fast-forwards from `main`: hotfixes still flow through `main` first (fix → PR →
merge → promote), or cherry-pick if you must ship ahead of other `main` work, so the
branches never diverge.

## Backups & restore

Two stores hold state worth protecting: **Postgres** (issues, members,
sessions) and **R2** (uploaded images). Postgres is the one that's genuinely
irreplaceable — its content model, members and auth can't be reconstructed — so
it needs a backup and a _tested_ restore; an untested backup is a guess. R2 is a
lower tier: the stored images are re-encoded WebP _derivatives_ of files the
admin uploaded, so the originals still exist off-platform and a worst case is a
tedious re-upload, not permanent loss. Back it up too, but proportionately (see
below).

### Postgres (Railway)

**Owner action — enable/verify backups:** Railway → the Postgres service →
**Backups** tab. Enable **scheduled daily** backups. Retention depends on plan
(Hobby keeps a rolling window — confirm the current retention shown there and
that the schedule is on). Railway backups are full logical snapshots you can
restore from the dashboard. **Retention decision:** daily backups, ≥7 days
retained; keep at least one known-good snapshot from before each large change
(schema migration, bulk member import).

### R2 (images)

**R2 has no object versioning** — unlike S3, there's no per-object history to
enable, and the bucket's lifecycle rules only _delete_ current objects (a
"delete uploaded objects after N days" rule would destroy live images, not
protect them — don't add one for backup). So the backup mechanism is an external
copy: a periodic **`rclone sync`** of the bucket to a second location (another R2
bucket or local disk), e.g. `rclone sync r2:club-images backup:club-images-YYYYMM`.

**Decision (proportionate to the risk):** this is a lower priority than the DB —
R2 durability is high and the stored images are re-encodable derivatives (see
above). **Skip it until the site goes live with real content** (a demo's seeded
images are regenerable). At go-live, set up a **weekly `rclone sync`** — cheap
insurance against a bad delete or a credential compromise, ~15 min to wire up.
Point-in-time / versioned recovery is overkill at club scale (and unavailable on
R2 anyway).

### Restore runbook (Postgres)

Goal: from a fresh Railway project + a database dump + the R2 bucket, back to a
working site. The DB half of this was **exercised locally** (dump → wipe →
restore → app boots and `/api/health` returns `200`); see the PR note.

1. **New app + DB.** Create a fresh Railway project, deploy the app from the
   repo, add the Postgres plugin. Set all env vars (see
   [Environment variables](#environment-variables-app)).
2. **Get the dump.** From a Railway backup: download/restore it via the Backups
   tab. To take one manually against a running DB:
   `pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" -f magazine.dump`
3. **Restore into the new DB** (target should be empty). Using the new DB's
   connection string:
   `pg_restore --no-owner --no-privileges -d "$DATABASE_URL" magazine.dump`
   The dump carries both the `public` and `drizzle` (migration-tracking) schemas,
   so migrations are already recorded — the app's pre-deploy `db:migrate` is a
   no-op against a restored DB. (If restoring into a DB that already has schema,
   wipe first: `psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;"` — restoring over
   existing objects errors on duplicates.)
4. **Point R2 at the restored images.** Set the R2 env vars to the bucket that
   holds the images (image _rows_ are in the DB dump; the image _bytes_ live in
   R2 and aren't in the dump). If R2 itself was lost, restore it from the
   `rclone` copy first (or re-upload the source images if no copy exists yet).
5. **Verify.** Hit `/api/health` (expect `200 {"status":"ok"}`), sign in, open a
   restored issue, confirm images load. Spot-check row counts against the source
   (`select count(*) from users/issues/images`).

**Local exercise performed (2026-07):** dumped the dev DB
(`pg_dump -Fc`), dropped both schemas, restored with `pg_restore`, and confirmed
identical row counts (users 2, issues 11, images 8, migrations 2) and that the
two seed users survived with correct `is_admin`/`subscribed` flags. The dev
server then booted against the restored DB and `/api/health` returned `200`. A
first restore against `public` only surfaced expected duplicate errors from the
untouched `drizzle` schema — hence step 3's note to wipe both, or restore into a
truly empty DB (the real-Railway case, which has no such conflict).

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
