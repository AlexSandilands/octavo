# CLAUDE.md

Members-only digital magazine for a club. Next.js (App Router) + Postgres + Cloudflare R2,
hosted on Railway. Admin authors page-based issues; members read a flipbook (desktop) or
scroll (mobile). Magic-link auth.

## Read before working

- `docs/design-principles.md` — **engineering + design rules. Follow these on every change.**
- `docs/SPEC.md` — product spec, data model, roadmap.
- `docs/INFRASTRUCTURE.md` — services, setup, env vars, costs.
- `docs/DESIGN_HANDOVER.md` — UI surfaces and visual direction.

## Commands

- `npm run dev` — local dev server
- `npm run lint` / `npm run format` — lint / format
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` — Drizzle

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Drizzle ORM (Postgres) ·
Auth.js (magic link) · Resend (email) · R2 via AWS S3 SDK · sharp (WebP) ·
StPageFlip (flipbook) · Playwright (on-demand PDF).

## Non-negotiables

- Keep files under 500 lines; see `docs/design-principles.md` for the full rule set.
- Server Components by default; `"use client"` only when needed.
- Validate all external input with zod; never expose secrets to the client.
- Build for an older, phone-heavy, accessibility-sensitive audience.
