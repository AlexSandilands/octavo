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
| Framework      | Next.js 15 (App Router), React 19, TypeScript                                     |
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
    page.tsx           library (published issues)
    signin/            magic-link entry: form + action, sent/ confirmation
    read/[issueId]/    reader — desktop flipbook + mobile scroll
    admin/             dashboard, members, sponsors, help (the in-app guide)
      actions.ts       server actions (mutations)
      issues/[id]/edit editor (standalone full-screen)
    api/admin/images/  image upload route handler (multipart → sharp → R2)
  components/          shared presentational UI (ui.tsx, icons.tsx, admin-shell, ...)
  features/            feature modules with their own UI/logic
    blocks/            BlockView — themed read-only block renderer
    editor/            the page-based editor (client) + per-block edit controls
    reader/            desktop-reader, mobile-reader (client)
    members/           members manager (client): table, toolbar, add/import dialogs
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
  server/              server-only data access (issues.ts, users.ts, images.ts) and auth
    auth.ts            Auth.js config: provider, callbacks, session shape
    auth-adapter.ts    hand-rolled Auth.js adapter over the users/sessions tables
    auth-email.ts      the magic-link email (template + Resend/console transport)
    issue-email.ts     the new-issue announcement email (template only)
    publish-email.ts   publish blast: mints per-member magic links + batch-sends
    recipients.ts      mailing-list data access (subscribed members, un/resubscribe)
    unsubscribe-token.ts  HMAC-signed, session-less unsubscribe tokens
    session.ts         getSession()/getUser() — how the app reads who's signed in
scripts/               dev-only helpers (not part of the app), e.g. the headless
                       magic-link flow check (dev-auth-flow.mts)
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

| Route                          | Render        | Notes                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | dynamic       | Library — published issues. **Member session required**                                                                                                                                                                                                                                                           |
| `/read/[issueId]`              | dynamic       | Reader, by issue **number**, published only. **Member session required**                                                                                                                                                                                                                                          |
| `/read/[issueId]/print`        | dynamic       | Internal print view for PDF generation — every page at full canvas size. **Not session-gated** (the localhost generator has no cookie); guarded by an internal token (`src/lib/pdf-token.ts`), 404 without it. Excluded from the edge gate                                                                        |
| `/signin`                      | dynamic       | Email form; takes a validated same-origin `?next=` return path; doubles as the Auth.js error page (`?error=Verification` = expired link)                                                                                                                                                                          |
| `/signin/sent`                 | dynamic       | Neutral "check your email" — same answer whether or not the address is a member's (dynamic only so the CSP nonce reaches it)                                                                                                                                                                                      |
| `/unsubscribe`                 | dynamic       | One-click unsubscribe from the new-issue email. **No session** — a signed `?token=` binds the user; GET shows a confirm button, a POST toggles the flag (see Publish → email)                                                                                                                                     |
| `/api/auth/*`                  | route handler | Auth.js (sign-in POST, magic-link callback, session)                                                                                                                                                                                                                                                              |
| `/admin`                       | dynamic       | Issue dashboard                                                                                                                                                                                                                                                                                                   |
| `/admin/issues/[id]/edit`      | dynamic       | Editor, by issue **id**                                                                                                                                                                                                                                                                                           |
| `/admin/issues/[id]/preview`   | dynamic       | Draft preview (renders the reader by internal id; drafts never appear at `/read`)                                                                                                                                                                                                                                 |
| `/admin/members`               | dynamic       | Members CRUD on the `users` table: add / remove / toggle subscribed / toggle admin / CSV import (guard rails: no self-removal, keep one admin)                                                                                                                                                                    |
| `/admin/sponsors`              | static        | Sponsors = placeholder                                                                                                                                                                                                                                                                                            |
| `/admin/help`                  | dynamic       | In-app guide for a non-technical owner (plain-language walkthrough of issues/publishing/members/sponsors/PDF; content in `src/features/help/`)                                                                                                                                                                    |
| `POST /api/admin/images`       | route handler | Upload: multipart → sniff real format (SVG rejected) → sharp WebP → storage → `images` row                                                                                                                                                                                                                        |
| `GET /api/images/[...key]`     | route handler | Serves the local dev storage fallback (unused when R2 is set)                                                                                                                                                                                                                                                     |
| `GET /api/issues/[number]/pdf` | route handler | **Member session required.** On-demand PDF: serves the cached bytes (`pdfs/{issueId}/{revision}-{theme}-v{N}.pdf` — `?theme=` follows the reader's toggle; `v{N}` is the code-side render version), else generates via Playwright, caches, serves. Bytes proxied (not a public URL) so the PDF stays members-only |

Route-level `loading.tsx`/`error.tsx` cover `/`, `/read/[issueId]` and `/admin/*`. Static
security headers (`nosniff`, `X-Frame-Options`, referrer/permissions policies) are set globally
in `next.config.ts`; the CSP is set per request in `src/middleware.ts`, where `script-src` gets
a fresh nonce (+ `'strict-dynamic'`) instead of `'unsafe-inline'`. Body text is stored as
structured JSON and rendered through React (content v3 — no `dangerouslySetInnerHTML`, no HTML
sanitiser; see `src/lib/rich-text-doc.ts` + `src/features/blocks/rich-text.tsx`), so the nonce CSP
is now defence in depth rather than the sole XSS backstop.

DB-backed routes set `export const dynamic = "force-dynamic"` so they always read fresh and aren't
prerendered at build. **Everything except `/signin` and `/unsubscribe` is gated**: the library and
reader require a member session, `/admin` and every mutation require an admin — see below.
`/unsubscribe` is deliberately ungated (it arrives in email, before any session) and authorises
itself with a signed token instead. The site stays noindex
globally (nothing public to crawl).

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

## Environment

Server env is validated in [`src/lib/env.ts`](../src/lib/env.ts); branding in
[`src/lib/site.ts`](../src/lib/site.ts). Local values live in `.env.local` (git-ignored); production
values are set in Railway. `.env.example` lists every key.

| Var                                                    | Required now  | Purpose                                                                                                   |
| ------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                         | yes           | Postgres connection                                                                                       |
| `NEXT_PUBLIC_MAGAZINE_NAME` / `_ORG_NAME` / `_TAGLINE` | no (defaults) | Branding text, build-time inlined                                                                         |
| `NEXT_PUBLIC_BRAND`                                    | no (default)  | Brand skin / palette (`heritage` default); build-time inlined, unknown value fails at boot (`brands.css`) |
| `NEXT_PUBLIC_ISSUE_THEMES`                             | no (all)      | Comma list of layout themes the editor/reader offer (`classic,modern`); build-time inlined, validated     |
| `AUTH_SECRET`                                          | dev: yes      | Auth.js token/cookie signing + unsubscribe-token key (required in prod by env.ts)                         |
| `APP_URL`                                              | no (fallback) | Canonical origin for links in emails (magic link, unsubscribe); falls back to the request Host when unset |
| `EMAIL_API_KEY`, `EMAIL_FROM`                          | no in dev     | Resend; unset in dev = links only in console (required in prod)                                           |
| `R2_*`                                                 | no in dev     | Object storage (required in prod)                                                                         |

## What's real vs stubbed

Real: the editor authors and autosaves to the DB; the reader/library/dashboard render real data;
images upload to R2 and render in both editor and reader; magic-link sign-in with database
sessions, and every route/mutation is gated (members read, admins author); the admin manages the
real member list (the `users` table) with add / remove / toggle subscribed / toggle admin / CSV
import; publishing an issue emails every subscribed member a personal magic link (the new-issue
email _is_ the sign-in link), with a signed one-click unsubscribe; **PDF export** prints the
fixed-canvas pages to a paginated PDF via headless Chromium (Playwright), cached in R2 by issue id

- revision and served members-only (see [infrastructure.md](infrastructure.md#pdf-generation)).
  The phase sequence lives in [ROADMAP.md](ROADMAP.md); work is tracked as GitHub issues (one
  milestone per phase).

## Docs

- [database.md](database.md) — schema, content model, migrations, seeding.
- [design-principles.md](design-principles.md) — engineering + design rules (read before changes).
- [ROADMAP.md](ROADMAP.md) — phase ordering, product decisions, open questions.
- [infrastructure.md](infrastructure.md) — hosting components, setup order, costs.
