# Database

Postgres, accessed through [Drizzle ORM](https://orm.drizzle.team). Schema lives in
[`src/db/schema.ts`](../src/db/schema.ts); the client in [`src/db/index.ts`](../src/db/index.ts).

## Local setup

```bash
docker compose up -d   # Postgres on localhost:5432 (see docker-compose.yml)
npm run db:push        # sync schema.ts straight into the DB (dev workflow — no migration files)
npm run db:seed        # wipe + load 6 sample issues (with images) for the reader
```

The seed **wipes all issues and images**. It refuses to run when `NODE_ENV=production` or when
the database already holds published issues; pass `--force` (`npm run db:seed -- --force`) to
override once you're sure.

The seed is **fully self-contained** (issue #58): every image is placeholder art generated at
seed time — SVG specs in `src/db/seed/images.ts` + `art.ts`, rasterized with sharp through the
same WebP pipeline the editor applies to uploads — so there are no image binaries in the repo.
The bytes are stored where the app's storage facade would store them: **Cloudflare R2 when the
`R2_*` env vars are set** (e.g. the demo Railway project), the local-disk fallback
(`.data/uploads`) otherwise. A partial R2 config makes the seed refuse rather than guess. The
six issues are deliberately distinct magazine archetypes across both layout themes, and
together exercise every block type, heading level, text size and image layout the readers
support (see `src/db/seed-data.ts`).

`DATABASE_URL` lives in `.env.local`. Next.js auto-loads it; `drizzle-kit` and the seed do not, so
both `drizzle.config.ts` and `src/db/seed.ts` call `process.loadEnvFile(".env.local")` themselves.

> If another Postgres already holds `5432`, map this project to a different host port in
> `docker-compose.yml` (e.g. `5433:5432`) and update `DATABASE_URL` to match.

## Tables

| Table                             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issues`                          | One row per edition. Holds `content` (the pages→blocks JSON), `number` (unique — it's the public address), `title`, `theme`, `logoId` (nullable →`logos`, issue #97: the mark drawn in the running page footer; null = the text-only footer), `status` (`draft`/`published`), `revision` (bumped on every content write; autosaves send the revision they were based on so stale saves conflict instead of clobbering), `publishedAt`, timestamps. Also `footerMarkSize`/`footerTextSize` (issue #128) — the issue's **footer reserve**: the footer sizes its pages were laid out against. NOT NULL, defaulted to the shipped `medium`/`medium` (a missing value fails safe — too short, never too tall); `createIssue` sets them from the settings in force, and the `add-issue-footer-reserve` migration backfilled every pre-existing row from the settings row. Renderers clamp the global footer to these (`settingsForIssue`) so a later, taller footer can't print over a page that was already full; the editor's "Use the new footer" action (`adoptFooterAction`) is the only thing that raises them. |
| `images`                          | Uploaded image metadata: `key` (the storage key — R2 when the `R2_*` vars are set, the local-disk fallback otherwise), `width`/`height`, `issueId` (nullable →`issues`, set-null so a deleted issue doesn't take its images' rows with it), `createdAt`. Every upload writes one (`POST /api/admin/images`: sniff → sharp WebP → storage → row); `sponsors.logoId` and `logos.imageId` both point here. Accessed via `src/server/images.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `sponsors`                        | Managed sponsors (content v2): `name`, `href` (nullable), `logoId` (→`images`, set-null on image delete), `activeUntil` (nullable expiry — advisory only, flags the admin list; never auto-removes a sponsor from an issue), `createdAt`. Sponsor blocks reference a row by id (see the content model). Accessed via `src/server/sponsors.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `logos`                           | The club's own logo marks (issue #92): `name`, `imageId` (→`images`, notNull, cascade on image delete — a logo _is_ its mark), `createdAt`. Managed at `/admin/magazine` through the same sharp→WebP→storage pipeline as every other upload, which preserves transparency. Deleting one is refused while it is referenced — the referencing sites are registered in `REFERENCE_COUNTERS` (`src/server/logos.ts`); `issues.logoId` is the first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `settings`                        | The one row of owner-editable magazine settings (issue #105): `magazineName`, `orgName`, `tagline`, `footerMarkSize`/`footerTextSize` (`small`/`medium`/`large`), `footerAlign` (`left`/`center`/`right`), `updatedAt`. A singleton — `id` is fixed at 1 by a `CHECK (id = 1)` and written by upsert, so a second row cannot exist. **Every value column is nullable and NULL means "use the deployment default"** (the `NEXT_PUBLIC_*` branding vars / the shipped footer look), which is what lets an untouched deployment render exactly as it did before the table existed. The appearance columns are plain text validated in the app (zod, against the unions in `src/lib/branding.ts`) rather than pgEnums, so the sets can grow without a migration. Accessed via `src/server/settings.ts`.                                                                                                                                                                                                                                                                                                             |
| `users`                           | The live member list — membership _is_ presence here; nobody self-registers. Doubles as the Auth.js user: `email` (unique — the identity), `name`, `emailVerified`, `isAdmin` (gates `/admin`, every server action and uploads), `subscribed` (who the publish blast mails; cleared by `/unsubscribe`), `createdAt`. Managed at `/admin/members`; accessed via `src/server/users.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `sessions`, `verification_tokens` | Auth.js tables, behind the hand-rolled adapter in `src/server/auth-adapter.ts`. `sessions` is every signed-in member's database session (~90-day `expires`, cascade-deleted with the user, indexed by `user_id`); `verification_tokens` holds the single-use magic links — both the sign-in email's and the per-member ones the publish blast mints — keyed `(identifier, token)` and deleted on first use.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Issues are keyed by `id` (internal) but addressed publicly by `number` (e.g. `/read/14`);
`/read` serves **published issues only** (drafts preview via `/admin/issues/[id]/preview`).
All timestamps are `timestamptz`. `number` is allocated inside the INSERT (unique-constraint
backstop with retry) so concurrent creates can't collide.

## The content model

The whole pages→blocks tree is stored as **one JSONB document** in `issues.content`, typed as
`IssueContent`:

```ts
IssueContent = { version, pages: { id, cover?, blocks: Block[] }[] }
Block = Heading | Text | Image | Montage | Sponsor   // discriminated union on `type`
```

`version` marks which shape of the content model a document holds, so block-shape changes can
migrate old rows deliberately. **Current version: 4.** Every string field is length-capped and the
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

**Content v4 (issue #95) — the `montage` block.** An ordered list of slides (`items: { imageId,
alt }[]`) that cross-fade on a timer in the readers, carrying the image block's `caption`/`align`/
`width` so it occupies a photo slot with identical flow rules (`blockFlowStyle` treats the two as
one "picture block"). `interval` is whole seconds between fades, with `0` (`MONTAGE_MANUAL`) meaning
"manual only — arrows, no autoplay"; the editor offers a preset list, the schema accepts the whole
`0…MONTAGE_INTERVAL_MAX` range so changing the presets can never invalidate stored content. The
slide list is capped at `MAX_MONTAGE_IMAGES`.

Where it animates is a **render-path** decision, not a content one: `BlockView` takes an
`interactive` flag that only the two readers set. With it, the block mounts the client
`MontagePlayer` (cross-fade, prev/next, position indicator, autoplay that pauses off-screen, on
interaction and under `prefers-reduced-motion`); without it — the print/PDF document, the editor
canvas, the library cover thumbnail — it renders `MontageStill`, its **first slide only**, with no
timer and no client JS. That is what makes the PDF deterministic, and why `RENDER_VERSION` in the
PDF route was bumped alongside this.

**Content v5 (issue #161) — the `video` block.** A YouTube video, carrying the image block's
`caption`/`align`/`width` (so it is a "picture block" to `blockFlowStyle` like a montage is) in a box
that is always 16:9. What is stored is the **extracted video id** (`videoId`, 11 characters of the
URL-safe base64 alphabet, regex-validated in the schema), never the pasted URL: the editor parses the
link at the boundary (`src/lib/youtube.ts`, shared with the server) and everything downstream — the
embed src, the poster fetch, the printed address — is composed from a hardcoded template with that id
in it. A link that doesn't parse is refused in the editor with a readable message and never reaches
the document. `provider` is stored (`"youtube"` today) so a second service later is a widened enum
rather than a migration.

The **poster frame is ours**: on applying a link the editor calls `POST /api/admin/video-poster`,
which fetches `i.ytimg.com/vi/<id>/maxresdefault.jpg` (falling back to `hqdefault.jpg`, which every
video has) and puts the bytes through the ordinary upload pipeline — `processImage` → `putObject` →
`createImageRecord` — so `posterImageId` is an `images` row indistinguishable from an upload. That is
why the readers hit no Google origin until someone presses play, and why the poster prints at all.
The trade, decided in the issue thread: a poster goes stale if the uploader changes their thumbnail,
and re-pasting the link refreshes it. `collectImageIds` resolves `posterImageId` alongside image and
montage ids — it is the single traversal feeding the `ImageMap`, so a poster missed there would be
missing on every surface at once.

Where it plays is again a **render-path** decision: with `interactive`, the block mounts the client
`VideoPlayer` — a facade showing the poster and one large play button, which injects a
`youtube-nocookie.com` iframe only on activation (never autoplaying on load, and moving focus into
the frame so the keyboard isn't dropped). Without it — print/PDF, the editor canvas, the library
thumbnail — it renders `VideoStill`: the poster, a play mark, and the address as visible text
(`youtu.be/<id>`, a real link on the print page so Chromium emits a PDF link annotation). A PDF
cannot play video, so that pair is its deterministic single representation, the same call the montage
makes by printing only its first slide — and the same reason `RENDER_VERSION` was bumped with it. The
embed is also the one thing the CSP's `frame-src` allows (`src/middleware.ts`).

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

### The v4 bump (issue #95) — a new block type, purely additive

Adding a member to the block union is the cheapest kind of bump: a version-1…3 document contains no
montage blocks, so it parses and renders **byte-for-byte unchanged**, and no stored row is rewritten
or migrated. `CONTENT_VERSION` moves to `4`; new documents and any resave stamp it. There is no
one-off migration and none is needed — nothing about the older shapes changed meaning.

The seed authors the new shape rather than leaning on the fallback (issue-02, the camera-club
quarterly, carries a three-slide montage with per-slide alt text), and issue-05's deliberately
legacy-shaped page stays exactly as it was.

### The v5 bump (issue #161) — a new block type, purely additive

The same cheap kind of bump, on the same terms: a version-1…4 document contains no video blocks, so
it parses and renders **byte-for-byte unchanged**, gains none of v5's fields, and no stored row is
rewritten or migrated. `CONTENT_VERSION` moves to `5`; new documents and any resave stamp it. There
is no one-off migration and none is needed.

The seed authors the new shape (issue-01, the pétanque quarterly, carries a video with a caption and
a stored poster) and stays self-contained: the video id is a plausible fake and the poster is
generated art from the `SEED_IMAGES` manifest — the seed never reaches the network, so it never
fetches a real thumbnail.

`scripts/dev-video-gate.mts` checks all of it in memory (link forms accepted and refused, the seed's
shape, the poster reaching `collectImageIds`, a malformed id rejected by the schema, and a v4
document surviving untouched) — **run that, never `npm run db:seed`**, which wipes every authored
issue.

### A version bump includes updating the seed

The seed (`src/db/seed/`) is not just fixture data — it is the primary render path a fresh
environment exercises. So a content-model version bump is not done until the seed **authors content
in the new shape**, not the old one relying on the compatibility fallback. Concretely (issue #36):
the `T()` builder emits v3 rich-text docs via `stringToDoc`, so a freshly seeded database renders
through the same path as real edited content. Keep **one deliberately legacy-shaped page** — a plain
string (`Traw`) and a constrained-HTML string (`Thtml`) — so the permanent v1/v2 render fallback and
the migration converter stay under ambient coverage. When you bump `CONTENT_VERSION` again, do the
same: update the builders to author the new shape, and leave a small, commented legacy fixture behind.
