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

Work is tracked as **GitHub issues** — one milestone per roadmap phase, one issue per task.
Before starting an issue, read its milestone context in `docs/ROADMAP.md`; the issue brief
gives intent + acceptance criteria, the current code is the source of truth for the _how_.
Branch per issue; keep PRs reviewable.

## Commands

- `docker compose up -d` — local Postgres
- `npm run dev` — local dev server
- `npm run db:generate` / `db:migrate` / `db:seed` / `db:studio` — Drizzle workflow: migrations are committed in `drizzle/` and run on deploy (`db:push` is a local iteration convenience only; see `docs/database.md`)
- `npm run db:admin -- you@example.com` — create/promote an admin user (first-run bootstrap; idempotent)
- `npm run lint` / `npm run format` — lint / format

## Status

Library, reader, dashboard and editor are **DB-backed** (editor autosaves; reader renders saved
issues). Images are **real**: the editor uploads (WebP via sharp) and the reader serves them — to R2
when configured, otherwise a local-disk fallback (`.data/uploads`) so it works with no cloud setup.
Auth is **real** and everything is gated: magic-link sign-in (Auth.js v5, database sessions ~90
days, members-only); the library/reader require a member session (signed-out visitors are sent to
`/signin` with a validated `?next=` return path); `/admin`, all server actions and the upload route
require `is_admin` (`npm run db:admin` bootstraps one). In dev the magic link is logged to the
console, so no Resend account is needed. **Publishing an issue can email every subscribed member a
personal magic link that opens the new issue** (the email _is_ the sign-in link; skippable per
publish, defaults off on re-publish), each with a signed one-click unsubscribe (`/unsubscribe`, no
session). Dev logs the blast + unsubscribe links to the console too. Still stubbed: PDF and
members/sponsors persistence.
Routes + directory map are in `docs/architecture.md`; phase plan in `docs/ROADMAP.md`.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Drizzle ORM (Postgres) ·
Auth.js (magic link) · Resend (email) · R2 via AWS S3 SDK · sharp (WebP) ·
StPageFlip (flipbook) · Playwright (on-demand PDF).

## Non-negotiables

- Keep files under 500 lines; see `docs/design-principles.md` for the full rule set.
- Server Components by default; `"use client"` only when needed.
- Validate all external input with zod; never expose secrets to the client.
- Build for an older, phone-heavy, accessibility-sensitive audience.
