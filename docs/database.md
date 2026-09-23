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

| Table                             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issues`                          | One row per edition. Holds `content` (the pages→blocks JSON), `number` (nullable — the public address, allocated at publish; see below), `title`, `theme`, `logoId` (nullable →`logos`, issue #97: the mark drawn in the running page footer; null = the text-only footer), `status` (`draft`/`published`), `revision` (bumped on every content write; autosaves send the revision they were based on so stale saves conflict instead of clobbering), `publishedAt`, timestamps. Also `footerMarkSize`/`footerTextSize` (issue #128) — the issue's **footer reserve**: the footer sizes its pages were laid out against, as whole px (issue #216; `integer`, formerly the names `small`/`medium`/`large`, which the `footer-sizes-px` migration mapped in place to the pixels they always rendered at — mark 18/27/36, type 9/10/12). NOT NULL, defaulted to the smallest preset (18/9 — a missing value fails safe: too short, never too tall); `createIssue` and the seed set them from the settings in force, and the `add-issue-footer-reserve` migration backfilled every pre-existing row from the settings row. Renderers clamp the global footer to these (`settingsForIssue`) so a later, taller footer can't print over a page that was already full; the editor's "Use the new footer" action (`adoptFooterAction`) is the only thing that raises them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `images`                          | Uploaded image metadata: `key` (the storage key — R2 when the `R2_*` vars are set, the local-disk fallback otherwise), `width`/`height`, `issueId` (nullable →`issues`, set-null so a deleted issue doesn't take its images' rows with it), `createdAt`. Every upload writes one (`POST /api/admin/images`: sniff → sharp WebP → storage → row), and so does an **issue-transfer import**, which is the one other writer — it stores the bundle's bytes untouched under `imports/<operationId>/<imageId>.webp` and records them here (see `docs/issue-transfer.md`). `sponsors.logoId`, `logos.imageId` and `member_names.avatarImageId` (a member's avatar, issue #299 — `issueId` null) all point here. Accessed via `src/server/images.ts`. Rows are removed only by the asset lifecycle below — `issueId` records which issue a file was uploaded **under**, never who shows it now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `sponsors`                        | Managed sponsors (content v2): `name`, `href` (nullable), `logoId` (→`images`, set-null on image delete), `activeUntil` (nullable expiry — advisory only, flags the admin list; never auto-removes a sponsor from an issue), `createdAt`. Sponsor blocks reference a row by id (see the content model). Accessed via `src/server/sponsors.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `logos`                           | The club's own logo marks (issue #92): `name`, `imageId` (→`images`, notNull, cascade on image delete — a logo _is_ its mark), `createdAt`. Managed at `/admin/magazine` through the same sharp→WebP→storage pipeline as every other upload, which preserves transparency. Deleting one is refused while it is referenced — the referencing sites are registered in `REFERENCE_COUNTERS` (`src/server/logos.ts`); `issues.logoId` is the first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `issue_imports`                   | One row per attempt to import a bundle (issue #293): `id` (the operation id the modal mints), `adminId` (→`users`, set null — removing an admin must not take with it the record that a prefix still needs sweeping), `status` (`started`/`committed`/`swept`), `result` (jsonb — what the import did), timestamps, indexed on `(status, created_at)`. It exists for two things nothing else needs: telling a **retry** after a lost response apart from a deliberate second import (the same id back returns the recorded result, never a second set of drafts), and **recovery** — every object an import writes goes under `imports/<id>/`, so that prefix _is_ the record of its intended keys, and a row still `started` an hour later has its prefix deleted and is marked `swept`. Accessed via `src/server/issue-transfer/operations.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `member_names`                    | The names an account posts under (issue #299): `userId` (→`users`, cascade), `name` (≤ 40, validated — see below), `nameKey` (the normalised form: NFKC, trimmed, inner whitespace collapsed, lower-cased), `avatarImageId` (→`images`, set null), `badge` (the admin badge — honoured only while the owner is an admin, joined at read time), `retiredAt` (nullable), `createdAt`. **Unique on `(user_id, name_key)` only** — two accounts may share a name, one account may not hold it twice; also indexed on `name_key` alone (the "another member uses this name" warning) and on `user_id`. At most five unretired names per account (module-enforced). Accessed via `src/server/member-names.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `comments`                        | An issue's discussion (issue #299): `issueId` (→`issues`, cascade), `authorId` (→`users`, set null — null renders "Former member"), `authorNameId` (→`member_names`, set null), `parentId` (→`comments`, cascade; one level of replies, a reply to a reply is refused by the module), `body` (plain text ≤ 2,000; blanked to `''` on a soft delete), `pageId` (nullable — the authored page's stable id, not its number, #304), `hiddenAt` (moderation, reversible), `deletedAt` (soft delete, kept as a stub while it has replies), `createdAt`, `editedAt`. Indexed on `(issue_id, created_at)`, `parent_id`, `author_id`, `author_name_id`. Accessed via `src/server/comments.ts` and `src/server/comment-moderation.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `comment_reports`                 | A member's report of a comment (issue #299): `commentId` (→`comments`, **set null** — the report outlives the comment), `issueId` (→`issues`, cascade), `reporterId`/`resolvedBy` (→`users`, set null), `reason` (`harassment`/`offensive`/`spam`/`other`, app-validated text), `note` (≤ 500), `status` (`open`/`resolved`), `resolvedAt`, `createdAt`, and a **snapshot** taken at report time — `snapshotBody`, `snapshotName`, `snapshotAuthorId` (→`users`, set null), `snapshotCreatedAt`, `snapshotEditedAt` — so an edit or delete by the author can't erase the evidence. Unique on `(comment_id, reporter_id)`. Accessed via `src/server/comment-moderation.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `notifications`                   | A reply to one of your comments (issue #299): `userId` (the recipient, →`users`, cascade), `commentId` (the reply, →`comments`, cascade), `readAt`, `createdAt`, indexed on `(user_id, read_at, created_at)`. The newest 100 per member are kept, trimmed on insert. Read by the library bell (#303). Accessed via `src/server/notifications.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `settings`                        | The one row of owner-editable magazine settings (issue #105): `magazineName`, `orgName`, `tagline`, `footerMarkSize`/`footerTextSize` (whole px — issue #216: `integer`, mark 12–48, type 8–16, with Small/Medium/Large presets at 18/27/36 and 9/10/12), `footerAlign` (`left`/`center`/`right`), `showRunningHead` (issue #269 — `show_running_head boolean`; whether a theme may print its textual running head — the magazine name and issue number — above the page content, shipped default **shown**), `pdfDownloads` (issue #162 — `pdf_downloads_enabled boolean`; whether members are offered the PDF download at all, shipped default **enabled**), `commentsEnabled` (issue #299 — `comments_enabled boolean`; the discussion switch, shipped default **off**, and off too when the row can't be read), `removedMemberComments` (issue #299 — `removed_member_comments text`, `delete`/`anonymise`; what removing a member does to their comments, shipped default **anonymise**), `updatedAt`. A singleton — `id` is fixed at 1 by a `CHECK (id = 1)` and written by upsert, so a second row cannot exist. **Every value column is nullable and NULL means "use the deployment default"** (the `NEXT_PUBLIC_*` branding vars / the shipped footer look / the running head shown / downloads on), which is what lets an untouched deployment render exactly as it did before the table existed — `show_running_head` and `pdf_downloads_enabled` are nullable with **no `DEFAULT true`** for that reason. The appearance columns are validated in the app (zod, against the size ranges and the alignment union in `src/lib/branding.ts`) rather than by the database — the alignment is plain text, not a pgEnum, so the set can grow without a migration; an out-of-range size on read degrades to the default. Accessed via `src/server/settings.ts`. |
| `users`                           | The live member list — membership _is_ presence here; nobody self-registers. Doubles as the Auth.js user: `email` (unique — the identity), `name` (the club's record of the member — never a posting name, see `member_names`), `emailVerified`, `isAdmin` (gates `/admin`, every server action and uploads), `subscribed` (who the publish blast mails; cleared by `/unsubscribe`), `replyEmails` (issue #299 — opt-in reply emails, default false; distinct from `subscribed`; cleared by the reply email's "Stop reply emails", #303), `createdAt`. Managed at `/admin/members`; accessed via `src/server/users.ts`, and removed via `src/server/member-removal.ts` (see the removal policy below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `sessions`, `verification_tokens` | Auth.js tables, behind the hand-rolled adapter in `src/server/auth-adapter.ts`. `sessions` is every signed-in member's database session (~90-day `expires`, cascade-deleted with the user, indexed by `user_id`); `verification_tokens` holds the single-use magic links — both the sign-in email's and the per-member ones the publish blast mints — keyed `(identifier, token)` and deleted on first use.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Issues are keyed by `id` (internal) but addressed publicly by `number` (e.g. `/read/14`);
`/read` serves **published issues only** (drafts preview via `/admin/issues/[id]/preview`).
All timestamps are `timestamptz`.

**`number` is allocated at publish, not at create** (issue #270). A draft carries NULL: the
number is proposed in the publish modal as `max(number among published) + 1`
(`nextIssueNumber`) and written by `publishIssue`, so a magazine that throws away a dozen
drafts still publishes its first edition as No. 1. Consequences:

- The column is nullable. Uniqueness is a **partial unique index** over published rows
  (`issues_published_number_idx`), replacing the old global `issues_number_key` constraint,
  and a check constraint (`issues_published_has_number`) makes "published implies numbered"
  a database invariant — which is what lets `PublishedIssueRow` read `number` as a `number`
  rather than `number | null`.
- The composite `issues_status_number_idx` is **kept**: it still serves the published lists'
  `status = 'published' order by number desc`, which the partial index can't (its predicate
  is not part of the key, so it cannot order the scan).
- `publishIssue` writes the number in one statement under a `case`, so a **re-publish leaves
  a live issue's number alone** — links already shared and emailed never break. A number
  taken since the modal proposed it surfaces as the unique violation it is (`isUniqueViolation`,
  `src/lib/db-errors.ts`) and comes back to the modal as a conflict, not a 500.
- Deleting a published issue frees its number; if it was the highest, the next publish
  proposes it again. A mid-sequence hole is only reused if the admin types it.
- The `issue-number-at-publish` migration **nulls the numbers of existing drafts** (published
  rows are untouched). A draft holding a stale number would show it in the editor's running
  head while the publish modal proposed a different one.

## The content model

The whole pages→blocks tree is stored as **one JSONB document** in `issues.content`, typed as
`IssueContent`:

```ts
IssueContent = { version, pages: { id, cover?, coverOverlay?, coverElements?, blocks: Block[] }[] }
Block = Heading | Text | Image | Montage | Video | Sponsor  // discriminated union on `type`
```

`version` marks which shape of the content model a document holds, so block-shape changes can
migrate old rows deliberately. **Current version: 10.** Every string field is length-capped and the
page/block arrays bounded in the zod schemas, so a bad save can't persist an unbounded document.

**Content v10 — fitted cover panels.** `coverOverlay.appearance` and
`coverPlacement.appearance` gain an optional `panelShape`: `block` (the panel fills the item's
box — what an omitted value means, so existing covers render unchanged) or `text` (each wrapped
line of copy carries its own band, stepping with the rag). It inherits like the other appearance
fields; photos and logos have no lines and always resolve to `block`. Rendering is CSS only
(`cover-overlay.css`): every run of cover copy sits in a `.cover-line` pair, in the reader
(`CoverLine`) and the editor (`CoverParagraph`) alike, so the editor, readers, thumbnails and PDF
share one shape and switching shape never rewraps text. Bands centre on the caps (Newsreader's
own ascent and descent are corrected for in `cover-overlay.css`). While editing, a line whose words
fill the item exactly, or that breaks at a doubled space, bands that trailing space too. The lead
Story on seed issues 2, 4 and 6 and Aperture’s Details use it; their "Also inside" lists use block
panels. `scripts/check-cover-panel-shape.mts [base-url]` checks it in memory and, with a local
server, measures each band against its words across the editor, history, readers and print.

**Content v9 — cover typography.** Optional Story `headlineFont` and `headlineWeight`
set headline defaults. Inline `coverPaint` gains validated `fontFamily` and
`fontWeight` attributes. The three font ids are `newsreader`, `hanken-grotesk` and
`roboto-condensed`; weights are standard 100-step positions (200–800 Newsreader,
100–900 the others). Omitted values retain the original typography. No DB
migration or content rewrite is needed. See [cover typography](cover-typography.md)
for selection, inheritance, bold interaction, font sources and checks.

**Content v7 — optional cover elements.** `coverElements` stores a bounded array of `story`,
`details` and `logo` elements. A `story` element carries an optional list heading (`title`,
empty for none), one to six `items` and one `headlineSize` (`compact` | `list` | `large` |
`display`, stored, never inferred). Each item has its own `id` (so a free-standing story is
addressable), an optional `headingId` linking it to a section, a title override and a description.
A new Story starts blank — no list heading, one empty story, the `list` headline size — and the
editor's Text menu (Paragraph / Story / Details) is where it and the details element come from.
They are independent of the article-block union. Each has a row/column anchor, width, text alignment,
vertical adjustment and optional contrast override. Optional `textSize` (`small`, `normal`,
`large`, `xlarge`) scales text to 80%, 100%, 120% or 140% independently of wrapping width; omitted
means 100%. Heading, text and inline image blocks can opt into the same placement through
`coverPlacement`, including an optional nonnegative `order` for ordering headings, text and cover
details together within an anchor. Missing fields preserve the old cover flow; templates add no
elements by default. `coverOverlay.appearance` and `coverPlacement.appearance` hold independent
`panel`, `background`, `text`, `shadow` and `shadowColor` overrides. Colours are bounded palette
identifiers or six-digit hex, never arbitrary CSS; shadows are none/soft/strong. Omitted fields
resolve from the saved legacy style. `coverPlacement.richText` stores at most 20 keyed, bounded
paragraph-only documents (title/kicker/text, or story-id plus field), with bold/italic/underline
and a validated colour/shadow mark. Plain fields are updated atomically alongside the documents. A
document only renders when its plain text matches the current field, so source-heading renames
cannot display stale words. These optional v7 additions keep existing rows readable without
migration; normal article rich text is unchanged. Linked stories reference heading ids, resolving
current titles and page numbers at render time; an optional cover title overrides only what the
cover prints. Logos retain both their library id and image id, so the shared image
resolver/cleanup sees the asset and library deletion refuses active cover references. Demoting a
cover retains its elements in ordinary flow and preserves their positions for re-enabling cover
styling. Seed issues 2, 4 and 6 demonstrate the new composition; issue 5 retains the
deliberate legacy page. Existing rows need no migration or rewrite.

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
alt, caption? }[]`) that cross-fade on a timer in the readers, carrying the image block's `caption`/`align`/
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

**Content v6 (issue #227) — the page-owning image placements.** The image block's `align` gained two
values, `"page-fill"` and `"page-fit"`. Both take the whole `PAGE_W × PAGE_H` canvas, reaching back
over the page's own margin (see `blockFlowStyle` and `PAGE_PAD`); they differ only in how the photo
meets it. `"page-fill"` crops to cover (`object-fit: cover`, focused a little above centre) — the
full-bleed plate. `"page-fit"` grows the photo at its natural ratio until the first edge touches
(`object-fit: contain`, centred on both axes), so a landscape photo spans the width with
page-coloured bars above and below and a tall one spans the height with bars either side; the figure
paints `bg-page` so those bars are the page's own colour on every surface.

A page carrying either is **owned** by it: `PageFrame` drops the running footer and the theme's
decoration (`bleed`), so no page number or automatic masthead prints over the photograph, and the block
carries no caption (alt text is unchanged). `width` is kept but ignored, so unsetting the placement
restores the size the photo had. Deliberately confined to `image`: a montage would have to crop
several photos to one page shape and a video's frame is always 16:9, so both keep the three-value
union. On a cover, either placement becomes the background and existing blocks remain as
editable overlays. Only one background is active: selecting another returns the previous image
to ordinary placement without removing it. Interior full-page photos remain image-only.

Where it plays is again a **render-path** decision: with `interactive`, the block mounts the client
`VideoPlayer` — a facade showing the poster and one large play button, which injects a
`youtube-nocookie.com` iframe only on activation (never autoplaying on load, and moving focus into
the frame so the keyboard isn't dropped). Without it — print/PDF, the editor canvas, the library
thumbnail — it renders `VideoStill`: the poster, a play mark, and the address as visible text
(`youtu.be/<id>`, a real link on the print page so Chromium emits a PDF link annotation). A PDF
cannot play video, so that pair is its deterministic single representation, the same call the montage
makes by printing only its first slide — and the same reason `RENDER_VERSION` was bumped with it. The
embed is also the one thing the CSP's `frame-src` allows (`src/proxy.ts`).

Defined as zod schemas + inferred types in [`src/lib/blocks.ts`](../src/lib/blocks.ts) and applied to
the column via `jsonb(...).$type<IssueContent>()`.

A page may set `cover: true` — it then renders through the dedicated cover
treatment (vertically centred, oversized hero type) in both readers and the
editor, rather than the normal flow. Covers carry no running footer in the
desktop reader, editor, PDF or thumbnails; theme decoration stays, and interior
page numbers still count the cover as page 1. `coverOverlay.decoration` overrides the cover
frame and running masthead only; omitted retains the existing default (on for plain covers,
off for full-image covers). `coverOverlay.masthead` separately hides the automatic magazine name and issue number
while retaining the frame (omitted means shown when decoration is on). Neither setting changes
the issue theme, typography or interior pages.
An optional `coverOverlay: { style, position }` stores the cover treatment. Styles are `light`,
`dark`, `light-shadow`, `dark-shadow`, `paper-panel` and `ink-panel`; positions are `top`, `center`
and `bottom`. `position` is legacy: it is read as the fallback row for a heading or text block
that has no `coverPlacement` of its own, and no control writes it any more (v7 placements carry
their own row). Absent settings resolve to light lettering with shadow, centred. These options
change contrast and placement while retaining the magazine fonts and ornaments; solid panels
use the brand's page/ink pair for predictable contrast over any photograph. The optional field
does not bump content v6 or rewrite old rows. It is retained when normal placement is restored.
Turning off cover styling (including reordering the front cover away) restores normal image
placement when other blocks share the page; an image-only page keeps its Fill/Fit placement.
All of these edits participate in the document undo history and autosave. The mobile reader has no page
footers and keeps its closing lockup. A `Text` block carries an optional `size`
(`s|m|l|xl`); since the page is a **fixed design canvas** that scales as a whole
(see below), that size is absolute px on desktop/print and a relative multiplier
in the reflowing mobile reader. Both fields are optional, so older content
parses unchanged.

Body text also carries optional `align: left|center|right|justify` (issue #238),
authored per block alongside size and copied onto text-flow continuations. Missing
alignment means left; the field requires **no content-version bump or migration**.
Cover taglines ignore it and stay centred. Only the reflowing mobile reader enables
automatic hyphenation for justified text; fixed pages disable it so their measured
line breaks do not depend on browser hyphenation dictionaries.

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
`listIssues`, `listIssuesPage`, `listIssueYears`, `listMatchingIssues`, `getIssue`,
`getPublishedIssueByNumber`, `createIssue`, `updateIssueContent`, `updateIssueMeta`,
`publishIssue`, `deleteIssue`, `deleteIssues`. Components call these — never Drizzle directly.
The dashboard's search and filters are all in `listIssuesPage`'s WHERE, so a search sees the whole
list rather than the served page; `deleteIssue` is `deleteIssues` of one, so the single and bulk
deletes cannot drift apart on cleanup.
Mutations use Server Actions in `src/app/admin/actions.ts`, except editor autosaves, which use
`POST /api/admin/issues/[id]/save` and validation in `src/server/editor-save.ts` (#245).
Both entry points authenticate admins and delegate database writes to the data layer.

## Asset lifecycle (issue #84)

Deleting an issue, a sponsor or a logo — or replacing, clearing or removing a member's avatar, or removing the member — takes its now-unreferenced images with it — rows **and**
stored objects — so the bucket stays in step with what the database references.
[`src/server/asset-cleanup.ts`](../src/server/asset-cleanup.ts) holds the two shared pieces:

- **`collectReferencedImageIds(tx)`** — every image id anything still points at, gathered by
  scanning rather than counting: `collectImageIds` over **every** issue's `content` (image blocks,
  montage slides, video poster frames), plus every `sponsors.logoId`, plus every `logos.imageId`, plus every `member_names.avatarImageId` (issue #299 — an avatar has no issue to keep it).
  That last one is load-bearing — `logos.imageId` cascades, so deleting a mark's image would delete
  the logo row and blank the footer of every issue that picked it. (`issues.logoId` needs no entry:
  it names a logo, which is covered.) A mirrored reference-count table was rejected on the issue
  thread: it can drift, and a full scan over an archive of tens of issues costs nothing at delete
  time.
- **`sweepOrphanedObjects(...)`** — the storage half, and it never throws.

**Ordering, which is the whole safety argument.** One transaction removes the owning row, then —
in that same snapshot, so it reads exactly "what survives" — scans, deletes the orphaned `images`
rows and returns their keys. Storage is touched **only after that transaction commits**. A crash in
between leaks objects (bytes with no row: cheap, invisible); the reverse order would risk deleting
bytes and then rolling back, leaving a live issue with holes in its pages. A failed sweep is
therefore best-effort and Sentry-captured, never an error the admin sees.

Candidates for an issue are its content's images **plus** every `images` row with that `issueId`
(uploaded while editing it, never placed) — the last moment those are identifiable, since the
foreign key nulls the column as the issue goes. Whether a candidate actually goes is decided only by
the scan. The issue's cached PDFs go too, by key prefix (`pdfs/{issueId}/`), since their keys encode
a revision and fingerprint nothing records once the row is gone.

Known race, accepted: at READ COMMITTED another admin's autosave could commit a new reference in the
window between the scan and the commit, costing one picture. Closing it means SERIALIZABLE and
aborting one of the two transactions — usually the author's autosave. Not worth it.

Not covered (deliberately): images dropped from a page during editing. They stay until the issue
itself is deleted; a future edit-time sweep should reuse `collectReferencedImageIds` rather than
grow a second definition of "referenced". Verified by
`scripts/dev-asset-lifecycle-gate.mts`.

**Issue transfer is the mirror image of all this** (issue #293, `docs/issue-transfer.md`). A delete
commits and then sweeps storage; an import writes objects and only then commits, so the failure it
has to survive is the opposite one — objects with no rows. Its answer is the `imports/<operationId>/`
prefix: every object one import writes lives under it, so the prefix is the record of the keys and
an abandoned attempt is cleaned up by deleting it, at once if possible and by the sweep in
`server/issue-transfer/operations.ts` if not. An imported image's key therefore says which
_import_ wrote it, exactly as an uploaded image's key says which issue it was uploaded under —
neither says who shows it now, and the reference scan above stays the only thing that decides that.

## Discussion (issue #299)

The storage and server module for the discussion epic (#298). It lands **dormant**: nothing
is shown and every member write refuses until an admin sets `settings.comments_enabled`
(shipped default off).

**Modules.** `src/server/comments.ts` (the thread: `listComments`, `countComments`, `createComment`,
`editComment`, `deleteOwnComment`), `comment-moderation.ts` (hide/unhide/delete, `createReport`,
`resolveReport`), `report-inbox.ts` (`listReports`, `countOpenReports`), `member-names.ts` (posting
names and avatars, `getMemberIdentity`), `notifications.ts` and `discussion-guard.ts` (the switch,
rate limits and text cleaning). Every write calls `requireMember()` or `requireAdmin()`
(`src/server/session.ts`) first and takes the account from the session, never from its input. Member
writes answer with `{ ok: false, reason }` — a sentence — rather than throwing, including the
per-member rate limits: post 10 per 10 minutes, edit 30 per 10 minutes, report 10 an hour, name
changes (removing a photo included) 10 an hour, and photo uploads 5 an hour, spent by the upload
route before it reads the file. Member reads (`listComments` for a non-admin, `countComments`,
`listNotifications`, `countUnread`) return nothing while the switch is off; admin moderation works
either way.

**What members read.** A member's comment shape carries no email and no author id — `isMine` is
decided on the server; `src/lib/comments.ts` asserts it at the type level. A hidden or deleted
top-level comment with visible replies comes back as a stub with no body and no author (hidden
and deleted are indistinguishable), and without replies it is omitted. Admins get every row,
flagged, with the account's `users.name`. An author can't edit a hidden comment until an admin unhides it. An avatar
must be a fresh upload — no issue behind it and nothing else (a logo, a sponsor, another name)
already showing it.

**Deleting.** The author's delete: a comment with replies or an open report is soft-deleted (body
blanked, `deleted_at` set), otherwise hard-deleted — decided in one transaction with the row locked,
and `createComment` locks the parent `FOR SHARE`, so a reply landing at the same moment is never
cascaded away. An admin's delete follows the same rule except that a comment with any report, open
or resolved, is always kept as a stub (Moderation, below).

**Posting-name rules** (`src/lib/member-name.ts`, shared by the browser and the server):

- NFKC, trimmed, inner whitespace collapsed; 2–40 characters.
- Letters of any script, combining marks, spaces, apostrophes (`'` `’`), hyphens and full
  stops — no digits, `@`, emoji or control characters, and nothing shaped like a web address
  (`bit.ly`; initials such as `J.R.` are fine).
- Reserved, whole-name and case-insensitive: Former member, Comment removed, Anonymous, Admin,
  Administrator, Moderator, Committee, Editor, and the magazine and club names from settings.
- A profanity filter (`obscenity`, English dataset + recommended transformers, which catch l33t
  spellings). A flagged word that also appears in the account's own `users.name` is allowed
  ("Dick Turner" for a member the club records as Richard Dick Turner). An admin can set any
  other real name for a member with `adminRenameName`, which skips only this filter.
- One account can't hold a name twice — the `(user_id, name_key)` index refuses it and the
  module answers "You already have this name". Another account may hold the same name; `addName`
  and `renameName` return `sharedWithAnotherMember: true` so the UI can suggest an initial.
- A name with comments is retired rather than deleted (off the picker, still on its comments);
  re-adding a retired name of your own restores that row. The last live name can't be removed.
  Renaming applies to past comments — they point at the row.

**Removal policy.** `deleteUser`/`deleteUsers` (`src/server/member-removal.ts`) read
`removed_member_comments` inside the removal's transaction:

- `anonymise` (default): the member's comments stay, with author and name cleared — "Former
  member", no avatar.
- `delete`: their replies go, then their top-level comments — as a blank stub where someone
  else's reply survives, otherwise outright. A reported comment (reply or not) is always kept
  as a stub, and every stub here is marked `deleted_by = 'admin'` (issue #302).

Either way the author columns are cleared by hand before the user row goes. Left to the foreign
keys, the user delete's set-null on `author_id` re-checks `author_name_id` after the cascade has
already removed the name row, and the delete fails. The member's avatar image ids are collected
before the cascade, orphaned in the same transaction and swept from storage after the commit.
Reports keep their snapshot (the reporter and snapshot account go null). The policy applies at
removal time only, never retroactively.

**Moderation (issue #302).** A soft delete records who made it in `comments.deleted_by` (`author` |
`admin`, app-validated like `reason`): `removeLockedComment` takes it from its caller — the author's
delete passes `author`, the admin's delete and a removal under the `delete` policy `admin`. An
admin's delete of a comment with any report keeps it as a stub, so the only way a reported comment's
row disappears is its author's hard delete (no replies, no open report) — the inbox reads a missing
row as "Deleted by its author since" and a stub by its `deleted_by`, never from `hidden_at`. Hiding
or deleting a comment resolves every open report on it in the same transaction, recording
`resolved_by`/`resolved_at`. `createReport` inserts with `on conflict do nothing … returning`, and
only a new row emails the admins — once the response has gone (`after()`,
`src/server/after-response.ts`), never failing or delaying the report. The email is throttled
in-process to one per 15 minutes site-wide, and its link is built from `APP_URL` only: in production
without it the email is skipped and Sentry told, never built from a member's request headers
(`src/server/report-alert.ts`). The inbox reads through `src/server/report-inbox.ts`.

Verified by `scripts/check-member-name.mts`, `scripts/check-comments-module.mts` and
`scripts/check-report-moderation.mts`.

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

### `db:push` leaves the journal behind

Drizzle records what it has applied in a bookkeeping table, `drizzle.__drizzle_migrations`
(one row per migration: the folder `name`, a sha256 `hash` of its `migration.sql`, and
`created_at` from the folder's timestamp prefix). `db:migrate` decides what to run by
**name** — anything in `drizzle/` without a matching row gets applied.

`db:push` writes your schema change into the database but adds no such row. Generate the
migration afterwards and your local DB is carrying that migration's effects with nothing
recording it, so the next `npm run db:migrate` re-runs it and dies on a collision:

```
error: column "footer_mark_size" of relation "issues" already exists
```

That is local state only — the committed migration is correct, and a real deploy (which
never pushes) applies it once, normally. To recover:

```
npx tsx scripts/dev-journal-reconcile.mts        # --dry-run to look first
```

It inserts the missing journal rows for migrations whose effects are **already in the
database**, proving each one by checking the live catalogue for the tables, columns,
indexes, types and constraints its SQL creates. It is additive only: it never runs
migration SQL and never touches an existing row, so a migration that genuinely hasn't run
is left for `db:migrate`, and a half-applied one is reported for a human. Running it twice
is safe — the second run has nothing to do. Wiping and re-migrating (above) is the other
way out, at the cost of your local data.

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

### The v6 bump (issue #227) — a widened enum, opt-in only

Not a new block type this time but new _values_ on an existing field, which is additive on the
same terms: no version-1…5 document holds `align: "page-fill"` or `"page-fit"`, so every one parses
and renders byte-for-byte unchanged, gains nothing, and no stored row is rewritten or migrated.
`CONTENT_VERSION` moves to `6`; new documents and any resave stamp it. There is no one-off
migration and none is needed.

The seed authors both shapes — issue-02, the camera-club quarterly, carries a portrait fill-page
plate and issue-04, the sailing season review, a landscape fit-page one, each alone on its own page,
described by alt text and uncaptioned — and issue-05's deliberately legacy-shaped page stays exactly
as it was.

`scripts/dev-fill-page-gate.mts` checks all of it in memory — the seed's shape, both placements
being refused on montage and video blocks, a v5 document surviving untouched, and the shared
renderers (reader/print page, library thumbnail, mobile column) agreeing on the geometry, the crop
or the fit, the page-coloured bars, the dropped caption and the dropped footer. Run it with
`npx tsx --tsconfig scripts/tsconfig.json scripts/dev-fill-page-gate.mts`, **never
`npm run db:seed`**, which wipes every authored issue.

### The v8 bump (issue #280) — optional captions on montage images

Montage items add an optional `caption` (up to 300 characters), separate from `alt`.
New montages use per-image captions; an empty caption shows no text. The existing block
`caption` stays authoritative while nonempty, so older documents keep their shared caption
without a rewrite. In the montage dialog, **Use captions per image** copies that shared text
to every image without a caption and clears the block caption in one undoable edit. The
canvas no longer offers a shared caption field. Each image starts as a compact row with a
single-line caption beside its preview and reorder/delete controls. A chevron left of the
preview expands the separate screen-reader description textarea, which never copies the caption.

`MontageCaption` reserves the tallest caption using overlapping grid cells; changing slides
cannot move the following content. Blank slides hide the caption and its theme decoration.
The editor, thumbnail and PDF show the first image and its caption with that same reserve.
Issue-02 seeds two distinct captions and one blank; issue-05 keeps one pre-v8 montage with
its shared caption and unchanged items. `scripts/dev-montage-gate.mts` validates both in memory.
`npx tsx --tsconfig scripts/tsconfig.json scripts/check-montage-captions-browser.mts <base-url>`
checks authoring, history, concurrent uploads, both readers and both PDF themes using a temporary
local issue and session; it removes its fixtures afterward.
No SQL migration or automatic conversion is needed; new documents and resaves stamp v8.

### A version bump includes updating the seed

The seed (`src/db/seed/`) is not just fixture data — it is the primary render path a fresh
environment exercises. So a content-model version bump is not done until the seed **authors content
in the new shape**, not the old one relying on the compatibility fallback. Concretely (issue #36):
the `T()` builder emits v3 rich-text docs via `stringToDoc`, so a freshly seeded database renders
through the same path as real edited content. Keep **one deliberately legacy-shaped page** — a plain
string (`Traw`) and a constrained-HTML string (`Thtml`) — so the permanent v1/v2 render fallback and
the migration converter stay under ambient coverage. When you bump `CONTENT_VERSION` again, do the
same: update the builders to author the new shape, and leave a small, commented legacy fixture behind.

### Demo cover designs

The six-issue seed keeps the original covers for Boule & Bay (01), The Commons
(03) and Marginalia (05). Aperture (02), Kiln & Wheel (04) and Regatta (06) use
portrait Fill page illustrations, individually styled typography, linked Story
teasers with live page numbers, Details and a reusable Logo from the seeded logo
library. Regatta is the latest issue, featured on the library home page. All
interiors, including the deliberate legacy page, stay unchanged.

`src/db/seed/cover-elements.ts` holds the cover compositions and logo records;
`cover-art.ts` draws their portrait artwork and transparent marks. They pass
through the same local SVG → WebP pipeline as the other seed pictures, so seeding
needs no image downloads or external service. The runner validates every issue
before its atomic replacement of issues, images and their dependent logo rows.
