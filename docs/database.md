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
| `sponsors`                        | Managed sponsors (content v2): `name`, `href` (nullable), `logoId` (→`images`, set-null on image delete), `activeUntil` (nullable expiry — advisory only, flags the admin list; never auto-removes a sponsor from an issue), `createdAt`. Sponsor blocks reference a row by id (see the content model). Accessed via `src/server/sponsors.ts`. |
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

`version` marks which shape of the content model a document holds, so block-shape changes can
migrate old rows deliberately. **Current version: 3.** Every string field is length-capped and the
page/block arrays bounded in the zod schemas, so a bad save can't persist an unbounded document.

**Content v2 (issue #8) — sponsor blocks reference the `sponsors` table.** A sponsor block now
carries an optional `sponsorId`; the reader/editor resolve the referenced sponsor's live
name/href/logo at render time (`resolveIssueSponsors` in `src/server/sponsors.ts`, mirroring how
images resolve). The version-1 inline fields (`name`/`href`/`logoId`) are **retained** on the block
as the fallback for legacy documents and for the editor's manual-entry mode.

**Content v3 (issue #13) — body text is structured rich-text JSON, not an HTML string.** A text
block's `text` was a constrained-HTML string that the readers ran through a regex sanitiser and fed
to `dangerouslySetInnerHTML`. It is now the Tiptap document JSON the editor produces
(`editor.getJSON()`) — `doc → paragraph / bullet+ordered lists → listItem → text` runs carrying
bold/italic/underline/strike/link marks — validated by a bounded, depth-capped zod schema
([`src/lib/rich-text-doc.ts`](../src/lib/rich-text-doc.ts)) and **rendered through React elements**
([`src/features/blocks/rich-text.tsx`](../src/features/blocks/rich-text.tsx)). This removes
`dangerouslySetInnerHTML` and the HTML sanitiser from the read path: text is escaped by
construction, only a fixed themed tag set is emitted, and link hrefs are re-validated through
`externalHref` (an unsafe one renders inert). Link marks are normalised to `{ href }` on save.
The bump is backward-compatible: `text` accepts a **string** (v1/v2, plain or constrained HTML) or a
**doc**, and a legacy string renders through the same React path via `stringToDoc`. Cover-page text
blocks stay plain strings (authored as a tagline, rendered as text — `richTextToPlain` coerces).

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

### The version bump, by example (v1 → v2, issue #8)

This is the template for every content-model version bump. The v2 change — sponsor blocks gaining
`sponsorId` — was done as a **backward-compatible, non-destructive** bump. Follow this shape when
the change can be made additive:

1. **Add the new field as optional; keep the old fields.** `sponsorId` is `.optional()`, and the
   version-1 inline fields (`name`/`href`/`logoId`) stay on the schema. A version-1 document, which
   has the inline fields and no `sponsorId`, therefore still parses **and renders** — the renderers
   fall back to the inline fields when `sponsorId` is absent (see the sponsor case in
   `BlockView`/`MobileBlock`). Nothing forces a rewrite.
2. **Bump `CONTENT_VERSION`** (to `2`). New documents and any resave stamp the new version. The zod
   `version` field keeps `.min(1)`, so old rows validate. **No SQL migration touches `issues.content`.**
3. **Upgrade happens lazily and safely.** A legacy issue is upgraded to v2 in place the next time
   it's saved through the editor (the schema `.default`s the version); because the v2 schema still
   accepts the v1 inline shape, that resave is a no-op for the sponsor blocks.
4. **Deletion / dangling references** are handled at render, not by cascade: a `sponsorId` pointing
   at a now-deleted sponsor resolves to nothing, and the reader **hides that slot** (a removed
   sponsor must not keep advertising). In the editor the block stays visible so the admin can re-pick.

**When a change can't be additive** (a field is removed or its meaning changes incompatibly), don't
force old rows through the new schema — write a **one-off migration** that reads every `issues.content`,
rewrites version-N documents to version-N+1 shape, and writes them back, keyed on the stored `version`.
Zod remains the guard; the JSONB column won't enforce any of this.

### The v3 bump (issue #13) — additive schema + optional one-off migration

The v3 change (body text: HTML string → rich-text JSON) is **additive at the schema level**: `text`
became a `string | RichDoc` union, so every old row still validates and renders (legacy strings go
through `stringToDoc` at render time). No rewrite is _required_.

It also ships an **optional one-off migration** — `npm run db:migrate-content` (dry run) /
`-- --write` (apply) — that rewrites stored body-text strings to doc JSON in place so the data is
uniformly v3 and the per-render string conversion drops out. It is:

- **idempotent** — a text block already holding a doc (and, by design, cover-page taglines, which
  stay plain strings) is skipped;
- **safe** — each converted document is re-validated through `issueContentSchema` before it is
  written (the same guard the editor's save path runs), and the migration aborts if any row fails;
- **render-preserving** — the converter (`stringToDoc`) is exactly what the reader applies to a
  legacy string, so a converted issue renders byte-for-byte identically (verified before/after).

Run it once after deploying v3 (against dev/prod as needed); Railway does not run it automatically
(it is content, not schema — no Drizzle migration file).
