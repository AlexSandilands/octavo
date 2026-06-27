# Digital Magazine

A members-only digital magazine for a club. Admin authors page-based issues; members read a
flipbook on desktop or a clean scroll on mobile. Magic-link access, no passwords.

## Docs

- [Product spec](docs/SPEC.md) — what it is, data model, roadmap.
- [Design principles](docs/design-principles.md) — engineering + design rules (read first).
- [Design handover](docs/DESIGN_HANDOVER.md) — UI surfaces + visual direction.
- [Infrastructure](docs/INFRASTRUCTURE.md) — services, setup, env vars, costs.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in (see docs/INFRASTRUCTURE.md)
npm run db:push        # apply schema to your Postgres
npm run dev
```

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM (Postgres) ·
Auth.js (magic link) · Resend · Cloudflare R2 · sharp · StPageFlip · Playwright.
Hosted on Railway. See [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md).
