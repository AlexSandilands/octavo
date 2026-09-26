# Architecture

A members-only digital magazine. An admin authors page-based issues; members read them as a
flipbook (desktop) or a single scroll (mobile). Access is by magic link — membership is presence
on the `users` list; nobody self-registers.

This doc is the fast orientation for the codebase. For data specifics see
[database.md](database.md); for the rules every change follows see
[design-principles.md](design-principles.md).

## Stack

| Concern        | Choice                                                                            |
| -------------- | --------------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router), React 19, TypeScript                                     |
| Styling        | Tailwind v4 (tokens in `src/app/globals.css`)                                     |
| Database       | Postgres via Drizzle ORM                                                          |
| Object storage | Cloudflare R2 — images (WebP via sharp) + cached PDFs; local-disk fallback in dev |
| Auth           | Auth.js v5 magic link, database sessions (~90 days) — see below                   |
| Email          | Resend (magic-link email); dev logs the link to the console instead               |
| Hosting        | Railway (app + Postgres)                                                          |

## Directory map

```
src/
  app/                 routes (App Router). Server components by default.
    page.tsx           library (latest issue + recent back-issues)
    archive/           the full back catalogue, paginated + searchable
    signin/            magic-link entry: form + action, sent/ confirmation
    read/[issueId]/    reader — desktop flipbook + mobile scroll
    profile/           the member's own page: posting names, photos, email settings
    admin/             shared admin auth gate
      (dashboard)/     persistent shell: dashboard, members, sponsors, magazine
                       (branding + logos), help; route group leaves URLs unchanged
      actions.ts       server actions (mutations)
      issues/[id]/edit editor (standalone full-screen)
    api/admin/images/  image upload route handler (multipart → sharp → R2)
    api/profile/avatar/  a member's avatar upload (the one non-admin upload)
    api/admin/issues/[id]/save/  stable, authenticated JSON autosave endpoint
    api/admin/video-poster/  captures a YouTube poster frame into that same
                       pipeline (one of two outbound fetches, with the AI proxy)
    api/admin/ai/chat/ the AI assistant's proxy to the model provider (epic
                       #306; off unless AI_PROVIDER is set)
    api/admin/ai/usage/ the month's assistant spend, for the editor panel (#309)
  components/          shared presentational UI (ui.tsx, icons.tsx, admin-shell, ...)
  features/            feature modules with their own UI/logic
    admin/             the issues dashboard list (client): search + filters,
                       row selection across pages, the bulk export/delete bar,
                       and the import-a-bundle modal (issue transfer)
    blocks/            BlockView — themed block renderer (+ the montage and
                       video widgets); page-frame + page-footer — page chrome
    magazine/          the magazine-details settings form + its live page preview
    ai-usage/          the /admin/ai usage page: figures, the day table, notes
    editor/            the page-based editor (client) + per-block edit controls;
                       side-panel/ (the rail), pdf-import/, assistant/ (#306)
    reader/            desktop-reader, mobile-reader (client)
    discussion/        the members' thread (client): one thread component in
                       two shells — the desktop drawer and the phone sheet —
                       with the composer, report dialog and history handling
    members/           members manager (client): table, toolbar, add/import dialogs,
                       the posting-names moderation dialog
    profile/           the member profile page's names, photo and email controls
    library/           the member-facing library: masthead, latest-issue hero,
                       the cover shelf (archive-grid), the /archive controls and
                       the header's notification bell
  db/                  Drizzle schema (schema.ts + schema-ai.ts), client, seed,
                       and the db:admin / ai:grant scripts
  lib/                 framework-agnostic helpers
    blocks.ts          the canonical content model (zod + types)
    images.ts          ImageMap type, built on image-sites.ts
    image-sites.ts     the one traversal of every place a document references an
                       image — shared by the renderers' ImageMap and the import's
                       rewrite, so a new block type is in both or in neither
    issue-transfer/    the bundle format, the shared caps, and the pure
                       manifest/document checks + resolution (docs/issue-transfer.md)
    same-origin.ts     the CSRF check every admin route handler runs
    storage.ts         storage facade: R2 if configured, else local disk —
                       put/get/delete one key, and list/delete a folder prefix
    r2.ts              R2/S3 client (server-only): upload, keyToUrl
    local-storage.ts   dev fallback: .data/uploads on the filesystem
    image-processing.ts sharp: normalise uploads to WebP
    branding.ts        magazine settings: types, the three-step size/align
                       scales, and the pure stored+defaults → effective resolver
    site-defaults.ts   the NEXT_PUBLIC_* branding fallbacks (read only by
                       server/settings.ts — nothing else may)
    comments.ts        discussion vocabulary: limits, report reasons and the
                       member/admin read shapes (no email, no author id)
    discussion-thread.ts  the thread as the reader receives it: one wire shape
                       for members and admins, and the reader's DiscussionInfo
    member-name.ts     the posting-name rules, shared by browser and server
    ai-month.ts        UTC calendar months as "YYYY-MM" (the usage page's ?month=)
    ai-pricing.ts      AI model prices per million tokens (dated), the per-run
                       cap, and pricing one request's tokens
    env.ts             validated server env
    id.ts              id generator
  server/              server-only data access (users.ts, images.ts, ...) and auth
    issues.ts          admin issue listing + filters, and all issue CRUD
    library.ts         member-facing reads: library home page, published archive
    auth.ts            Auth.js config: provider, callbacks, session shape
    auth-adapter.ts    hand-rolled Auth.js adapter over the users/sessions tables
    auth-email.ts      the magic-link email (template + Resend/console transport)
    issue-email.ts     the new-issue announcement email (template only)
    publish-email.ts   publish blast: per-member magic links + batch-sends
    magic-link.ts      mints a personal sign-in link outside Auth.js, exactly as
                       its email flow does (the publish blast, the reply email)
    recipients.ts      mailing-list data access (subscribed members, un/resubscribe)
    unsubscribe-token.ts  HMAC-signed, session-less unsubscribe tokens, each
                       naming its purpose (new issues or reply emails)
    site-origin.ts     the origin for a link in an email (APP_URL when someone
                       else will click it)
    settings.ts        the magazine settings: cached per-request resolve, the
                       admin update, and the PDF chrome fingerprint
    asset-cleanup.ts   the asset lifecycle: which images anything still
                       references, and the post-commit storage sweep the
                       issue/sponsor/logo deletes run (see database.md)
    issue-transfer/    building a bundle, reading an untrusted one, the import
                       transaction and the operation record + its recovery
    ai-budget.ts       AI spend: the usage ledger, the owner's grants, the
                       month's budget and the daily rollup (no model calls)
    ai-usage.ts        the usage page's extra reads: a month's runs counted
                       once, and the ledger's first month
    session.ts         getSession()/getUser() — how the app reads who's signed in,
                       and the requireAdmin()/requireMember() write gates
    member-removal.ts  removing members: the guard rails, the removed-member
                       comment policy and their avatars' cleanup
    id-chunks.ts       splits a bulk id list into Postgres-sized statements
    comments.ts        the discussion thread: viewer-shaped reads, counts and
                       the member writes (dormant until comments_enabled)
    comment-moderation.ts  hide/unhide/delete (each resolving the comment's
                       open reports), createReport and resolveReport
    report-inbox.ts    the /admin/reports list (search, filter, paging) and
                       the open count the admin nav shows
    report-alert.ts    the report email's 15-minute throttle and transport
    report-email.ts    the report email to admins (template only)
    member-names.ts    posting names and avatars, getMemberIdentity()
    notifications.ts   reply notifications: create/trim, list, unread, mark read
    reply-alert.ts     the opt-in reply email: who is owed one, and the transport
    reply-email.ts     the reply email (template only)
    after-response.ts  runs the reply and report emails once the response has
                       gone, so a slow mail provider never holds up a post
    discussion-guard.ts  the discussion switch, per-member rate limits, text cleaning
    discussion-thread.ts  the reader's thread payload (with the composer's
                       names) and the comment counts the delete confirmations quote
scripts/               dev-only helpers (not part of the app), e.g. the headless
                       magic-link flow check (dev-auth-flow.mts)
```

## The content model (central concept)

An **issue** owns one JSON document (`content`) shaped as **pages → ordered blocks**. This is the
**source of truth**; the reader and editor both render from it, and the PDF derives from it.
Block types: `heading | text | image | montage | video | sponsor`. Defined once in
[`src/lib/blocks.ts`](../src/lib/blocks.ts) as zod schemas + inferred types, imported everywhere
(editor, reader, DB column type). See [database.md](database.md) for how it's stored.

`BlockView` renders every one of them, and takes an **`interactive`** flag that only the two readers
set. It marks the render paths where a block may animate and be driven by the member; the print/PDF
document, the editor canvas and the library thumbnail leave it off and get one deterministic frame
with no client JS. Two blocks read it: `montage` (player vs. first slide) and `video` (a play-button
facade vs. the poster frame plus the address in printable text). Montage captions follow the
active image in both readers; `MontageCaption` shares the same maximum caption-height reserve
with the static first-image surfaces. Legacy shared captions remain until explicitly converted
in the editor dialog; per-image captions and screen-reader descriptions are separate fields.

**The desktop reader's page turn is a shaded paper curl** (issue #215), split the same way as the
rest of the reader: `curl-model.ts` samples the turn's geometry once per flip — a hinge chain of six
flat sections rotating about the spine, with per-section tilt, reach and lift — into keyframes;
`turn-curl-animate.ts` turns those into linear Web Animations (no per-frame JS); `turn-curl.tsx` is
just the DOM. Underneath the moving sheet sits a static copy of the page it's lifting off, clipped to
the sheet's own footprint — the "crack fix" that stops a hairline at the section boundaries from
showing the page underneath instead of the sheet's own content. `PageBlocks`/`BlockView`'s
`interactive` flag does double duty here: the flat pages still fully in view keep it, the sheet's
face copies (and the crack-fix copy) don't, and are `aria-hidden` too, so a screen reader doesn't
meet a dozen copies of one page mid-turn.

**Full-image covers** share `PageContent` across the editor, desktop reader, thumbnail and print
renderers. It places the Fill/Fit photo behind the cover blocks without changing their stored
order. Page-level appearance now chooses a panel or no background, palette/custom colours,
and independent text/shadow colours and strength. The six older contrast presets are resolved
as backward-compatible defaults. Per-element appearance can inherit the cover or override it.
`cover-overlay.css` retains the magazine typography. The mobile reader uses `MobileCover` for the same composition in a reflowing
viewport beneath the header (growing for larger text). Interior full-page images keep their
image-only behaviour. Content is never silently removed: on a grid cover the inspector's layout
checks name anything that runs past the margin; legacy stacked covers keep the on-page overflow
marker. `EditorToolbar` offers a cover-specific set on covers: Heading, Text — a menu of
Paragraph, Story and Details — Image, and Logo. A floating rounded inspector
sits over the stage on its docked side; the fit leaves room for it, the page slides away from it
only as far as the two would otherwise meet (eased), and a page panned towards it shows through
beneath. Its header grip drags
it to either side of the page (a plain press flips it; the side is remembered per browser in
`use-panel-dock.ts`). The inspector holds whole-item settings in titled bands — Placement, Appearance,
the item's content — plus the cover's defaults and page toggles when nothing is selected, and a
"Needs attention" list of layout checks that name the item(s) concerned: pointing at one lights the
item up on the page, pressing it selects it. Placement is pinned above the scrolling bands and folds
away on a press of its title; the fold is remembered per browser (`use-inspector-band.ts`). Cover
menus use viewport-constrained portals so inspector scrolling cannot clip their options. Colour
rows are the magazine palette plus one custom swatch; the native colour input is a 1px anchor at
the row's left edge, opened from the swatch, so the browser's picker opens over the row rather
than off the edge of the screen.

Cover text uses an inline-only Tiptap editor on the page and in detail fields. Formatting for the
selected words — font family and named weight, bold, italic, underline, a colour and a shadow — is a floating bar over the selected
item (`CoverTextToolbar`), the same split the body-text blocks make on ordinary pages; whole-item
appearance stays in the inspector. The bar finds its editor through `CoverTextProvider`: the focused
editor, else the selected item's first text field. `cover-rich-text.ts` bounds and validates
the document, and `CoverRichText` renders React elements in readers/thumbnails/print; editor code does
not enter the reader bundle. Plain fields remain the source for headings/references; matching rich
field documents carry only cover formatting, and stale documents never override renamed text.

**Optional cover elements** are defined in `lib/cover-elements.ts`. `CoverGrid` anchors groups to
left/centre/right and top/middle/bottom, stacking entries that share an anchor. `CoverElementView`
renders story lists, issue details and logos across the editor, reader, thumbnail and PDF. One
`story` element covers every cover list: an optional list heading (blank by default, ghosted
"Inside this issue" in the inspector), one to six linked or free-standing stories, and a stored
`headlineSize` stepping the headline from 18px to 36px (the description stays at body size).
Optional `headlineFont` and `headlineWeight` choose a default for its headlines;
selected words can override it. Full-range fonts use separate self-hosted aliases
so legacy pages retain their appearance; see [cover typography](cover-typography.md).
`coverSources` derives section titles and page numbers from live headings;
only an explicitly authored cover title overrides that reference. Logos use the ordinary ImageMap
and asset reference traversal, with an additional library deletion guard. Heading/text blocks
can independently opt into `coverPlacement`; otherwise their original cover flow remains.
`MobileCover` uses the same entries in row/column reading order, reflowing to a full-width column
at the member's text size. Direct canvas selection controls the inspector target, including existing
headings, text and images. A photo on the cover takes its size as the entry's width, so its frame,
panel and selection box hug the picture, and it takes no panel unless one is asked for
(`itemAppearance` in `cover-order.ts` is the one resolver for what an item paints with). Overlapping
items stack by an optional `layer` on the placement (`--cover-layer` → `z-index`), stepped with the
Bring forward / Send backward controls beside a selected item. A separate text-size preset scales
heading/text/detail typography without changing
wrapping width; both fixed-page renderers and the reflowing phone reader apply it. The cover
decoration toggle passes through `PageFrame` in the editor, reader, thumbnail and PDF; the
phone reader continues its unframed layout. A separate masthead toggle hides the automatic
magazine name and issue number while keeping the frame; it is offered only by themes declaring
`hasMasthead` and only while the owner's page-top switch (issue #269) is on, since that switch
already hides the text on every page the theme frames, covers included — `PageFrame` folds the
setting and the page's flag into the one `showMasthead` the theme sees. The inspector has its own stacking layer so the
canvas cannot paint over its soft shadow. Every text item uses the same position grid; legacy cover-flow positions are read as fallback
anchors, with no separate flow controls. `cover-order.ts` supplies shared ordering: a drop joins the
target anchor and saves placement order across headings, text, inline images and details. Cover sorting
reuses the normal vertical-list displacement within each anchor. Crossing anchors previews the space
opening in the destination stack and closing in the source stack; unrelated pinned groups stay put.
The sortable frame includes contrast-panel padding, so panels and content move together. Canvas handles support
pointer/keyboard dragging, with move and delete buttons matching ordinary blocks. New headings and
text join the central stack. Logo frames use intrinsic image width plus panel padding.
Measurements flag collisions and out-of-margin content. Elements are optional on both plain and photographic covers, and all edits share history
and autosave.

**Pagination happens once, in the editor.** Content never reflows at read time — a page is a fixed
canvas, and what the author placed is what every reader and the PDF get. So when a page overruns,
the _editor_ fixes it, explicitly: the canvas is measured where it is laid out
(`features/editor/page-metrics.ts` — `offsetTop`/`offsetHeight`, so the canvas zoom transform never
enters the arithmetic), and the topmost block crossing the page's text area gets a marker on that
line with one action beside it (`features/editor/text-flow.ts`). Body text is **split** at the last
top-level node that fits, cascading onto as many following pages as the remainder needs; every other
block type **moves whole**, since there is nothing sensible to cut. Both land the same way: on the
next page when it is empty and not a cover, otherwise on a page inserted for them. A block taller
than a whole page is marked but left alone — v1 never cuts inside a paragraph or resizes an image.
The split cuts the structured document, never an HTML string (`lib/rich-text-split.ts`), so marks
and lists survive it. The result is ordinary fixed blocks on ordinary pages: nothing downstream
knows it happened, and no block shape changed (`CONTENT_VERSION` unaffected). Issue #93.

**Editing is undoable at the document level.** `features/editor/use-editor-history.ts` keeps a capped
stack (100) of `{pages, curPage, sel}` snapshots — the whole document plus the author's place in it —
and `useEditorPages` takes a step before every structural edit. Edits to one field in a run (typing,
a size nudge, a caption) fold into a single step, so undo moves in author-sized units. Text typed
inside a block keeps its own finer history (Tiptap's, and the browser's inside the in-place
editables), and the editor-level Ctrl/Cmd+Z stands down whenever focus is in a text entry, so the two
never fight. Restoring re-seeds the uncontrolled in-place editors by remounting the blocks whose
content changed, and the ordinary autosave carries the restored document to the server. Issue #222.

The magazine tool bar responds to its canvas width (labels, icons, then a standing bar), and its
destination button lets the author pin it to the bottom or left for the rest of the mounted editor
session. The stage moves the measured reserve with it and re-fits the fixed page; a manually bottomed
bar wraps when the PDF panel leaves too little room for one row. The PDF bar keeps its independent,
mirrored automatic position on the panel's right edge. Issue #259.

## Assisted PDF authoring

The editor's right-hand side panel (`src/features/editor/side-panel/`, opened from a
tool rail on the editor's edge and resizable by drag or keyboard) hosts the Import PDF
tool, which lazy-loads a browser-only PDF parser; source files never upload.
Selected regions become ordinary v6 blocks through bounded measured fitting and one
history commit. Import is an ordinary edit on drafts and published issues alike,
refused only by the same revision check as any other save, and accepted photos use
the existing issue-owned image pipeline. Details,
limits, lifecycle and reproducible browser gates: [PDF import](pdf-import.md).

The same panel hosts the **editing assistant** (epic #306, dormant unless
`NEXT_PUBLIC_AI_ASSISTANT=1` and `AI_PROVIDER` are set), the rail's second tool
(`src/features/editor/assistant/`). It stays open on a cover, where the inspector steps
aside for it. Each message carries a plain-text projection of the issue, with every
page's fill measured off screen by the overflow marker's own geometry. The model's tool
calls run here, in the browser. Details: [AI assistant](ai-assistant.md) → Where it appears.

## Data flow

```
Editor (client state)
  └─ debounced autosave ─▶ POST /api/admin/issues/[id]/save (server/editor-save.ts, zod-validated)
                              └─▶ data layer (server/issues.ts) ─▶ Postgres (issues.content JSONB)

Reader / library / dashboard (server components)
  └─ data layer (server/issues.ts) ─▶ Postgres ─▶ rendered via shared block renderers

Issue transfer (issue #293) — one site's issues carried to another
  export ─▶ POST /api/admin/issues/export ─▶ rows + objects read once (sized + hashed)
                                          ─▶ streamed zip: manifest.json, issues/…, images/…
  import ─▶ browser reads ONLY manifest.json ─▶ POST /…/import/plan (writes nothing)
         ─▶ POST /…/import (raw zip body, excluded from the proxy)
              ├─ validate every entry against the save path's own rules
              ├─ issue_imports row `started` ─▶ objects under imports/<operationId>/
              └─ ONE transaction: images, logos, sponsors, issues + `committed`

Publish → email blast (publishIssueAction, admin only)
  └─ publishIssue(id, number) ─▶ Postgres (status=published, number allocated)
  └─ if "email members" chosen: server/publish-email.ts
       ├─ per member: mint an Auth.js verification token (same mechanism as
       │  sign-in) targeting /read/[number]  ─▶ verification_tokens
       └─ render + batch-send via Resend (console in dev)  ─▶ {sent, failed} → admin
```

### The issue number is chosen at publish (issue #270)

A draft has **no number** — `issues.number` is nullable and only means something on a
published row. The publish modal proposes the next one in the published sequence
(`nextIssueNumber`, one server-side definition shared by the modal's proposal and the
editor's running-head preview), the admin can type another, and `publishIssue` writes it.
A number taken in between comes back as a conflict and the modal stays open. A published
issue's number is **read-only** — renumbering would break links already shared and
emailed — and a re-publish leaves it alone. Deleting a published issue frees its number.

Ordering stays by `number desc` among published issues, so a back issue digitised later
(No. 3 published after No. 8 exists) does not become "latest". The dashboard lists drafts
first by last edit, then published issues by number. Drafts read as "Draft" in the row and
the editor chip; their canvas, thumbnail and preview render the proposed number so the
pages look right, storing nothing. See [database.md](database.md) for the column, the
partial unique index and the check constraint.

### Publish → email (the core loop)

Publishing an issue optionally emails every subscribed member. **The email _is_ the
magic link**: its "Read issue" button is a per-member Auth.js sign-in link with a
`callbackUrl` of `/read/[number]`, so clicking it signs the member in and lands them on
the new issue — no separate log-in step. Links are minted through the **same
verification-token path as the sign-in email** (`server/magic-link.ts`, shared with the
reply email, replicates `@auth/core`'s token: raw value in the URL,
`sha256(token+AUTH_SECRET)` stored, deleted on first use), so they carry the same 24h
expiry and single-use guarantee. A link that has lapsed or been used lands on the expired
sign-in with its destination kept as `?next=` (the auth route adds it, since Auth.js drops
it), and one clicked again by a member still signed in simply opens its page. The send runs
_after_ the publish commits and never throws — a mail failure leaves the issue published
and reports a `{sent, failed}` count to the admin (chunked 100/batch per Resend's limit;
a failed chunk is counted, not fatal). Re-publishing an already-live issue defaults the
email **off** so a correction can't re-blast the list.

Each email also carries a **signed unsubscribe link** (`server/unsubscribe-token.ts`):
an HMAC over `<purpose>:<userId>` under a key derived from `AUTH_SECRET`, verified in
constant time. The purpose — `issues` (`users.subscribed`) or `replies`
(`users.reply_emails`, issue #303) — is inside the signed payload, so a token can't be
relabelled; a token with none (every link sent before #303) verifies as it always did and
means `issues`. It needs no session (it arrives in email), can't be forged for another
user, and mutates only via a POSTed confirm button (or the RFC 8058 one-click POST, which
only ever stops mail) so an email scanner's GET prefetch can't unsubscribe anyone. The
`/unsubscribe` route sits outside the member gate by design.

- **Server Components by default.** `"use client"` only for interactivity (editor, readers, members
  table). Keep client islands at the leaves.
- **All DB access goes through `src/server/` data-access modules** (`issues.ts`, `library.ts`, ...,
  each marked `server-only`). Never query Drizzle from a component.
- **Mutations use Server Actions** in `src/app/admin/actions.ts`, except editor autosaves and
  media routes. Autosave uses a stable JSON endpoint so an open editor survives a deployment
  (#245). The route checks the admin session, origin, JSON content type and a 1 MiB body cap;
  `server/editor-save.ts` validates the id, metadata and content before calling the data layer.
- **Content saves are optimistically concurrent**: each save carries the `revision` it was based on
  and the DB rejects stale writes, so a second tab (or an out-of-order autosave) surfaces a visible
  conflict in the editor instead of silently overwriting newer work. The editor serialises its saves
  through one promise chain and shows save failures with a retry.

The save API accepts `{ kind: "content", content, baseRevision }` or `{ kind: "meta", meta }`.
Content success returns `{ ok: true, revision }`; metadata success returns `{ ok: true }`.
Invalid content/input, missing issues (content saves) and conflicts return
`{ ok: false, reason }` with HTTP 400, 404 and 409 respectively. Keep this contract compatible
with older editor bundles. Metadata still revalidates `/admin` and does not bump the revision.
Publishing and adopting footer settings remain Server Actions.

Regression gate: after `npm run build`, run
`node --env-file=.env --import tsx scripts/prod-editor-save-gate.mts` against a local database.
It owns a local production server, creates/removes only its fixture rows, and cold-builds a
second release while the first release's editor stays open. It verifies changed action IDs,
both saves without reload, conflicts, network recovery, validation, Preview, publishing without
email and list freshness, then runs the existing production action-refresh gate (which expects `.env.local` to exist).

## Discussion (epic #298)

A small community layer, built as six issues that each merged dormant, gated as a whole by
one switch, `settings.comments_enabled` (default off, same DB → env → default chain as the
PDF switch). The owner turns it on from `/admin/magazine`. While it is off there is no
thread, count, bell, name section or reply email anywhere, and every member write refuses.
Turning it off again hides everything and deletes nothing. The epic's Decisions section is
the contract (one level of replies, plain text, no anonymous posting, members-only, never
in the PDF or a transfer bundle).

| Piece                                                                     | Where it is documented                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Storage, the server module, posting-name rules, removed members (#299)    | `docs/database.md` → Discussion                                        |
| Member profile: posting names, a photo each, both email toggles (#300)    | the `/profile` and `POST /api/profile/avatar` rows under Routes        |
| The thread: button, drawer and sheet, deep links (#301)                   | below                                                                  |
| Moderation: the reports inbox and admin email (#302)                      | the `/admin/reports` row under Routes; `docs/database.md` → Moderation |
| Moderation in the thread (#302)                                           | below                                                                  |
| Reply notifications: bell and opt-in email (#303)                         | below                                                                  |
| Page tags: tag any page, chip jumps there, filter to the open page (#304) | below                                                                  |

**Going live.** Deploys run the migrations, so the tables are already in place. Check that
`APP_URL` is set on the production service: without it the reply and report emails are
skipped (and reported to Sentry) rather than sent with links built from the request.
Resend is already sending the publish blast, and the two discussion email streams are small
(`docs/infrastructure.md` → costs). Then switch **Discussion** on and choose the
removed-member policy (anonymise by default) on `/admin/magazine`. Admins need no setup:
an account with no posting name names itself in the composer with its first post.

**Gates.** `dev-discussion-gate.mts` (the thread, the admin's thread and page tags, split
across the `discussion-gate-*.mts` sections), `dev-profile-gate.mts`, `dev-reports-gate.mts`,
`dev-notifications-gate.mts`, the discussion and reports dialogs in
`dev-dialog-a11y-gate.mts`, and the module checks `check-comments-module.mts`,
`check-member-name.mts` and `check-report-moderation.mts`.

**Not built (phase 2, #305).** Section tags, a filter listing which pages and sections have
comments, per-page comment counts, and inline highlights (deferred, with the reasons, in the
issue). #304 already delivered a picker for any page.

### The thread (#301)

Every published issue has a thread — top-level comments and one level of replies, plain
text — that members read and write from the reader. They open it with one green
speech-bubble button (`DiscussionButton`, no count on it — a number there reads as "unread"):
on a computer in the reader's top-right corner beside the Theme toggle, on a phone floating
at the bottom right. **One component, two shells**: `DiscussionThread`
(`src/features/discussion/`) is the list — replies folded under a "N replies" toggle until
opened, or until the member replies there or a deep link points into them — its inline
reply/edit boxes (Escape cancels just the box) and the composer pinned beneath, its "Posting
as" menu and buttons kept to one line; `DiscussionDrawer` wraps it for the desktop flipbook (floating in
from the right over the stage, the contents rail's twin — it never resizes the spread) and
`DiscussionSheet` for the phone (a bottom sheet about 85% tall, swipe-down on its handle, the
column behind locked, and its box following `visualViewport` so the composer stays above the
on-screen keyboard). Both are `DialogShell` dialogs — focus moved in and trapped, Escape, the
page behind `inert` — and a report or delete confirmation opens _inside_ the panel, where the
shell's nested-dialog rule hands it the keyboard. The desktop reader's arrow-key paging stands
down for anything inside a dialog.

```
Reader page (server)  ─ settings.commentsEnabled? ─▶ DiscussionInfo { issueNo, signedIn }
Reader (client)       ─ useDiscussion: open state + a history entry per opening (Back closes),
                         its address ?discussion=1 — native history API, no navigation
  shell opens ─▶ GET /api/issues/[number]/comments[?page=<id>[&page=<id>]]
                   │  (member-gated, no-store; the pages only with Show → a page)
                   └─ listComments ▸ toThreadEntries ▸ { entries, composer }
  a write     ─▶ server action in app/read/[issueId]/actions.ts
                   └─ createComment / editComment / deleteOwnComment / createReport
                 or, an admin's, in app/read/[issueId]/moderation-actions.ts
                   └─ requireAdmin ▸ hideComment / unhideComment / deleteComment
               ─▶ refetch the list, scroll to and announce the result
```

Nothing about a thread is in the issue page's HTML — the list is fetched only when a shell
first opens and after each write, so a closed drawer costs no query. The
composer posts under one of the account's posting names ("Posting as"), defaulting to the name
on the member's latest comment; an account with none names itself in the composer and the name
is created with the first post. Reports always thank the reporter. The address mirrors the shell:
open reads `?discussion=1` — plus `&comment=<id>` when a link opened it that way — and closed,
by any way out, reads neither, other query parameters untouched. Opening pushes one history
entry with that address and closing pops it (an arrival already open — a deep link, a reload —
first clears the entry it came in on), all through `window.history`, which Next's router
follows without a navigation or a server round trip, so the reader never remounts and the
draft survives. `?discussion=1` opens the shell on load and `&comment=<id>` scrolls to and
briefly highlights that comment (the reports inbox links this way). Off (`comments_enabled`), on drafts and previews, on the print route and
in the PDF there is no thread at all; demo mode's signed-out visitor gets the button and a
sign-in panel, and the list route answers 401. The library's cards carry "N
comments" (visible comments and replies), and the admin's delete confirmations — single and
bulk — say how many comments go with the issues. Gate: `scripts/dev-discussion-gate.mts`.

### Reply notifications (#303)

A reply to someone else's comment writes a
`notifications` row for the parent's author in the post's own transaction (never for your
own reply; the newest 100 per member are kept, trimmed on insert, so nothing sweeps them).
The library header (`LibraryHeader`, on `/` and `/archive`) shows a **bell** for a signed-in
member while discussion is on: the unread count comes from `countUnread` in the page's server
render (no polling), and its menu (`NotificationBell`, a real menu with `MenuSelect`'s
keyboard contract) lists the newest 20 — "Ada replied to your comment on Issue 14", or on an
account with several posting names "…replied to Hugh's comment…", so a household can tell
whose. Choosing one marks it read and opens the #301 deep link to the reply; Mark all read
refreshes the server render. A reply since hidden or deleted neither counts nor lists.

```
createComment (reply) ─ tx: insert comment ▸ notifyReply (not your own) ─ commit
                      └▶ after the response: sendReplyEmail (reply-alert.ts) — never throws
                           discussion on? parent's author opted in (reply_emails)? not you?
                           ▸ mintMagicLink(email, /read/N?discussion=1&comment=<reply>)
                           ▸ replies-purpose unsubscribe token (link + List-Unsubscribe)
                           ▸ dev: console ([auth] magic link for …, [reply] …) · prod: Resend
```

The **reply email** goes, once per reply, to a parent author who turned reply emails on
(`/profile`): subject "<replier's posting name> replied to your comment on <magazine> Issue
14", the parent quoted briefly, the reply's first ~300 characters, every member-written
string HTML-escaped, and a **Read the reply** button that is a personal magic link from the
shared `server/magic-link.ts` — the same token, hashing and 24h life as the publish blast's.
Its links take their origin from `APP_URL` (never the replier's request); in production
without it the email is skipped and reported. The footer's **Stop reply emails** is a
`replies` unsubscribe token, flipping only `reply_emails`. Accepted: a reply an admin hides
later has already been mailed. Gates: `scripts/dev-notifications-gate.mts` and the bell's
walkthrough in `scripts/dev-menu-focus-gate.mts`.

### The admin's thread (#302)

`toThreadEntries` shapes one payload per viewer. A
member's is the members' rule, unchanged: hidden and deleted comments withheld, a removed
top-level comment kept only as a bare "Comment removed" stub while it has visible replies,
no account, no moderation state. An admin's carries every row — removed replies included —
each with `hidden`, `deleted` and `deletedBy`, plus the account's name (never the email or
id). The thread draws a hidden comment greyed on `chip-soft` with its words and a Hidden pill,
a deleted one as a stub marked Deleted and "Deleted by its author / an admin", and, only when
the account's name differs from the posting name (`accountLine`, compared as name keys),
"Account: <name>" linking to `/admin/members?q=<name>` — the members search matches names,
so the email stays out of the address; an account with no name reads "no name on record",
unlinked. An admin gets Hide / Unhide on every comment (it acts at once; the button flips in
place, so focus stays on it) and Delete on anyone else's, behind a confirmation; on their own
comment they keep the member's Edit and Delete. Those three are the server actions in
`moderation-actions.ts`: `requireAdmin()` first, the id parsed, then the same
`comment-moderation.ts` functions the reports inbox calls — so hiding or deleting from the
thread resolves the comment's open reports — and no `revalidatePath`, since the thread
refetches its own list. Gates: the admin section of `dev-discussion-gate.mts`
(`discussion-gate-admin.mts`), the replayed refusals in `dev-admin-gate.mts`, the nested
confirmation in `dev-dialog-a11y-gate.mts`.

### Page tags (#304)

A top-level comment may tag any page of the issue — a member
who notices something, reads on and comments later needn't flick back to tag it (this
brings "tag any page" forward from #305). Each reader says which pages are open
(`src/features/reader/use-current-pages.ts`) and hands the thread a `ReaderPages`
(`src/features/discussion/page-tags.ts`): the open ids, every page's number and first
heading by id, and a `go`. The flipbook's open pages are **both** halves of the spread, or
the cover alone — it can't know which half is being read, so it doesn't guess; the phone's
is the one section being read — the last whose top has passed the upper third of the
viewport, or the last of all at the column's end — measured at most once a frame on scroll
and not at all while the sheet is up (the column is locked). The composer's page pill
(`PageTagPicker`, the house `MenuSelect` at the "Posting as" pill's compact size) reads "Tag
a page" and opens a menu of "No page" and then every page in order — "The cover", "Page 2",
… — each with its first heading as a hint and the open page(s) marked "open now". From page
6 on, where the open pages would sit below the menu's first screen, they are also repeated
under "No page" (as distinct rows, so only the one chosen is ticked); nearer the front the
repeat would only duplicate the rows beneath it. The menu scrolls inside the panel. The
choice goes back to "No page" after each post. The two pills sit side by side as one group
with Post after them where the composer is at least 24rem wide (the desktop drawer), and on
a line of their own above Post where it is narrower (phones) — chosen by width, never by
the name's length, so the layout doesn't shift; the name truncates and the page pill has a
fixed maximum width. Replies are never tagged — the action refuses a `pageId` with a
`parentId` — and `createComment` refuses a page the issue no longer has ("That page is no
longer in this issue.").

The comment stores the page's **id, never its number**: page ids never move, while numbers
are positions — an overflow split (#128/#216) inserts a page and renumbers everything after
it, and deleting a page closes the gap. So the chip is named at render time from the issue
content the reader already holds — "Page 12", "The cover" for a cover at page 1 — and a page
no longer in the issue renders "Page removed", disabled. Deleting a page never touches the
comments that tag it. The chip is a 44px button ("Go to page 12"): on a computer it calls the
flipbook's `go` with the drawer left open (the thread announces "Now showing page 12."); on
a phone it closes the sheet and, once the sheet has gone and the browser has restored the
scroll of the entry the close went back to, scrolls the page's section to the top and
focuses it — each section is a `role="group"` named "Page 12", so a screen reader says where
it landed.

**The filter panel.** A funnel in the thread's header (beside the close button) opens a
disclosure panel, not a menu, so it stays open while the list changes under it. In the
drawer it is pinned between the header and the list; in the phone's sheet it heads the list
and scrolls with it (the funnel scrolls the list to the top), so with the keyboard up the
short sheet spends its height on the box, and Enter in the search moves focus onto the
status line, putting the keyboard away. The panel holds a **search** (words and posting
names, case-blind, each match marked in both; a matching reply keeps its thread and opens its
replies), **Show** — All comments, This page ("These pages" on a spread; it follows the
reader), My comments (the member's own, and those they replied under), or any page of the
issue by number and first heading — and **Sort**: oldest first, newest first, most replies.
The funnel carries the number of settings changed. Only the pages go to the server: Show →
a page asks the list route for `?page=` the id(s) (at most two, zod-checked) and
`listComments` keeps the top-level comments tagged to them, replies following their parent;
the search, My comments and the order work on the list already loaded (`thread-view.ts`).
While anything narrows the list, a status strip says what it holds — "3 comments on this
page", "No comments by you yet", "2 comments matching “roses”" (with a search or My comments
it counts the comments that match, replies included) — with **Show all** beside it; the
discussion button stays count-free. The view lives with the draft in `useDiscussion`, so it
survives closing the shell; a change of page asks again (the list shows its loading line
until the answer for the new pages arrives), and a post the view would hide (on another
page, or not matching the search) clears it so the new comment is in view, as an edit the
search no longer finds clears the search. Escape in a non-empty search, or on its clear
button, clears it rather than closing the shell. Neither the view nor the page is in the
address. Gate:
`discussion-gate-tags.mts`, `-phone.mts` and `-look.mts` (the two pills measured and
photographed at 440, 390 and 360 with a 40-character name, and the menu on a 42-page
issue), and `discussion-gate-filter.mts` (search, sort, My comments, a chosen page, a post
clearing the view), run by `dev-discussion-gate.mts`.

## Routes

| Route                                | Render        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                  | dynamic       | Library — the latest issue plus a capped run of recent back-issues (15), with a link to the archive once there are more. **Member session required**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/archive`                           | dynamic       | The full back catalogue (issue #192): every published issue, paginated (25/page) with a DB-side title search and a year filter; all three live in the URL (`?q=`, `?page=`, `?year=`) so refresh, back/forward and a shared link rebuild the same shelf. A `?year=` nothing was published in degrades to all years. **Member session required** (and ungated in demo mode, like `/` and the reader)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/read/[issueId]`                    | dynamic       | Reader, by issue **number**, published only. **Member session required**. With discussion on it carries the discussion button (issue #301); `?discussion=1[&comment=<id>]` opens the drawer or sheet on load                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/read/[issueId]/print`              | dynamic       | Internal print view for PDF generation — every page at full canvas size. **Not session-gated** (the localhost generator has no cookie); guarded by an internal token (`src/lib/pdf-token.ts`), 404 without it. Excluded from the edge gate. Stamps what it resolved into the document — the chrome fingerprint of its settings (`<meta name="print-chrome">`, issue #127) and the sponsor fingerprint of the sponsors it rendered (`<meta name="print-sponsors">`, issue #180); the generator refuses to return a PDF whose stamps aren't the ones the cache key names, so a settings edit, a sponsor edit/delete or a database blip between the two requests fails the download instead of caching bytes the key misdescribes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `/signin`                            | dynamic       | Email form; takes a validated same-origin `?next=` return path; doubles as the Auth.js error page (`?error=Verification` = expired link)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/signin/sent`                       | dynamic       | Neutral "check your email" — same answer whether or not the address is a member's (dynamic only so the CSP nonce reaches it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/unsubscribe`                       | dynamic       | One-click unsubscribe from the new-issue or reply email. **No session** — a signed `?token=` binds the user and the purpose; GET shows a confirm button, a POST toggles that one flag (see Publish → email)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/profile`                           | dynamic       | The member profile (issue #300): the names they post under (add / rename / remove — a name with comments is retired, the last one stays), a photo per name, an admin-only badge per name, and both email toggles (new issues, replies). The Names section and the reply toggle show only while discussion is on. **Member session required**; every write is a server action that takes the account from the session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/preferences`                       | route handler | 308 to `/profile` — the old email-preferences page (#86), kept because its address is already in inboxes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/api/auth/*`                        | route handler | Auth.js (sign-in POST, magic-link callback, session); a failed emailed link's redirect keeps its destination as `?next=`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/admin`                             | dynamic       | Issue dashboard. Paginated (25/page) with a DB-side title search, a status filter (draft / published) and a year filter built from the years that actually have published issues; all four live in the URL (`?q=`, `?filter=`, `?year=`, `?page=`) so the view survives refresh and `revalidatePath`. Rows carry checkboxes: a selection survives paging, searches and filters, "select all N matching" reaches past the served page (capped, see `src/features/admin/selection-limit.ts`), and the one bulk action — delete — confirms with the total and the published subset before running the same per-issue asset cleanup the single delete does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/admin/issues/[id]/edit`            | dynamic       | Editor, by issue **id**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/admin/issues/[id]/preview`         | dynamic       | Draft preview (renders the reader by internal id; drafts never appear at `/read`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/admin/members`                     | dynamic       | Members CRUD on the `users` table: add / remove / toggle subscribed / toggle admin / CSV import (guard rails: no self-removal, keep one admin). List is paginated (25/page) with a DB-side search and status filters (admins / subscribed / unsubscribed); all three live in the URL (`?q=`, `?page=`, `?filter=`) so the view survives refresh and `revalidatePath`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/admin/sponsors`                    | dynamic       | Sponsors CRUD on the `sponsors` table (content v2): add / edit / delete a managed sponsor — logo (through the shared upload pipeline), link, optional `activeUntil` (advisory — flags the row as expired, never pulls the sponsor from an issue). Sponsor blocks reference a row by id; deleting one hides that slot in the reader and leaves the editor's block to be re-picked. The list is paginated (25/page) with a DB-side name search and an all / active / expired filter, both in the URL (`?q=`, `?filter=`, `?page=`) — same controls and contract as the members list, with no selection or bulk actions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/admin/reports`                     | dynamic       | Reports inbox (issue #302): each report’s snapshot beside the comment as it is now, with Hide/Unhide, Delete, Resolve, Clear avatar and Retire name; hiding or deleting resolves every open report on the comment. Paginated (25/page) with a DB-side search (comment, posting name, reporter) and an open / resolved / all filter (default open), all in the URL (`?q=`, `?filter=`, `?page=`). The admin nav shows the open count                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/admin/magazine`                    | dynamic       | Magazine details (issue #105): a resizable split — the settings form (the owner-editable branding text, the page-top running-head switch of issue #269, the page-footer appearance, the PDF-download switch of issue #162, and the discussion switch and removed-member choice of issue #302, one form under one Save) and the logo library (named club marks, transparent PNG/WebP, through the shared image pipeline: upload / rename / delete, applied immediately rather than on Save) — beside a live preview built from the real `PageFrame`/`PageFooter`. Delete refuses while the logo is referenced (`countLogoReferences` in `src/server/logos.ts`). `/admin/logos` 308s here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/admin/ai`                          | dynamic       | Assistant usage (issue #314), read-only: the month's spend, what's left and the allowance (with the month's top-ups) from `resolveBudget()`, a one-line note (messages answered and their average cost, what happens when the allowance runs out), and a day-by-day table (runs, requests, tokens — all four counts — and cost; newest first; the month's total at the foot) from `usageByDay()`. `?month=YYYY-MM` in the URL picks the month (house month picker from the ledger's first month to now; malformed or future reads as this month). Spend rounds up to the cent and what's left rounds down, so the three figures add up. Renders with "The assistant is not enabled on this site." while `AI_PROVIDER` is unset; the sidebar's **Assistant** entry and `/admin/magazine` link to it only while it is set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/admin/help`                        | dynamic       | In-app guide for a non-technical owner (plain-language walkthrough of issues/publishing/members/sponsors/PDF; content in `src/features/help/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `POST /api/admin/images`             | route handler | Upload: multipart → sniff real format (SVG rejected) → sharp WebP → storage → `images` row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `POST /api/profile/avatar?name=`     | route handler | A member's avatar (issue #300), the one upload a non-admin can make: session, same origin, discussion on, the name must be the session's own (a foreign id gets the same answer as an unknown one), ≤ 5 MB read no further, the bytes sniffed, 5 per hour per member — then decoded by sharp, centre-cropped to a 256px WebP, stored, recorded with no issue and set on the name, whose previous photo row and object go in the same step. A failure after the bytes are stored removes them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `POST /api/admin/issues/export`      | route handler | Issue transfer (issue #293): the selected issues as a streamed zip — content, images, and the sponsors and logos they reference. Refusals come back as JSON so the bulk bar can say what to deselect; a row or object that is genuinely gone is left out and counted in `X-Issue-Export-Omitted`, while a storage read error fails the export outright rather than ship a bundle with holes in it. See `docs/issue-transfer.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `POST /api/admin/issues/import/plan` | route handler | Write-free look-ahead for the import modal: which bundled titles already exist here, and which library names will be reused, created or are ambiguous. A courtesy only — the import re-derives all of it from the archive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST /api/admin/issues/import`      | route handler | The bundle as the raw request body, with the operation id and decisions in a bounded `X-Issue-Import` header; answers newline-delimited JSON (a phase line, then the result). **Excluded from the proxy matcher** — Next buffers every proxied body and silently truncates it at 10 MB. Validates everything before writing, writes objects under `imports/<operationId>/`, then commits every row in one transaction; a failure deletes that prefix, and the `issue_imports` record makes a retry with the same operation id return the recorded result instead of a second set of drafts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `POST /api/admin/ai/chat`            | route handler | The AI assistant's proxy (issue #308, epic #306): admin + same origin (403 JSON), **404 while `AI_PROVIDER` is unset**, a draft only (409). Streams the model's reply and tool calls as the AI SDK's UI message stream; the tools run in the editor, which sends their results on the next request. Refuses when the month's budget is spent or the run has cost $0.50 (402), and past 300 requests or 20 runs per admin per 10 minutes (429). Every request writes an `ai_usage` row. Contract, limits and failure copy: [`docs/ai-assistant.md`](ai-assistant.md) → The chat route                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `GET /api/admin/ai/usage`            | route handler | The month's assistant spend (issue #309): admin-only (403 JSON), 404 while `AI_PROVIDER` is unset, `{ month, allowance, granted, spent, remaining }` from `resolveBudget()`, plus the `model` a long paste's cost is estimated on (#312; the fake provider is estimated as the default model), no-store. The editor panel's footer, its budget-spent state and the long-paste question read it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `GET /api/issues/[number]/comments`  | route handler | An issue's discussion thread for the reader (issue #301): members only (401 signed out, demo's visitor included), 403 while discussion is off, 404 for anything but a published issue; `no-store`. The thread shaped for the viewer — admins see the account behind a name — plus the composer's names. Fetched when the drawer or sheet opens and after each write. `?page=<id>` (once, or twice for a spread; 400 past two) keeps the comments tagged to those pages (#304)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `GET /api/images/[...key]`           | route handler | Serves the local dev storage fallback (unused when R2 is set)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `GET /api/issues/[number]/pdf`       | route handler | **Member session required, and refused with 403 when the owner has switched PDF downloads off** (issue #162 — `settings.pdfDownloads`, checked right after the member check; applies in demo mode too, since it is a distribution choice rather than an auth gate). On-demand PDF: serves the cached bytes (`pdfs/{issueId}/{revision}-{theme}-{logoId}-{chrome}-{sponsors}-v{N}.pdf` — `?theme=` follows the reader's toggle; `{logoId}`, `{chrome}` and `{sponsors}` are the three render inputs `revision` doesn't cover (the issue's footer mark; a short hash of the magazine settings that reach a printed page — name, org, footer mark/text size and alignment, and the running-head switch (issue #269), with the tagline deliberately excluded since it never prints, see `chromeFingerprint` in `src/server/settings.ts`; and a short hash of the managed sponsors this issue's blocks reference as they resolve now — name, href, logo URL and whether the sponsor still exists, so renaming, relinking, relogoing or deleting one re-keys instead of serving a PDF that goes on advertising it, see `sponsorFingerprint` in `src/server/sponsors.ts`); `v{N}` is the code-side render version), else generates via Playwright, caches, serves. Bytes proxied (not a public URL) so the PDF stays members-only |

The admin dashboard route group owns the sidebar layout; its loading and error states
replace only the main content. Only the navigation links track the pathname for their
active state. The content pane returns to the top when the pathname changes, including
browser history; query-only list changes and in-page anchors keep their own scrolling.
The editor and preview stay outside this shell. Pages still check admin
authorization on each request, because shared layouts persist across client navigation.

Route-level `loading.tsx`/`error.tsx` cover `/`, `/archive`, `/read/[issueId]` and `/admin/*`. Static
security headers (`nosniff`, `X-Frame-Options`, referrer/permissions policies) are set globally
in `next.config.ts`; the CSP is set per request in `src/proxy.ts`, where `script-src` gets
a fresh nonce (+ `'strict-dynamic'`) instead of `'unsafe-inline'`. Body text is stored as
structured JSON and rendered through React (content v3 — no `dangerouslySetInnerHTML`, no HTML
sanitiser; see `src/lib/rich-text-doc.ts` + `src/features/blocks/rich-text.tsx`), so the nonce CSP
is now defence in depth rather than the sole XSS backstop.

DB-backed routes set `export const dynamic = "force-dynamic"` so they always read fresh and aren't
prerendered at build. **Everything except `/signin` and `/unsubscribe` is gated**: the library,
reader and `/profile` require a member session, `/admin` and every mutation require an admin — see below.
`/unsubscribe` is deliberately ungated (it arrives in email, before any session) and authorises
itself with a signed token instead. The site stays noindex
globally (nothing public to crawl). **Demo mode** (`NEXT_PUBLIC_DEMO_MODE=1`, issue #50) is the one
exception to the member gate — see Auth.

## Auth

Magic-link only (no passwords, no OAuth), built on Auth.js v5 with **database sessions**
(~90-day maxAge — the audience is older and non-technical). The pieces, all in `src/server/`:

- `auth.ts` — the Auth.js config. The `signIn` callback only lets emails that already have a
  `users` row through (membership = presence on the list), and it runs before any token is
  written, so an unknown email leaves nothing in the DB. The `session` callback exposes
  `user.id`/`user.isAdmin` to the app.
- `auth-adapter.ts` — hand-rolled adapter over `users`/`sessions`/`verification_tokens`
  (`@auth/drizzle-adapter` doesn't fit: its types predate drizzle-orm 1.0 and it requires the
  OAuth `accounts` table this app will never have).
- `auth-email.ts` — the branded email. Dev always logs the link to the console (testable with no
  Resend account); with `EMAIL_API_KEY` set it sends via Resend, and a send failure is fatal in
  production but only a warning in dev.
- `session.ts` — `getSession()` / `getUser()` (request-deduped) plus the gates, all fail closed
  (a session lookup error reads as signed out): `getAdminUser()` is the single admin-or-not
  decision, `requireAdmin()` throws on top of it, `requireAdminOrRedirect()` covers /admin pages,
  and `requireMemberOrRedirect(next)` covers the library and reader — it sends signed-out
  visitors to `/signin?next=<path>` so the emailed link lands them back on the issue they
  clicked. **Every server action in `app/admin/actions.ts` and `POST /api/admin/images` calls
  the gate first** — layouts only cover page navigations, but a server action can be invoked
  directly by any client that knows its id, so the check lives inside each action.
  `?next=` is validated to a same-origin path (`signin/next-path.ts`) — no open redirects.

The `/signin` flow never reveals membership: known and unknown emails both land on
`/signin/sent`, and an expired or already-used link comes back to `/signin` with a
"request a fresh one" message, not an error dump.

### Demo mode

A build-time flag (`NEXT_PUBLIC_DEMO_MODE=1`, issue #50) turns the site into a public,
ungated showcase without touching the code paths that protect authoring. It lives in one
constant, [`src/lib/demo.ts`](../src/lib/demo.ts): `NEXT_PUBLIC_*` is inlined at build time,
so **both gate layers read the same value and cannot disagree at runtime** — the edge
`isGatedRoute()` (`src/proxy.ts`) drops `/`, `/archive` and `/read/*` from the gate, and
`requireMemberOrRedirect()` returns `null` for an anonymous visitor instead of redirecting
(the type change forces every member page to decide its signed-in affordances for a guest).
**`/admin/*`, every server action and `POST /api/admin/images` stay locked** — `getAdminUser()`
and the admin gates ignore the flag. The PDF endpoint follows the reader: since the reader is
public in demo, `GET /api/issues/[number]/pdf` allows an anonymous download (the R2 cache bounds
generation cost). Auth stays effectively dormant — a magic link only sends to an email that
already exists in the demo DB's `users` table, and the publish blast still needs an admin
session — but the email keys must stay set (`env.ts` requires them to boot in production);
they're what lets the owner sign into the still-gated `/admin` on the demo.
**Never set this on the real members' site.**

## Environment

Server env is validated in [`src/lib/env.ts`](../src/lib/env.ts).

**Branding is no longer env-driven** (issue #105). The magazine's name, club name and tagline —
plus the running footer's mark size, type size and alignment, whether a theme may print its textual
running head above the page content (issue #269) and whether members are offered the
PDF download at all (issue #162) — live in the single-row `settings`
table the owner edits at `/admin/magazine`, and are resolved per request by
[`src/server/settings.ts`](../src/server/settings.ts) (`getSettings()`, React-`cache()`d).
The three `NEXT_PUBLIC_*` branding vars are now only the **bootstrap defaults** underneath it:
`effective = DB value → env var → shipped default`. [`src/lib/site-defaults.ts`](../src/lib/site-defaults.ts)
is that fallback layer and the settings resolver is its only reader — no component, route or email
reads branding from `process.env`. A deployment that never opens the page renders exactly from its
env as before. The footer look and the two switches have no env var at all — their defaults
are code constants (`DEFAULT_FOOTER_STYLE`, `DEFAULT_SHOW_RUNNING_HEAD`, `DEFAULT_PDF_DOWNLOADS`),
i.e. the behaviour the code shipped with. Note the one asymmetry the download switch introduces: because a read failure
degrades every field to its default and that default is _enabled_, the switch **fails open**
(deliberately — see the comment on `DEFAULT_PDF_DOWNLOADS`; the members-only check beside it on the
route still fails closed).

**The footer's height is clamped per issue** (issue #128). The footer settings are global and the
page's text limit is fixed when the page is authored (the editor measures against the footer's top
edge; content never reflows at read time), so a footer the owner later makes _taller_ would print
over the last lines of pages already filled to the old limit. Each issue therefore records the
footer sizes its pages were laid out against — `issues.footerMarkSize` / `footerTextSize`, its
**reserve** — and every surface that draws a footer resolves
`settingsForIssue(settings, issue)` ([`src/lib/branding.ts`](../src/lib/branding.ts)) instead of
using the global footer directly: reader, mobile closer, editor canvas, the print document,
and the PDF cache key's chrome fingerprint. Covers omit the running footer in every page
renderer, including thumbnails. Covers retain theme decoration unless disabled in cover settings;
full-bleed covers default to no decoration but allow an explicit override. Interior full-bleed pages omit both.
A _smaller_ footer always applies at once (it can only free space); a larger one applies to the issues with room for it and waits on the rest
until the author adopts it in the editor, where the overflow marker catches what no longer fits
(`adoptFooterAction`). There is no room to solve this by growing the footer downward instead — the
page's bottom margin is 22px (classic) / 16px (modern) against a 12–48px mark range. Both sizes are
whole px (issue #216): the Small/Medium/Large presets are 18/27/36 (mark) and 9/10/12 (type), and
Custom takes any value within the caps (mark 12–48, type 8–16) — so the reserve clamp is
`Math.min` per axis and the footer sets its height and type size as inline styles.

Local values live in `.env.local` (git-ignored); production values are set in Railway.
`.env.example` lists every key.

| Var                                                    | Required now  | Purpose                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                         | yes           | Postgres connection                                                                                                                                                                                                            |
| `NEXT_PUBLIC_MAGAZINE_NAME` / `_ORG_NAME` / `_TAGLINE` | no (defaults) | Branding text **bootstrap defaults only** — the owner overrides them at `/admin/magazine` and the DB value wins (issue #105). Build-time inlined, so changing these still needs a rebuild; changing them in the admin does not |
| `NEXT_PUBLIC_BRAND`                                    | no (default)  | Brand skin / palette (`heritage` default); build-time inlined, unknown value fails at boot (`brands.css`)                                                                                                                      |
| `NEXT_PUBLIC_ISSUE_THEMES`                             | no (all)      | Comma list of layout themes the editor/reader offer (`classic,modern`); build-time inlined, validated                                                                                                                          |
| `NEXT_PUBLIC_DEMO_MODE`                                | no (off)      | `1` ungates the library + reader for a public showcase deploy (see Auth); build-time inlined, never on the real site                                                                                                           |
| `AUTH_SECRET`                                          | dev: yes      | Auth.js token/cookie signing + unsubscribe-token key (required in prod by env.ts)                                                                                                                                              |
| `AUTH_URL`                                             | prod: yes     | Public origin Auth.js stamps into the **sign-in** magic link (e.g. `https://demo.octavo.dev`); unset, it derives from the request Host and can emit the container's internal address (`localhost:PORT`)                        |
| `APP_URL`                                              | no (fallback) | Canonical origin for the links in the publish blast, unsubscribe and the reply/report emails — _not_ sign-in (`AUTH_URL`); the blast falls back to the request Host, the reply/report emails are skipped without it in prod    |
| `EMAIL_API_KEY`, `EMAIL_FROM`                          | no in dev     | Resend; unset in dev = links only in console (required in prod)                                                                                                                                                                |
| `R2_*`                                                 | no in dev     | Object storage (required in prod)                                                                                                                                                                                              |

## What's real vs stubbed

Real: the editor authors and autosaves to the DB; the reader/library/dashboard render real data;
images upload to R2 and render in both editor and reader; magic-link sign-in with database
sessions, and every route/mutation is gated (members read, admins author); the admin manages the
real member list (the `users` table) with add / remove / toggle subscribed / toggle admin / CSV
import; publishing an issue emails every subscribed member a personal magic link (the new-issue
email _is_ the sign-in link), with a signed one-click unsubscribe; **PDF export** prints the
fixed-canvas pages to a paginated PDF via headless Chromium (Playwright), cached in R2 by issue
id + revision and served members-only (see [infrastructure.md](infrastructure.md#pdf-generation)).

The phase sequence lives in [ROADMAP.md](ROADMAP.md); work is tracked as GitHub issues (one
milestone per phase).

## Docs

- [database.md](database.md) — schema, content model, migrations, seeding.
- [design-principles.md](design-principles.md) — engineering + design rules (read before changes).
- [ROADMAP.md](ROADMAP.md) — phase ordering, product decisions, open questions.
- [infrastructure.md](infrastructure.md) — hosting components, setup order, costs.
- [issue-transfer.md](issue-transfer.md) — the export/import bundle format and its rules.
