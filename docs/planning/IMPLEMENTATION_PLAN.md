# Implementation plan — from mocked UI to working app

Everything today is UI-only: the editor keeps React state that resets on refresh; the
reader, dashboard and library all read `src/lib/sample-issue.ts`. Nothing reads or writes
the database.

**Priority (Phase 1):** the admin editor creates/edits issues and _persists_ them locally,
and the reader renders those saved issues. Everything else is sequenced after.

---

## Key decisions (settle these first)

1. **Content model = one JSONB document per issue.** Store the whole pages→blocks tree in an
   `issues.content` column rather than normalised `pages`/`blocks` tables. Matches "blocks JSON
   is the source of truth", makes save a single atomic upsert, and is trivial to render. We give
   up per-block SQL queries we don't need. (Replaces the current `pages`/`blocks` tables.)

2. **One canonical block model, shared by editor + reader + (later) PDF.** Right now the editor
   uses `heading | text | image | sponsor` blocks while the reader uses a different
   `kicker/heading/standfirst/body[]` page shape. These must converge. Define the block types
   once (zod), and write one set of per-theme block renderers used by both the reader and the
   editor's preview. This is the central refactor of Phase 1.

3. **Local persistence = local Postgres** (same engine as prod, via Drizzle). Use Docker for
   parity; PGlite is a no-Docker fallback. Not SQLite — the schema uses pg enums/jsonb.

4. **Auth is deferred.** Phase 1 leaves `/admin` ungated so we can build the editor without the
   auth detour. Gating comes in Phase 2.

---

## Block model (target)

```ts
// src/lib/blocks.ts — zod schemas + inferred types, imported everywhere
Heading  = { id, type: "heading", kicker?: string, title: string }
Text     = { id, type: "text", text: string }            // plain text v1; rich text later
Image    = { id, type: "image", imageId?: string, caption?: string }  // upload later
Sponsor  = { id, type: "sponsor", name: string, href?: string, logoId?: string }

Block    = Heading | Text | Image | Sponsor               // discriminated union
Page     = { id, blocks: Block[] }
IssueContent = { pages: Page[] }                           // stored in issues.content
```

---

## Phase 1 — editor saves, reader renders (the vertical slice)

### 1. Database up locally

- [ ] Add `docker-compose.yml` with a Postgres service; document `docker compose up -d`.
- [ ] Put `DATABASE_URL` in `.env.local`.
- [ ] Relax `src/lib/env.ts`: only `DATABASE_URL` (+ public branding) required now; make
      `AUTH_SECRET`, `R2_*`, `EMAIL_*` optional until their phases (otherwise the app can't boot).

### 2. Schema + migrations

- [ ] In `src/db/schema.ts`: drop `pages` and `blocks` tables; add `content jsonb` (+ keep
      `number`, `title`, `theme`, `status`, `publishedAt`) on `issues`. Keep `users`/auth tables.
- [ ] `npm run db:generate && npm run db:migrate` to create tables.
- [ ] Seed script (`src/db/seed.ts`): insert one issue built from the current sample content,
      converted to the block model, so the reader has something on day one.

### 3. Shared block model + renderers

- [ ] `src/lib/blocks.ts` — zod schemas, types, `makeBlock(type)`, an `emptyIssueContent()`.
- [ ] `src/features/blocks/` — per-theme presentational renderers: `<BlockView block theme />`
      covering heading/text/image/sponsor for Classic + Modern. Pure, no state.
- [ ] Refactor `desktop-reader` / `mobile-reader` to paginate + render `IssueContent` via these
      renderers (replacing the bespoke `Page` shape). Delete the divergent sample shape.

### 4. Data-access layer (server-only)

- [ ] `src/server/issues.ts`: `listIssues()`, `getIssue(id)`, `createIssue()`,
      `updateIssueContent(id, content)`, `updateIssueMeta(id, {title,theme,...})`,
      `publishIssue(id)`, `deleteIssue(id)`. Drizzle queries; zod-validate all inputs.

### 5. Server actions (mutations the UI calls)

- [ ] `src/app/admin/actions.ts` (`"use server"`): `createIssueAction` (insert draft → redirect
      to editor), `saveIssueAction(id, content, meta)`, `publishIssueAction(id)`,
      `deleteIssueAction(id)`. Each validates and calls the data layer, then `revalidatePath`.

### 6. Wire the editor to real data

- [ ] Editor page (server) loads the issue via `getIssue(id)` and passes `content` to the client
      `Editor`.
- [ ] `Editor` initialises state from props (not the hardcoded `INITIAL`), supports: add/edit/
      reorder/delete blocks, add/delete/reorder pages, edit title + theme, switch selected page.
- [ ] Inline editing: contentEditable / inputs per block (heading fields, text area). Rich text
      (Tiptap) deferred.
- [ ] **Autosave**: debounce (~800ms) → `saveIssueAction`; show a "Saved/Saving…" indicator.
- [ ] Publish button → `publishIssueAction` (sets status + publishedAt; no email yet).
- [ ] Image block: store caption + placeholder only for now (real upload in Phase 4).

### 7. Wire dashboard, library, reader to the DB

- [ ] `/admin` lists issues from `listIssues()`; "Create new issue" → `createIssueAction`.
- [ ] `/` library reads published issues from the DB.
- [ ] `/read/[issueId]` loads the issue from the DB and renders it (drafts viewable via admin
      preview; published viewable normally).
- [ ] Remove `src/lib/sample-issue.ts` once everything reads the DB (or keep only for the seed).

**Done when:** create an issue in `/admin` → add pages/blocks → it autosaves → publish → open it
in the reader and see exactly what was authored, surviving a refresh and restart.

---

## Later phases (sequenced, briefer)

- **Phase 2 — Auth & access.** Magic-link sign-in (Auth.js email provider + Drizzle adapter +
  Resend), `isAdmin` gating on `/admin` and mutations, member session on the reader. Wire
  `AUTH_SECRET`/email env back to required.
- **Phase 3 — Members.** Persist members; CSV import; add/remove; subscribed/bounced status.
- **Phase 4 — Images.** Upload → `sharp` → WebP → R2; image blocks reference stored images;
  `next/image` in reader. Wire `R2_*` env.
- **Phase 5 — Email blasts.** On publish, send each member their personal magic link via Resend;
  unsubscribe + bounce handling.
- **Phase 6 — PDF export.** Render issue HTML → Playwright → PDF on demand; cache on R2; the
  download button.
- **Phase 7 — Real flipbook.** Swap the spread-swap for StPageFlip page-curl; prefetch neighbours.
- **Phase 8 — Sponsors.** Sponsor management + auto-insertion + basic stats.

---

## Notes / risks

- The editor/reader content-model unification (decision 2) is the only non-trivial refactor in
  Phase 1; do it before wiring data so both sides speak the same shape.
- Keep mutations server-side and zod-validated from the start (see `docs/design-principles.md`),
  even while `/admin` is ungated, so adding auth later is just a gate, not a rewrite.
- Autosave needs care: debounce, ignore no-op saves, and don't overwrite a newer edit with an
  in-flight stale one (last-write-wins on `content` is fine for a single admin).
