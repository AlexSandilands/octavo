# CLAUDE.md

Members-only digital magazine for a club. Next.js (App Router) + Postgres + Cloudflare R2,
hosted on Railway. Admin authors page-based issues; members read a flipbook (desktop) or
scroll (mobile). Magic-link auth.

## Read before working

Core docs (long-lived — keep current):

- `docs/architecture.md` — system overview, directory map, data flow, routes, env.
- `docs/database.md` — schema, the content/block model, migrations, seeding.
- `docs/design-principles.md` — **engineering + design rules. Follow these on every change.**

`docs/planning/` is **transient** background (product spec, design handover, infra/cost notes,
implementation plan) — useful history, not current truth; will be removed once superseded.

## Commands

- `docker compose up -d` — local Postgres
- `npm run dev` — local dev server
- `npm run db:push` / `db:seed` / `db:studio` — Drizzle dev workflow (`db:generate`/`db:migrate` reserved for pre-launch migrations; see `docs/database.md`)
- `npm run lint` / `npm run format` — lint / format

## Status

Library, reader, dashboard and editor are **DB-backed** (editor autosaves; reader renders saved
issues). Images are **real**: the editor uploads (WebP via sharp) and the reader serves them — to R2
when configured, otherwise a local-disk fallback (`.data/uploads`) so it works with no cloud setup.
Still stubbed: auth (`/admin` ungated), email, PDF, real page-curl, and members/sponsors
persistence. Routes + directory map are in `docs/architecture.md`.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Drizzle ORM (Postgres) ·
Auth.js (magic link) · Resend (email) · R2 via AWS S3 SDK · sharp (WebP) ·
StPageFlip (flipbook) · Playwright (on-demand PDF).

## Non-negotiables

- Keep files under 500 lines; see `docs/design-principles.md` for the full rule set.
- Server Components by default; `"use client"` only when needed.
- Validate all external input with zod; never expose secrets to the client.
- Build for an older, phone-heavy, accessibility-sensitive audience.
