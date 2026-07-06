# CLAUDE.md

Members-only digital magazine for a club. Next.js (App Router) + Postgres + Cloudflare R2,
hosted on Railway. Admin authors page-based issues; members read a flipbook (desktop) or
scroll (mobile). Magic-link auth.

## Read before working

Core docs (long-lived — keep current):

- `docs/architecture.md` — system overview, directory map, data flow, routes, env.
- `docs/database.md` — schema, the content/block model, migrations, seeding.
- `docs/design-principles.md` — **engineering + design rules. Follow these on every change.**

- `docs/ROADMAP.md` — phase ordering, product decisions, open questions.
- `docs/infrastructure.md` — hosting components, setup order, costs (the "landlord" runbook).

## Workflow

Work is tracked as **GitHub issues** — one issue per task, small papercuts batched in a
grab-bag issue. The issue brief gives intent + acceptance criteria; the current code is the
source of truth for the _how_. Branch per issue; keep PRs reviewable. **`docs/workflow.md`
is the process doc**: triage/model-routing labels, the subagent-per-issue loop, the
orchestrator review pass, and the required gates per change type (browser pass, contrast
gate, `RENDER_VERSION`, …). Read it before working an issue.

Commit/PR titles follow conventional-commit style (`feat:`, `fix:`, `docs:`, `release:` …) —
a convention, not strictly enforced.

**Releasing to prod:** `main` is integration (auto-deploys the demo/staging site); the
members' site has **no branch of its own** — it deploys from a `v*` git **tag**. Ship by
publishing a GitHub Release (or `git tag vYYYY.MM.DD && git push origin <tag>`), which
fires the `Deploy to production` Action. See `docs/infrastructure.md#release-workflow`.

## Commands

- `docker compose up -d` — local Postgres
- `npm run dev` — local dev server
- `npm run db:generate` / `db:migrate` / `db:seed` / `db:studio` — Drizzle workflow: migrations are committed in `drizzle/` and run on deploy (`db:push` is a local iteration convenience only; see `docs/database.md`)
- `npm run db:admin -- you@example.com` — create/promote an admin user (first-run bootstrap; idempotent)
- `npm run lint` / `npm run format` — lint / format

## Status

Everything below is real and wired end-to-end — **nothing is stubbed.** Routes + directory
map in `docs/architecture.md`; phase plan in `docs/ROADMAP.md`.

- **Content** — library, reader, dashboard, editor are DB-backed (editor autosaves; reader renders saved issues).
- **Images** — editor uploads (WebP via sharp), served from R2 when configured, else a local-disk fallback (`.data/uploads`) so it works with no cloud setup.
- **Auth** — magic-link (Auth.js v5, ~90-day DB sessions), members-only. Library/reader need a member session (signed-out → `/signin` with a validated `?next=`); `/admin`, server actions and uploads need `is_admin` (`npm run db:admin` bootstraps one). Dev logs the link to the console (no Resend needed).
- **Members** — admin manages the `users` table (add / remove / toggle subscribed / toggle admin / CSV import) with guard rails (no self-removal, always ≥1 admin).
- **Sponsors** (content v2) — `sponsors` table + `/admin/sponsors` (logo upload, link, `activeUntil` w/ expired flag); sponsor blocks reference a managed sponsor via the editor picker (manual entry retained as the v1 fallback; v1 inline blocks still render).
- **Publish email** — publishing can email each subscribed member a personal magic link that opens the issue (the email _is_ the sign-in link; skippable, off by default on re-publish), with a signed one-click `/unsubscribe` (no session). Dev logs blast + unsubscribe links.
- **PDF export** — members-only `GET /api/issues/[number]/pdf`, prints fixed-canvas pages to a paginated PDF via headless Chromium (Playwright), cached in R2 by issue id + revision. Server-only and off the request path via a token-guarded print route; needs Chromium in the deploy container (`docs/infrastructure.md`).

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Drizzle ORM (Postgres) ·
Auth.js (magic link) · Resend (email) · R2 via AWS S3 SDK · sharp (WebP) ·
custom CSS-transform flipbook (`reader-spread.tsx`) · Playwright (on-demand PDF).

## Non-negotiables

- Keep files under 500 lines; see `docs/design-principles.md` for the full rule set.
- Server Components by default; `"use client"` only when needed.
- Validate all external input with zod; never expose secrets to the client.
- Build for an older, phone-heavy, accessibility-sensitive audience.
