# Issue transfer — the bundle format

Issues are authored on one copy of this site and read on another: written locally
(largely with AI), then carried into production without a script run against the
database. **Issue transfer** is that move. An admin exports one or more issues from
the dashboard as a single zip — the content, its images, and the sponsors and logos
it references — and imports that zip on the other site, where each issue arrives as
a **new numberless draft**.

What a transfer promises: the authored content, the layout choices and the image
bytes arrive intact. What it does not promise: identical rendering. The
**destination's** branding, settings, numbering and matched library entries win, so
a transferred issue can look different where those differ.

Replacing an existing issue from a bundle is issue #294 and is not built yet.

## The bundle

```
manifest.json               at the root — the only file read before validation
issues/<issueId>/issue.json one per issue
images/<imageId>.webp       stored bytes, exactly as they sit in R2 / .data/uploads
```

Images are **stored, not deflated** — a WebP gains nothing from deflate and costs CPU
on both ends. `manifest.json` and the documents are deflated.

`manifest.json` (`src/lib/issue-transfer/manifest.ts`, zod-validated and strict):

| Field                     | Meaning                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `format`, `formatVersion` | `"octavo-issues"`, `1`                                                                                                         |
| `exportedAt`              | ISO timestamp, informational                                                                                                   |
| `contentVersion`          | the exporter's `CONTENT_VERSION`                                                                                               |
| `issues[]`                | `{ id, file, title, bytes, sha256 }`                                                                                           |
| `images[]`                | `{ id, file, width, height, bytes, sha256 }`                                                                                   |
| `sponsors[]`              | `{ id, name, href, activeUntil, logoImageId }` for every managed sponsor used (`logoImageId` is null when its artwork is gone) |
| `logos[]`                 | `{ id, name, imageId }` for every logo referenced by an issue or a cover                                                       |

Every listed file carries `bytes` and `sha256`, issues included. Ids and paths are
unique within the manifest, each `file` must be exactly its own id's path shape, and
sponsor and logo names must be unique after normalisation (trim, collapse runs of
whitespace, case-fold).

`issue.json`: `title`, `theme`, `content`, `footerMarkSize`, `footerTextSize`,
`logoId`, plus the source `number` / `status` / `publishedAt`, which are
**informational only** — every import is a draft.

Not in a bundle: members, settings, `revision`, cached PDFs, uploads that never made
it onto a page.

## Export

The dashboard's bulk bar gains **Export selected** beside Delete (a selection of one
is the single-issue export). `POST /api/admin/issues/export`, admin-only and
same-origin, answers with the archive; a refusal comes back as JSON so the bar can
say what to deselect.

Every object is read once before any of the response is sent — it is the only way to
know the size and hash the manifest carries, and it is where the two failure modes
are told apart:

- a row or object that is **genuinely absent** is left out, and the count is reported
  beside the download (`X-Issue-Export-Omitted`, a JSON object keyed by kind);
- a storage **read error** fails the whole export. A temporary outage must never
  quietly ship a bundle with holes in it.

The archive is then streamed, one entry's bytes at a time, so a big export is bounded
in memory **on the server**. The browser is not: the modal reads the response as a
blob before saving it, so a 250 MB export is briefly a 250 MB object in the tab. That
is the price of a refusal the bulk bar can show rather than a browser error page, and
it is an admin on a desktop; if it ever bites, the fix is a hidden same-origin form
that lets the browser stream to disk.

A sponsor whose **logo object** has gone missing is still exported, with
`logoImageId: null` — its name and link are what a sponsor block resolves. A **logo**
goes with its image, because a logo is its mark. An `images` row with no recorded
width or height (the columns are nullable) takes them from the bytes: writing a zero
would make a manifest the importer refuses.

## Import

1. **Pick.** _Import issues_ beside Create opens a modal. The browser reads **only
   `manifest.json`** from the chosen file, through a lazily loaded unzip that seeks to
   the archive's directory with `File.slice` — nothing is uploaded and the file never
   goes into memory.
2. **Plan.** `POST /api/admin/issues/import/plan` takes the manifest's titles and
   library names and answers, per issue, whether a destination issue already has that
   title, and per library name whether it will be reused, created, or is ambiguous.
   It writes nothing, and it is a courtesy only: the import re-derives all of it.
3. **Review.** One row per bundled issue, each arriving as a new draft, with the
   library entries that will be reused and created.
4. **Upload + import.** One request: the zip as the raw body
   (`Content-Type: application/zip`) with the operation id and decisions in a bounded
   `X-Issue-Import` header. The reply is newline-delimited JSON — a phase line as the
   server moves from checking to importing, then the result — so the modal shows
   _Uploading_ (cancellable) → _Checking_ → _Importing_ → result.
5. **Result.** Issues created, each linking to its editor; sponsors and logos reused
   versus created; references that had to be cleared.

### What a new draft gets

Fresh id, no number, `revision` 0, no `publishedAt`, whatever the source status. **No
email is ever sent by an import.** The footer reserve comes from the bundle, held to
the caps in `src/lib/branding.ts`. Page, block, heading and story-item ids are
untouched — they are internal to the document, so cover Story links keep resolving.

### Images are resolved per use

Bytes are stored **as they are**, never re-encoded. Which bundled images are uploaded
is decided only after every _use_ is resolved:

- an image block, montage slide or video poster, or a cover logo element with **no**
  `logoId` → needs the bundled bytes, rewritten to a new image id;
- a cover logo element (or `issues.logoId`) pointing at a logo that **matched** a
  destination logo → takes the destination's `logoId` **and** `imageId`, and needs no
  bundled bytes;
- a **created** sponsor or logo → needs its bundled image.

So the same source image can be skipped for a matched cover logo and still uploaded
for an ordinary block on the same page. The rewrite shares its traversal with
`collectImageIds` (`src/lib/image-sites.ts`), and the site union is discriminated, so
a new image-bearing block type breaks the rewrite's switch at compile time rather
than going silently unrewritten.

### Unresolved references are cleared, never carried

A `sponsorId`, `logoId` or image id the bundle does not supply is emptied rather than
kept: two databases with a shared ancestry (`pg_dump`) can hold entirely different
rows under the same id. A montage slide, whose `imageId` is required, is dropped, and
a montage left empty goes with it. Every clearing is named in the result.

### Library matching — destination wins

Sponsors and logos match by normalised name. A single match is **reused exactly as it
is**, even when its link, expiry or artwork differs from the bundle — never modified,
never a conflict. No match → created from the bundle. **Two or more** destination rows
sharing the name refuses the import and names the entry: neither table has a
uniqueness constraint, and picking one arbitrarily would be a silent wrong answer.

Imports are serialised with a transaction-scoped advisory lock, and the library is
resolved twice — once to decide what to upload, once inside the commit transaction
under that lock. The second pass adapts where another import has just created the
entry this one was going to, which is what makes two concurrent imports of the same
bundle create each entry once; the surplus object is swept after the commit.

## Validation and refusals

Everything is checked before anything is written. Each refusal has its own readable
message; the catch-all is "This file isn't a valid issue export."

- Not a zip; no root `manifest.json`; a manifest over its pre-parse byte cap or
  failing the schema; unknown `format` / `formatVersion`.
- Manifest `contentVersion`, **or any document's own `version`**, newer than this
  site's `CONTENT_VERSION` — "This export was made by a newer version of the site."
  Older versions are accepted exactly as the editor accepts them: schema defaults
  apply, and the document is stamped current on its next save.
- Duplicate paths or ids; a listed file missing, or its size or `sha256` not matching.
- An archive holding **two entries under one listed name** (or two `manifest.json`s).
  Taking the first is where zip parser differentials live — the browser and the server
  could read different manifests out of one file.
- An image that does not decode, is not WebP, whose decoded size disagrees with the
  manifest, or that exceeds `MAX_EDGE` (2000 px) or the input-pixel cap. Verification
  runs with bounded concurrency.
- An `issue.json` that fails **the editor save path's own rules** (`issueContentSchema`,
  `ensureCoverFirst`, `ISSUE_TITLE_MAX`, `themeIdSchema` — the same constants the save
  path uses), repeats an id the editor addresses (a page, a block, a cover element or a
  story item), or is too big to stay savable — the save endpoint caps a request at
  1 MB, so an imported document has to fit under that with room for the envelope.

  The version is read **before** the schema parse. A document from a newer content
  model usually carries something this site's schema rejects outright — a block type it
  has never seen — and would otherwise be refused as unreadable rather than as too new.

Archive safety: entry names are **never used as filesystem paths**; only the names the
manifest lists are read, and each must match its path shape exactly. Unlisted entries
(`__MACOSX/`, anything else) are ignored and never read. Sizes are enforced **while
inflating**, not trusted from the headers, and every entry scanned counts towards the
entry cap — directories and repeats included.

The inflation budget is a zip-bomb guard for the pass that does not yet trust the
archive. The write pass re-reads only entries already matched against their declared
size and hash, so it gets its own budget rather than spending the shared one twice —
otherwise the real ceiling would be half of `MAX_INFLATED_BYTES`.

### The caps

All in `src/lib/issue-transfer/limits.ts`, used by the exporter and the importer, so
a bundle this site produces is always one this site accepts.

| Cap                    | Value              |
| ---------------------- | ------------------ |
| issues per bundle      | 100                |
| named entries          | 5000               |
| upload                 | 250 MB             |
| total inflated         | 300 MB             |
| `manifest.json`        | 1 MB               |
| one image              | 5 MB               |
| one `issue.json`       | 2 MB               |
| a document's `content` | 1 MB less envelope |
| decisions header       | 8 KB               |

## The operation record

The guarantee, stated accurately: **database changes are atomic; object cleanup is
immediate when possible, and recoverable afterwards when it is not.**

`issue_imports` holds one row per attempt: `id` (the operation id the modal mints when
the admin confirms), `adminId`, `status` (`started` / `committed` / `swept`), `result`
and timestamps. Every object an import writes goes under **`imports/<operationId>/`**,
so that prefix _is_ the record of its intended keys — there is no per-key ledger to
keep in step.

The order: validate (writes nothing) → insert the `started` row → write the objects →
**one transaction** inserts every row and marks the operation `committed` with its
result → respond.

Any failure after `started`, including partway through the object writes, deletes the
prefix at once and marks the row `swept`. If the delete fails too the row stays
`started`, and **recovery** deletes the prefix of every `started` attempt older than an
hour and marks it `swept`. Recovery runs at the start of each import and once at
server start (`src/instrumentation.ts`) — deploys are frequent enough that nothing
lingers, and no scheduler is introduced. The age guard keeps it off an import in
flight on another instance.

Cleanup reads the status first. A commit whose acknowledgement was lost — the rows
are in, the driver threw anyway — also lands there, and its objects are exactly the
ones the new rows point at, so only a row still `started` may have its prefix deleted.

**Retry versus re-import.** `GET /api/admin/issues/import?operation=<id>` answers what
an operation id is worth: the recorded result if `committed`, "still running" if
`started`, and "no record" if the server never saw it. The modal's Retry asks that
first and only re-uploads when there is no record — after a dropped connection on an
80 MB file, the question is much cheaper than the answer. A lookup only ever answers
to the admin who started the operation. Closing the modal and importing the file again
mints a new id: a deliberate second import. Closing it _while the archive is still
going up_ — Escape, the backdrop, or the modal unmounting — aborts the upload, so that
second import can never be a duplicate of one left running out of sight; once the body
has arrived the modal is locked instead, because the server finishes regardless.

The modal keeps an operation id only while the outcome is genuinely unknown (a dropped
connection, "still running"). Anything the server answered definitively starts a fresh
operation, so Retry can never dead-end against a record that is already closed.

Once checking has begun the server finishes even if the browser has gone: the response
stream is written through a `send` that swallows enqueue errors, and the importer
treats its own progress callback as unsafe, so a departed reader cannot fail the
import writing to it.

## Transport

The zip is the raw request body, streamed to a temp file through a byte counter that
aborts past the cap, opened with a random-access reader and removed in a `finally`.

**The import path is excluded from the proxy matcher** (`src/proxy.ts`). Next 16
buffers every proxied request body and silently truncates it at 10 MB
(`experimental.proxyClientMaxBodySize`) — the handler would simply receive a partial
archive. Excluding this one exact path costs nothing: the proxy's auth gate covers
`/admin/*` pages only and has never gated `/api/admin/*` (`getAdminUser()` in the
handler is the authority), its CSP nonce only matters on HTML, and the static headers
in `next.config.ts` still apply. Raising the limit instead would make every route,
including unauthenticated ones, buffer larger bodies in memory.
The image upload route (`/api/admin/images`, up to 12 MB) is excluded the same way and for the
same reasons: a 10–12 MB photo used to reach it truncated and fail as "Expected multipart form data" (#343).

Export, plan and import all check `sameOrigin` (`src/lib/same-origin.ts`) and
`getAdminUser()`; import is rate-limited per admin. The status `GET` checks the admin
only: a browser sends no `Origin` on a same-origin GET, so `sameOrigin` would refuse
every real retry, and a lookup that writes nothing and answers only for the caller's
own operation has nothing for a forged request to gain.

`@zip.js/zip.js` is the one dependency, on both ends: it reads random-access from a
`FileHandle` on the server and from a `File` through `slice` in the browser, writes,
handles zip64, and has no dependencies of its own. Its web workers are disabled — the
nonce CSP allows `worker-src 'self'`, which blocks the blob worker it would otherwise
spawn.

## Verifying a change

```sh
npx tsx --tsconfig scripts/tsconfig.json scripts/check-issue-transfer.mts
npx tsx --tsconfig scripts/tsconfig.json scripts/dev-issue-transfer-gate.mts http://localhost:3000
```

The in-memory check covers the manifest and document rules, the resolution and the
one invariant the feature rests on — that `collectImageIds` and the rewrite walk the
same sites. The gate covers the round trip, per-use image resolution, destination-wins
and ambiguity, concurrency, cleared references, every refusal, failure injection and
recovery, a client that disconnects mid-import, the access checks, and the real
workflow — the imported draft opened in a browser, typed into, autosaved, reloaded,
exported and imported again. It creates its own rows and removes them.

For the size cases against a production build, see the header of
`scripts/prod-issue-transfer-size.mts`.

Failure injection is a narrow, test-only seam (`src/server/issue-transfer/fault.ts`):
it reads `ISSUE_TRANSFER_FAULT` from the environment the server process was started
with — nothing in a request can reach it — and is ignored outside development.
