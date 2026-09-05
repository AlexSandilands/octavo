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
    admin/             dashboard, members, sponsors, magazine (branding + logo
                       library), help (the in-app guide)
      actions.ts       server actions (mutations)
      issues/[id]/edit editor (standalone full-screen)
    api/admin/images/  image upload route handler (multipart → sharp → R2)
    api/admin/video-poster/  captures a YouTube poster frame into that same
                       pipeline (the app's only outbound fetch)
  components/          shared presentational UI (ui.tsx, icons.tsx, admin-shell, ...)
  features/            feature modules with their own UI/logic
    admin/             the issues dashboard list (client): search + filters,
                       row selection across pages, the bulk delete bar
    blocks/            BlockView — themed block renderer (+ the montage and
                       video widgets); page-frame + page-footer — page chrome
    magazine/          the magazine-details settings form + its live page preview
    editor/            the page-based editor (client) + per-block edit controls
    reader/            desktop-reader, mobile-reader (client)
    members/           members manager (client): table, toolbar, add/import dialogs
    library/           the member-facing library: masthead, latest-issue hero,
                       the cover shelf (archive-grid) and the /archive controls
  db/                  Drizzle schema, client, seed
  lib/                 framework-agnostic helpers
    blocks.ts          the canonical content model (zod + types)
    images.ts          ImageMap type + content imageId traversal
    storage.ts         storage facade: R2 if configured, else local disk —
                       put/get/delete one key, and list/delete a folder prefix
    r2.ts              R2/S3 client (server-only): upload, keyToUrl
    local-storage.ts   dev fallback: .data/uploads on the filesystem
    image-processing.ts sharp: normalise uploads to WebP
    branding.ts        magazine settings: types, the three-step size/align
                       scales, and the pure stored+defaults → effective resolver
    site-defaults.ts   the NEXT_PUBLIC_* branding fallbacks (read only by
                       server/settings.ts — nothing else may)
    env.ts             validated server env
    id.ts              id generator
  server/              server-only data access (issues.ts, users.ts, images.ts) and auth
    auth.ts            Auth.js config: provider, callbacks, session shape
    auth-adapter.ts    hand-rolled Auth.js adapter over the users/sessions tables
    auth-email.ts      the magic-link email (template + Resend/console transport)
    issue-email.ts     the new-issue announcement email (template only)
    publish-email.ts   publish blast: mints per-member magic links + batch-sends
    recipients.ts      mailing-list data access (subscribed members, un/resubscribe)
    unsubscribe-token.ts  HMAC-signed, session-less unsubscribe tokens
    settings.ts        the magazine settings: cached per-request resolve, the
                       admin update, and the PDF chrome fingerprint
    asset-cleanup.ts   the asset lifecycle: which images anything still
                       references, and the post-commit storage sweep the
                       issue/sponsor/logo deletes run (see database.md)
    session.ts         getSession()/getUser() — how the app reads who's signed in
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
facade vs. the poster frame plus the address in printable text).

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

## Data flow

```
Editor (client state)
  └─ debounced autosave ─▶ server action (app/admin/actions.ts, zod-validated)
                              └─▶ data layer (server/issues.ts) ─▶ Postgres (issues.content JSONB)

Reader / library / dashboard (server components)
  └─ data layer (server/issues.ts) ─▶ Postgres ─▶ rendered via shared block renderers

Publish → email blast (publishIssueAction, admin only)
  └─ publishIssue() ─▶ Postgres (status=published)
  └─ if "email members" chosen: server/publish-email.ts
       ├─ per member: mint an Auth.js verification token (same mechanism as
       │  sign-in) targeting /read/[number]  ─▶ verification_tokens
       └─ render + batch-send via Resend (console in dev)  ─▶ {sent, failed} → admin
```

### Publish → email (the core loop)

Publishing an issue optionally emails every subscribed member. **The email _is_ the
magic link**: its "Read issue" button is a per-member Auth.js sign-in link with a
`callbackUrl` of `/read/[number]`, so clicking it signs the member in and lands them on
the new issue — no separate log-in step. Links are minted through the **same
verification-token path as the sign-in email** (`server/publish-email.ts` replicates
`@auth/core`'s token: raw value in the URL, `sha256(token+AUTH_SECRET)` stored, deleted
on first use), so they carry the same 24h expiry and single-use guarantee. The send runs
_after_ the publish commits and never throws — a mail failure leaves the issue published
and reports a `{sent, failed}` count to the admin (chunked 100/batch per Resend's limit;
a failed chunk is counted, not fatal). Re-publishing an already-live issue defaults the
email **off** so a correction can't re-blast the list.

Each email also carries a **signed unsubscribe link** (`server/unsubscribe-token.ts`):
an HMAC over the user id under a key derived from `AUTH_SECRET`, verified in constant
time. It needs no session (it arrives in email), can't be forged for another user, and
mutates only via a POSTed confirm button so an email scanner's GET prefetch can't
unsubscribe anyone. The `/unsubscribe` route sits outside the member gate by design.

- **Server Components by default.** `"use client"` only for interactivity (editor, readers, members
  table). Keep client islands at the leaves.
- **All DB access goes through `src/server/issues.ts`** (marked `server-only`). Never query Drizzle
  from a component.
- **Mutations are Server Actions** in `src/app/admin/actions.ts`, validated with zod at the boundary
  (ids, meta and the whole content document) so adding auth later is just a gate, not a rewrite.
- **Content saves are optimistically concurrent**: each save carries the `revision` it was based on
  and the DB rejects stale writes, so a second tab (or an out-of-order autosave) surfaces a visible
  conflict in the editor instead of silently overwriting newer work. The editor serialises its saves
  through one promise chain and shows save failures with a retry.

## Routes

| Route                          | Render        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | dynamic       | Library — the latest issue plus a capped run of recent back-issues (15), with a link to the archive once there are more. **Member session required**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/archive`                     | dynamic       | The full back catalogue (issue #192): every published issue, paginated (25/page) with a DB-side title search and a year filter; all three live in the URL (`?q=`, `?page=`, `?year=`) so refresh, back/forward and a shared link rebuild the same shelf. A `?year=` nothing was published in degrades to all years. **Member session required** (and ungated in demo mode, like `/` and the reader)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/read/[issueId]`              | dynamic       | Reader, by issue **number**, published only. **Member session required**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/read/[issueId]/print`        | dynamic       | Internal print view for PDF generation — every page at full canvas size. **Not session-gated** (the localhost generator has no cookie); guarded by an internal token (`src/lib/pdf-token.ts`), 404 without it. Excluded from the edge gate. Stamps what it resolved into the document — the chrome fingerprint of its settings (`<meta name="print-chrome">`, issue #127) and the sponsor fingerprint of the sponsors it rendered (`<meta name="print-sponsors">`, issue #180); the generator refuses to return a PDF whose stamps aren't the ones the cache key names, so a settings edit, a sponsor edit/delete or a database blip between the two requests fails the download instead of caching bytes the key misdescribes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `/signin`                      | dynamic       | Email form; takes a validated same-origin `?next=` return path; doubles as the Auth.js error page (`?error=Verification` = expired link)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/signin/sent`                 | dynamic       | Neutral "check your email" — same answer whether or not the address is a member's (dynamic only so the CSP nonce reaches it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/unsubscribe`                 | dynamic       | One-click unsubscribe from the new-issue email. **No session** — a signed `?token=` binds the user; GET shows a confirm button, a POST toggles the flag (see Publish → email)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/api/auth/*`                  | route handler | Auth.js (sign-in POST, magic-link callback, session)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/admin`                       | dynamic       | Issue dashboard. Paginated (25/page) with a DB-side title search, a status filter (draft / published) and a year filter built from the years that actually have published issues; all four live in the URL (`?q=`, `?filter=`, `?year=`, `?page=`) so the view survives refresh and `revalidatePath`. Rows carry checkboxes: a selection survives paging, searches and filters, "select all N matching" reaches past the served page (capped, see `src/features/admin/selection-limit.ts`), and the one bulk action — delete — confirms with the total and the published subset before running the same per-issue asset cleanup the single delete does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/admin/issues/[id]/edit`      | dynamic       | Editor, by issue **id**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/admin/issues/[id]/preview`   | dynamic       | Draft preview (renders the reader by internal id; drafts never appear at `/read`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/admin/members`               | dynamic       | Members CRUD on the `users` table: add / remove / toggle subscribed / toggle admin / CSV import (guard rails: no self-removal, keep one admin). List is paginated (25/page) with a DB-side search and status filters (admins / subscribed / unsubscribed); all three live in the URL (`?q=`, `?page=`, `?filter=`) so the view survives refresh and `revalidatePath`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/admin/sponsors`              | dynamic       | Sponsors CRUD on the `sponsors` table (content v2): add / edit / delete a managed sponsor — logo (through the shared upload pipeline), link, optional `activeUntil` (advisory — flags the row as expired, never pulls the sponsor from an issue). Sponsor blocks reference a row by id; deleting one hides that slot in the reader and leaves the editor's block to be re-picked. The list is paginated (25/page) with a DB-side name search and an all / active / expired filter, both in the URL (`?q=`, `?filter=`, `?page=`) — same controls and contract as the members list, with no selection or bulk actions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/admin/magazine`              | dynamic       | Magazine details (issue #105): a resizable split — the settings form (the owner-editable branding text, the page-footer appearance, and the PDF-download switch of issue #162, one form under one Save) and the logo library (named club marks, transparent PNG/WebP, through the shared image pipeline: upload / rename / delete, applied immediately rather than on Save) — beside a live preview built from the real `PageFrame`/`PageFooter`. Delete refuses while the logo is referenced (`countLogoReferences` in `src/server/logos.ts`). `/admin/logos` 308s here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/admin/help`                  | dynamic       | In-app guide for a non-technical owner (plain-language walkthrough of issues/publishing/members/sponsors/PDF; content in `src/features/help/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `POST /api/admin/images`       | route handler | Upload: multipart → sniff real format (SVG rejected) → sharp WebP → storage → `images` row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `GET /api/images/[...key]`     | route handler | Serves the local dev storage fallback (unused when R2 is set)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `GET /api/issues/[number]/pdf` | route handler | **Member session required, and refused with 403 when the owner has switched PDF downloads off** (issue #162 — `settings.pdfDownloads`, checked right after the member check; applies in demo mode too, since it is a distribution choice rather than an auth gate). On-demand PDF: serves the cached bytes (`pdfs/{issueId}/{revision}-{theme}-{logoId}-{chrome}-{sponsors}-v{N}.pdf` — `?theme=` follows the reader's toggle; `{logoId}`, `{chrome}` and `{sponsors}` are the three render inputs `revision` doesn't cover (the issue's footer mark; a short hash of the magazine settings that reach a printed page — name, org, footer mark/text size and alignment, tagline deliberately excluded since it never prints, see `chromeFingerprint` in `src/server/settings.ts`; and a short hash of the managed sponsors this issue's blocks reference as they resolve now — name, href, logo URL and whether the sponsor still exists, so renaming, relinking, relogoing or deleting one re-keys instead of serving a PDF that goes on advertising it, see `sponsorFingerprint` in `src/server/sponsors.ts`); `v{N}` is the code-side render version), else generates via Playwright, caches, serves. Bytes proxied (not a public URL) so the PDF stays members-only |

Route-level `loading.tsx`/`error.tsx` cover `/`, `/archive`, `/read/[issueId]` and `/admin/*`. Static
security headers (`nosniff`, `X-Frame-Options`, referrer/permissions policies) are set globally
in `next.config.ts`; the CSP is set per request in `src/proxy.ts`, where `script-src` gets
a fresh nonce (+ `'strict-dynamic'`) instead of `'unsafe-inline'`. Body text is stored as
structured JSON and rendered through React (content v3 — no `dangerouslySetInnerHTML`, no HTML
sanitiser; see `src/lib/rich-text-doc.ts` + `src/features/blocks/rich-text.tsx`), so the nonce CSP
is now defence in depth rather than the sole XSS backstop.

DB-backed routes set `export const dynamic = "force-dynamic"` so they always read fresh and aren't
prerendered at build. **Everything except `/signin` and `/unsubscribe` is gated**: the library and
reader require a member session, `/admin` and every mutation require an admin — see below.
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
plus the running footer's mark size, type size and alignment, and whether members are offered the
PDF download at all (issue #162) — live in the single-row `settings`
table the owner edits at `/admin/magazine`, and are resolved per request by
[`src/server/settings.ts`](../src/server/settings.ts) (`getSettings()`, React-`cache()`d).
The three `NEXT_PUBLIC_*` branding vars are now only the **bootstrap defaults** underneath it:
`effective = DB value → env var → shipped default`. [`src/lib/site-defaults.ts`](../src/lib/site-defaults.ts)
is that fallback layer and the settings resolver is its only reader — no component, route or email
reads branding from `process.env`. A deployment that never opens the page renders exactly from its
env as before. The footer look and the PDF-download switch have no env var at all — their defaults
are code constants (`DEFAULT_FOOTER_STYLE`, `DEFAULT_PDF_DOWNLOADS`), i.e. the behaviour the code
shipped with. Note the one asymmetry the download switch introduces: because a read failure
degrades every field to its default and that default is _enabled_, the switch **fails open**
(deliberately — see the comment on `DEFAULT_PDF_DOWNLOADS`; the members-only check beside it on the
route still fails closed).

**The footer's height is clamped per issue** (issue #128). The footer settings are global and the
page's text limit is fixed when the page is authored (the editor measures against the footer's top
edge; content never reflows at read time), so a footer the owner later makes _taller_ would print
over the last lines of pages already filled to the old limit. Each issue therefore records the
footer sizes its pages were laid out against — `issues.footerMarkSize` / `footerTextSize`, its
**reserve** — and every surface that draws a page resolves
`settingsForIssue(settings, issue)` ([`src/lib/branding.ts`](../src/lib/branding.ts)) instead of
using the global footer directly: reader, mobile closer, editor canvas, cover thumbnails, the print
document, and the PDF cache key's chrome fingerprint. A _smaller_ footer always applies at once (it
can only free space); a larger one applies to the issues with room for it and waits on the rest
until the author adopts it in the editor, where the overflow marker catches what no longer fits
(`adoptFooterAction`). There is no room to solve this by growing the footer downward instead — the
page's bottom margin is 22px (classic) / 16px (modern) against a 12–48px mark range. Both sizes are
whole px (issue #216): the Small/Medium/Large presets are 18/27/36 (mark) and 9/10/12 (type), and
Custom takes any value within the caps (mark 12–48, type 8–14) — so the reserve clamp is
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
| `APP_URL`                                              | no (fallback) | Canonical origin for the **publish-blast** and **unsubscribe** links only — _not_ the sign-in link (that's `AUTH_URL`); falls back to the request Host when unset                                                              |
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
