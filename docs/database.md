# Database

Postgres, accessed through [Drizzle ORM](https://orm.drizzle.team). Schema lives in
[`src/db/schema.ts`](../src/db/schema.ts); the client in [`src/db/index.ts`](../src/db/index.ts).

## Local setup

```bash
docker compose up -d   # Postgres on localhost:5432 (see docker-compose.yml)
npm run db:push        # sync schema.ts straight into the DB (dev workflow — no migration files)
npm run db:seed        # wipe + load 10 sample issues (with images) for the reader
```

The seed **wipes all issues and images**. It refuses to run when `NODE_ENV=production` or when
the database already holds published issues; pass `--force` (`npm run db:seed -- --force`) to
override once you're sure.

`DATABASE_URL` lives in `.env.local`. Next.js auto-loads it; `drizzle-kit` and the seed do not, so
both `drizzle.config.ts` and `src/db/seed.ts` call `process.loadEnvFile(".env.local")` themselves.

> If another Postgres already holds `5432`, map this project to a different host port in
> `docker-compose.yml` (e.g. `5433:5432`) and update `DATABASE_URL` to match.

## Tables

| Table                             | Purpose                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issues`                          | One row per edition. Holds `content` (the pages→blocks JSON), `number` (unique — it's the public address), `title`, `theme`, `status` (`draft`/`published`), `revision` (bumped on every content write; autosaves send the revision they were based on so stale saves conflict instead of clobbering), `publishedAt`, timestamps. |
| `images`                          | Uploaded image metadata (R2 key, dimensions). _Used once the image pipeline lands._                                                                                                                                                                                                                                               |
| `users`                           | Member record — doubles as the auth user (`isAdmin`, `subscribed`). _Used once auth lands._                                                                                                                                                                                                                                       |
| `sessions`, `verification_tokens` | Auth.js tables. _Used once auth lands._                                                                                                                                                                                                                                                                                           |

Issues are keyed by `id` (internal) but addressed publicly by `number` (e.g. `/read/14`);
`/read` serves **published issues only** (drafts preview via `/admin/issues/[id]/preview`).
All timestamps are `timestamptz`. `number` is allocated inside the INSERT (unique-constraint
backstop with retry) so concurrent creates can't collide.

## The content model

The whole pages→blocks tree is stored as **one JSONB document** in `issues.content`, typed as
`IssueContent`:

```ts
IssueContent = { version, pages: { id, cover?, blocks: Block[] }[] }
Block = Heading | Text | Image | Sponsor   // discriminated union on `type`
```

`version` (defaults to 1 for all existing documents) marks which shape of the content model a
document holds, so future block-shape changes can migrate old rows deliberately. Every string
field is length-capped and the page/block arrays bounded in the zod schemas, so a bad save can't
persist an unbounded document.

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

**Versioned migrations are the source of truth** (cutover done — issue #1). The current
schema is captured as the committed `init` migration in `drizzle/`; Railway applies
pending migrations as a pre-deploy step (`npm run db:migrate` — see `railway.json` and
[infrastructure.md](infrastructure.md)). To change the schema:

1. Edit `src/db/schema.ts`.
2. `npm run db:generate -- --name <what-changed>` — writes a SQL migration to `drizzle/`.
3. Review the generated SQL, commit it alongside the schema change.
4. `npm run db:migrate` applies it locally; deploys apply it automatically.

**In development**, `npm run db:push` remains a convenience for iterating on a schema
change before generating the final migration (it diffs `schema.ts` straight against your
local DB). Never push against production, and always end an iteration by generating the
migration from a DB that matches the committed migrations — wipe and re-migrate
(`docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed`)
if unsure. (`npm run db:studio` opens a browser DB UI.)

## Changing the content model

The block shapes are validated by zod in `src/lib/blocks.ts`. When you add/rename a block field:

- Update the zod schema (and `makeBlock`).
- Existing rows hold old-shaped JSON — give new fields safe defaults (`.default(...)`/`.optional()`)
  so old content still parses, or write a one-off migration that rewrites `issues.content`.
- Because `content` is opaque JSONB to Postgres, the database won't enforce this — zod is the guard.
