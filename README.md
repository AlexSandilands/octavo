# Digital Magazine

A members-only digital magazine for a club. Admin authors page-based issues; members read a
flipbook on desktop or a clean scroll on mobile. Magic-link access, no passwords.

## Docs

- [Architecture](docs/architecture.md) — system overview, directory map, data flow, routes.
- [Database](docs/database.md) — schema, content/block model, migrations, seeding.
- [Design principles](docs/design-principles.md) — engineering + design rules (read first).
- `docs/planning/` — transient background (spec, design handover, infra notes, implementation plan).

## Getting started

```bash
npm install
docker compose up -d   # local Postgres (see docker-compose.yml)
npm run db:migrate     # apply schema
npm run db:seed        # wipe + load 10 sample issues (with images) for the reader
npm run dev            # http://localhost:3000
```

Branding + `DATABASE_URL` live in `.env.local` (git-ignored). See `.env.example`
for all keys and `docs/INFRASTRUCTURE.md` for production setup.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM (Postgres) ·
Auth.js (magic link) · Resend · Cloudflare R2 · sharp · StPageFlip · Playwright.
Hosted on Railway. See [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md).
