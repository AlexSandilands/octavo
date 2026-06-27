# Database

Postgres, accessed through [Drizzle ORM](https://orm.drizzle.team). Schema lives in
[`src/db/schema.ts`](../src/db/schema.ts); the client in [`src/db/index.ts`](../src/db/index.ts).

## Local setup

```bash
docker compose up -d   # Postgres on localhost:5432 (see docker-compose.yml)
npm run db:migrate     # apply migrations in drizzle/
npm run db:seed        # sample issue so the reader has content
```

`DATABASE_URL` lives in `.env.local`. Next.js auto-loads it; `drizzle-kit` and the seed do not, so
both `drizzle.config.ts` and `src/db/seed.ts` call `process.loadEnvFile(".env.local")` themselves.

> If another Postgres already holds `5432`, map this project to a different host port in
> `docker-compose.yml` (e.g. `5433:5432`) and update `DATABASE_URL` to match.

## Tables

| Table                             | Purpose                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issues`                          | One row per edition. Holds `content` (the pages→blocks JSON), `number`, `title`, `theme`, `status` (`draft`/`published`), `publishedAt`, timestamps. |
| `images`                          | Uploaded image metadata (R2 key, dimensions). _Used once the image pipeline lands._                                                                  |
| `users`                           | Member record — doubles as the auth user (`isAdmin`, `subscribed`). _Used once auth lands._                                                          |
| `sessions`, `verification_tokens` | Auth.js tables. _Used once auth lands._                                                                                                              |

Issues are keyed by `id` (internal) but addressed publicly by `number` (e.g. `/read/14`).

## The content model

The whole pages→blocks tree is stored as **one JSONB document** in `issues.content`, typed as
`IssueContent`:

```ts
IssueContent = { pages: { id, cover?, blocks: Block[] }[] }
Block = Heading | Text | Image | Sponsor   // discriminated union on `type`
```

Defined as zod schemas + inferred types in [`src/lib/blocks.ts`](../src/lib/blocks.ts) and applied to
the column via `jsonb(...).$type<IssueContent>()`.

A page may set `cover: true` — it then renders through the dedicated cover
treatment (vertically centred, oversized hero type) in both readers and the
editor, rather than the normal flow. A `Text` block carries an optional `size`
(`s|m|l|xl`); since the page is a **fixed design canvas** that scales as a whole
(see below), that size is absolute px on desktop/print and a relative multiplier
in the reflowing mobile reader. Both fields are optional, so older content
parses unchanged.

**Pages are a fixed canvas (`PAGE_W`×`PAGE_H` in `page-frame.tsx`).** The desktop
reader and editor never resize the page or its type independently — they render
at the canvas size and apply a single `transform: scale()` (via `ScaledPage`) so
text, images and spacing always keep their proportions. Page count is therefore
viewport-independent (faithful flipbook spreads + deterministic PDF). The mobile
reader instead reflows into one column with its own A−/A+ control.

**Why one JSONB document, not normalised `pages`/`blocks` tables:** it matches "blocks JSON is the
source of truth", makes a save a single atomic write, and renders trivially. We don't need to query
individual blocks in SQL. Trade-off accepted.

## Data access

All reads/writes go through [`src/server/issues.ts`](../src/server/issues.ts) (`server-only`):
`listIssues`, `getIssue`, `getPublishedIssueByNumber`, `createIssue`, `updateIssueContent`,
`updateIssueMeta`, `publishIssue`, `deleteIssue`. Components call these — never Drizzle directly.
Mutations are invoked via Server Actions in `src/app/admin/actions.ts`, which zod-validate input.

## Changing the schema

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` — writes a new SQL migration to `drizzle/` (no DB needed).
3. `npm run db:migrate` — applies it. (`npm run db:push` skips migration files for quick local
   iteration; `npm run db:studio` opens a browser DB UI.)
4. Commit the generated migration file.

## Changing the content model

The block shapes are validated by zod in `src/lib/blocks.ts`. When you add/rename a block field:

- Update the zod schema (and `makeBlock`).
- Existing rows hold old-shaped JSON — give new fields safe defaults (`.default(...)`/`.optional()`)
  so old content still parses, or write a one-off migration that rewrites `issues.content`.
- Because `content` is opaque JSONB to Postgres, the database won't enforce this — zod is the guard.
