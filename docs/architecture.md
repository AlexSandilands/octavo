# Architecture

A members-only digital magazine. An admin authors page-based issues; members read them as a
flipbook (desktop) or a single scroll (mobile). Magic-link access (auth not yet built).

This doc is the fast orientation for the codebase. For data specifics see
[database.md](database.md); for the rules every change follows see
[design-principles.md](design-principles.md).

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind v4 (tokens in `src/app/globals.css`) |
| Database | Postgres via Drizzle ORM |
| Object storage | Cloudflare R2 — images wired (WebP via sharp); local-disk fallback in dev; PDFs later |
| Auth | Auth.js magic link — *not wired yet* |
| Email | Resend — *not wired yet* |
| Hosting | Railway (app + Postgres) |

## Directory map

```
src/
  app/                 routes (App Router). Server components by default.
    page.tsx           library (published issues)
    signin/            magic-link entry (UI only)
    read/[issueId]/    reader — desktop flipbook + mobile scroll
    admin/             dashboard, members, sponsors
      actions.ts       server actions (mutations)
      issues/[id]/edit editor (standalone full-screen)
    api/admin/images/  image upload route handler (multipart → sharp → R2)
  components/          shared presentational UI (ui.tsx, icons.tsx, admin-shell, ...)
  features/            feature modules with their own UI/logic
    blocks/            BlockView — themed read-only block renderer
    editor/            the page-based editor (client) + per-block edit controls
    reader/            desktop-reader, mobile-reader (client)
    members/           members table (client)
  db/                  Drizzle schema, client, seed
  lib/                 framework-agnostic helpers
    blocks.ts          the canonical content model (zod + types)
    images.ts          ImageMap type + content imageId traversal
    storage.ts         storage facade: R2 if configured, else local disk
    r2.ts              R2/S3 client (server-only): upload, keyToUrl
    local-storage.ts   dev fallback: .data/uploads on the filesystem
    image-processing.ts sharp: normalise uploads to WebP
    site.ts            branding from NEXT_PUBLIC_* env
    env.ts             validated server env
    id.ts              id generator
  server/              server-only data access (issues.ts, images.ts)
```

## The content model (central concept)

An **issue** owns one JSON document (`content`) shaped as **pages → ordered blocks**. This is the
**source of truth**; the reader and editor both render from it, and the PDF (later) derives from it.
Block types: `heading | text | image | sponsor`. Defined once in
[`src/lib/blocks.ts`](../src/lib/blocks.ts) as zod schemas + inferred types, imported everywhere
(editor, reader, DB column type). See [database.md](database.md) for how it's stored.

## Data flow

```
Editor (client state)
  └─ debounced autosave ─▶ server action (app/admin/actions.ts, zod-validated)
                              └─▶ data layer (server/issues.ts) ─▶ Postgres (issues.content JSONB)

Reader / library / dashboard (server components)
  └─ data layer (server/issues.ts) ─▶ Postgres ─▶ rendered via shared block renderers
```

- **Server Components by default.** `"use client"` only for interactivity (editor, readers, members
  table). Keep client islands at the leaves.
- **All DB access goes through `src/server/issues.ts`** (marked `server-only`). Never query Drizzle
  from a component.
- **Mutations are Server Actions** in `src/app/admin/actions.ts`, validated with zod at the boundary
  so adding auth later is just a gate, not a rewrite.

## Routes

| Route | Render | Notes |
|---|---|---|
| `/` | dynamic | Library — published issues |
| `/read/[issueId]` | dynamic | Reader, by issue **number** |
| `/signin` | static | UI only (auth not built) |
| `/admin` | dynamic | Issue dashboard |
| `/admin/issues/[id]/edit` | dynamic | Editor, by issue **id** |
| `/admin/members`, `/admin/sponsors` | static | members = sample data; sponsors = placeholder |
| `POST /api/admin/images` | route handler | Upload: multipart → sharp WebP → storage → `images` row |
| `GET /api/images/[...key]` | route handler | Serves the local dev storage fallback (unused when R2 is set) |

DB-backed routes set `export const dynamic = "force-dynamic"` so they always read fresh and aren't
prerendered at build. **`/admin` is currently ungated** — auth is the next phase.

## Environment

Server env is validated in [`src/lib/env.ts`](../src/lib/env.ts); branding in
[`src/lib/site.ts`](../src/lib/site.ts). Local values live in `.env.local` (git-ignored); production
values are set in Railway. `.env.example` lists every key.

| Var | Required now | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection |
| `NEXT_PUBLIC_MAGAZINE_NAME` / `_ORG_NAME` / `_TAGLINE` | no (defaults) | Branding, build-time inlined |
| `AUTH_SECRET`, `R2_*`, `EMAIL_*` | no (optional) | Become required as auth/images/email land |

## What's real vs stubbed

Real: the editor authors and autosaves to the DB; the reader/library/dashboard render real data;
images upload to R2 and render in both editor and reader.
Stubbed/deferred: auth, email, PDF export, real page-curl, members/sponsors persistence. The full
sequence lives in `docs/planning/IMPLEMENTATION_PLAN.md` (transient).

## Docs

- [database.md](database.md) — schema, content model, migrations, seeding.
- [design-principles.md](design-principles.md) — engineering + design rules (read before changes).
- `planning/` — **transient** background (product spec, design handover, infra/cost notes,
  implementation plan). Will be removed once superseded; don't treat as current truth.
