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
- `npm run invoice -- invoices/<name>.yml` — client invoice PDF from a YAML config (local-only tool, data in git-ignored `invoices/`; see `docs/invoicing.md`)

## Status

Everything below is real and wired end-to-end — **nothing is stubbed.** Routes + directory
map in `docs/architecture.md`; phase plan in `docs/ROADMAP.md`.

- **Content** — library, reader, dashboard, editor are DB-backed (editor autosaves; reader renders saved issues).
- **Page overflow** — a block that outgrows its page is marked at the page's text limit in the editor, with one action beside it: body text splits at the last top-level node that fits (cascading onto as many pages as it needs), any other block moves whole onto the next page. Edit-time only — content never reflows at read time.
- **Images** — editor uploads (WebP via sharp), served from R2 when configured, else a local-disk fallback (`.data/uploads`) so it works with no cloud setup.
- **Auth** — magic-link (Auth.js v5, ~90-day DB sessions), members-only. Library/reader need a member session (signed-out → `/signin` with a validated `?next=`); `/admin`, server actions and uploads need `is_admin` (`npm run db:admin` bootstraps one). Dev logs the link to the console (no Resend needed).
- **Members** — admin manages the `users` table (add / remove / toggle subscribed / toggle admin / CSV import) with guard rails (no self-removal, always ≥1 admin); the list is paginated with server-side search and status filters (`?q=`/`?page=`/`?filter=` in the URL), and selections survive across pages, searches and filters. The CSV import validates row by row — invalid addresses are skipped and named in the result, never failing the batch — with the browser preview and the server sharing one address test (`src/lib/member-email.ts`) and one batch cap (`src/features/members/import-limit.ts`).
- **Sponsors** (content v2) — `sponsors` table + `/admin/sponsors` (logo upload, link, `activeUntil` w/ expired flag); sponsor blocks reference a managed sponsor via the editor picker (manual entry retained as the v1 fallback; v1 inline blocks still render).
- **Magazine details** — `settings` table (one row) + `/admin/magazine`: the owner edits the magazine name, club name and tagline, and the page footer's appearance (mark size, text size, alignment), with a live preview built from the real page components. Effective value = DB → `NEXT_PUBLIC_*` env → shipped default, resolved in `src/server/settings.ts`; the env vars are bootstrap defaults only, and a deployment that never opens the page renders exactly as before. No redeploy to change any of it.
- **Logos** — `logos` table + the logo library on `/admin/magazine` (`/admin/logos` redirects): the club's own marks (crest, fern, wordmark), uploaded through the shared image pipeline (transparency preserved), named, renamed and deleted. Deletion is refused while a logo is referenced.
- **Page footer** — an issue can carry a mark (`issues.logoId`, picked in the editor header). With one, every page's running footer sets the mark and the club name as one lockup at the footer's ordinary tracking, with the page number out at the opposite margin; the mobile reader (which has no pages) closes with the same lockup. Wording, mark size, type size and alignment all come from the magazine settings. With no logo the original text-only footer renders unchanged (taking only the type size). The footer's **height** is clamped per issue: each issue records the footer sizes its pages were laid out against (`issues.footerMarkSize`/`footerTextSize`), and every surface resolves `settingsForIssue()` — so a footer the owner later enlarges reaches the issues with room for it, never prints over an already-full page, and is adopted per issue in the editor where the overflow marker catches what no longer fits.
- **Publish email** — publishing can email each subscribed member a personal magic link that opens the issue (the email _is_ the sign-in link; skippable, off by default on re-publish), with a signed one-click `/unsubscribe` (no session). Dev logs blast + unsubscribe links.
- **PDF export** — members-only `GET /api/issues/[number]/pdf`, prints fixed-canvas pages to a paginated PDF via headless Chromium (Playwright), cached in R2 by issue id + revision. Server-only and off the request path via a token-guarded print route; needs Chromium in the deploy container (`docs/infrastructure.md`). The owner can switch downloads **off site-wide** from `/admin/magazine` (a `settings` column, same DB → env → default chain, no redeploy): the button isn't rendered anywhere and the route refuses with 403. The internal print route stays reachable — turning downloads off is a distribution choice, not a rendering one — and cached PDFs are neither deleted nor rebuilt, so switching back on restores them instantly.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Drizzle ORM (Postgres) ·
Auth.js (magic link) · Resend (email) · R2 via AWS S3 SDK · sharp (WebP) ·
custom CSS-transform flipbook (`reader-spread.tsx`) · Playwright (on-demand PDF).

## Non-negotiables

- Keep files under 500 lines; see `docs/design-principles.md` for the full rule set.
- Server Components by default; `"use client"` only when needed.
- Validate all external input with zod; never expose secrets to the client.
- Comments state a constraint the code can't show — 1–2 lines max, an issue ref over a retold story; the narrative belongs in the PR, not the file.
- Build for an older, phone-heavy, accessibility-sensitive audience.
