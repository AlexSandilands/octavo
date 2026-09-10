# Assisted PDF import

The editor's right-hand **side panel** (`src/features/editor/side-panel/`) is opened from
the tool rail on the editor's right edge; its first tool is **Import PDF**. The panel
slides in beside the canvas, takes half the editor row by default, and its left edge is
a drag handle (also a keyboard separator: arrow keys, Home, End) with bounds that keep
the canvas usable. The canvas re-fits to whatever is left. Closing the panel unmounts
the tool, which releases the PDF, its worker and any selection; magazine content is
untouched. The same desktop editor gate applies (768px minimum). Import is offered on
drafts only; on a published issue the rail button is inert with the reason as its hint.

## The import flow

1. **Open a PDF** — a big _Choose PDF_ button inside a drop target, or drag a file onto
   the panel (dropping onto an open PDF replaces it). The file stays on this device;
   only the text and photos the author adds are saved. Limits and refusals are shown in
   place (40 MiB, 100 pages, selectable text only, unlocked copies).
2. **Pick regions on the page** — every detected text block and ordinary photo is drawn
   as a gentle lifted box over the rendered page. Hover shows a ghost chip with the
   detector's suggestion (Heading, Text or Image, using the editor's own block icons); a
   press selects the region, which gets a solid chip. Hovering or focusing a selected
   region shows a small tool pill above it (below when it sits at the top of the page):
   the Heading/Text toggle, **Split** for over-grouped text (cuts at the widest gap
   between its source lines, with real geometry for both halves), and **Add**.
3. **Add** — the command row at the top of the panel says how many regions are selected,
   offers _Select all on page_ (every region, each with its suggested kind), _Clear_ and
   the one _Add N_ that sends the whole selection. Pressing the count opens the selection
   list: rows in the order they will be added (source page, then reading order, until
   the author reorders), each with its kind toggle, a preview, its source page, move
   up/down and remove. The status line under the row names the destination ("after the
   selected block on page 2", "at the end of page 3", "on a new page after page 1" for
   covers and page-owning photos) until there is news: progress, the outcome, or a
   refusal with the draft unchanged and the selection kept for correction.
4. The page and zoom controls float over the foot of the PDF view like the editor's own
   tools. Regions added this session carry an _Added_ chip (derived from the blocks still
   in the draft, so Undo clears it) and can be added again deliberately.

Insertion, fitting and the draft-only guarantees are unchanged from the original
implementation: the destination's prefix, import and suffix are fitted in that order,
later authored pages stay intact, each Add is one undo step (continuation pages and text
splits included), the last inserted block becomes selected, and a concurrent
publication refuses both the import and any late draft save.

## Extraction and resource boundaries

`pdfjs-dist` is pinned to **6.3.289** behind `pdf-import/adapter.ts`. The importer and
parser load only when the tool is opened. `predev` and `prebuild` copy the matching
worker, CMaps, standard fonts and license to `/pdfjs/6.3.289/`. No CDN or PDF upload
endpoint exists. The adapter passes an actual module `Worker` to `PDFWorker.create({port})`;
it does not permit a fake-worker fallback. Font faces and WASM are disabled, using the
same-origin standard-font/CMap assets. CSP adds only `worker-src 'self'`; fonts remain
self-only and production scripts gain no unsafe-eval exception. PDF annotations,
scripting and XFA are not run.

Central limits are in `pdf-import/model.ts`: 40 MiB input, 100 source pages, 16 MP per
source image, 8 MP per preview canvas, three cached previews, and 30 seconds per active
PDF operation. Per-page exported images also have 32 MP decoded / 32 MiB encoded /
200 occurrence budgets; analysis caps 20,000 positioned runs, two million text
characters and 100,000 drawing operations per page. The selection caps 300 items /
64 MiB. PDF signature and MIME metadata are checked. Timeout and cancellation
terminate the actual worker and invalidate asynchronous results. Analysis yields in
bounded batches, and page proxies are cleaned once the preview and regions have been
extracted. Preview zoom uses stable viewport geometry with a bounded raster surface.

Text is reconstructed from positioned runs. **Columns** are found from local evidence:
a gap inside a line counts as a column break when at least two neighbouring lines break
at the same place (or when it is wider than 2.4 body sizes), so a narrow newsletter
gutter splits correctly even under a full-width block. Tagged headings, relative size,
font names, spacing and line length support editable heading suggestions. Bold/italic
require evidence; font aliases can hide it. Alignment is conservative, and body sizes
are fixed per extracted page so later pages do not change previous imports. Only soft
wrapping hyphens are unambiguously removed. Regions keep their source lines so a split
has real geometry. Underlines drawn as separate vectors, tables, decorative lettering
and uncertain styling remain best effort. There is no OCR or automatic whole-document
import. Repeated headers/footers remain selectable.

Ordinary RGB/RGBA raster occurrences are recovered with graphics transforms and
per-occurrence bounds. Reused objects retain separate placements and share locally
encoded bytes. Containing rectangular clips are supported; arbitrary clips, masks,
composite groups and unsupported encodings are visibly warned and remain preview-only.

## Layout and image ownership

The bounded layout pass uses real `PageFrame`, theme, footer and block rendering.
It verifies both reader/print presentation and editable presentation: empty kicker and
caption fields occupy editor space, while ProseMirror's whitespace and ligature rules
can alter body wrapping. Fonts and image dimensions settle before measurements.
Paragraph boundaries are preferred, then binary search finds measured word cuts;
marks, whitespace and Unicode survive. Unbroken text that cannot fit is refused or
split safely. No intermediate layout is committed or autosaved.

Images shrink without distortion within the normal width limits. A photo too tall at
the minimum width gets its own `page-fit` page. Existing page-photo invariants apply,
including omitted caption on a page-owning photo. The accepted batch is validated and
fitted before any upload, then checked again with server-returned image dimensions.
Pending imports lock destination edits and check the captured document and geometry
before committing.

Uploads are sequential through the existing authenticated `/api/admin/images` route,
with its format sniffing, sharp processing, 12 MB cap and 30/minute limit. Successful
uploads are cached for retry. A failed batch inserts nothing. Closing the panel
mid-upload cancels the Add; an already-sent upload may finish as an ordinary
issue-owned image. Storage-success/record-failure compensates through
`sweepOrphanedObjects`. Issue delete uses the normal reference-safe asset cleanup; Undo
does not delete images that Redo may need.

Browser Sentry breadcrumbs/events are suppressed while the panel is open
(`data-pdf-private`). The parser uses quiet logging and UI failures use fixed messages,
not source filenames, text or image bytes. No source state is put in persistent
browser storage.

## Verification

Synthetic fixtures and provenance are in [the fixture README](../scripts/fixtures/pdf-import/README.md).
The panel was also exercised against a real two-column newsletter with a masthead,
photos and bold lead-ins (not committed): it was what showed the page-wide gutter search
failing under a full-width block, which the local column-break rule replaced.

Focused checks:

```sh
npx tsx --tsconfig scripts/tsconfig.json scripts/check-pdf-import.mts
npx tsx --tsconfig scripts/tsconfig.json scripts/pdf-import-feasibility.mts http://localhost:3223 [optional-public-pdf-paths...]
```

The production browser checks use scratch database records and the real upload route.
They refuse non-local application/database hosts. A local S3 substitute makes storage
success/failure races repeatable without a cloud account. In one terminal:

```sh
npx tsx scripts/pdf-import-s3-server.mts
```

Build with the public test origins (a worktree must temporarily remove its upload
symlink first, per the workflow). No runtime credentials are needed to build:

```sh
R2_PUBLIC_URL=http://127.0.0.1:19923 NEXT_PUBLIC_SENTRY_DSN=http://public@127.0.0.1:19923/1 npm run build
```

For the local test server **and** gate processes, set only these fake test values in
that terminal; `.env.local` (or `.env`) supplies the existing local DB/auth configuration:

```sh
export NODE_OPTIONS="--import $PWD/scripts/pdf-import-s3-preload.mjs"
export R2_ACCOUNT_ID=octavo223 R2_ACCESS_KEY_ID=local-test R2_SECRET_ACCESS_KEY=local-test
export R2_BUCKET=octavo223 R2_PUBLIC_URL=http://127.0.0.1:19923 EMAIL_API_KEY=local-test
export NEXT_PUBLIC_SENTRY_DSN=http://public@127.0.0.1:19923/1
PORT=3223 npm start
```

The preloader redirects only the fixed fake account's S3 hostname to loopback. Run
these gates **sequentially** against that server (the failure gate controls PUT delay):

```sh
npx tsx --tsconfig scripts/tsconfig.json scripts/prod-pdf-import-gate.mts http://localhost:3223
npx tsx --tsconfig scripts/tsconfig.json scripts/prod-pdf-import-failures.mts http://localhost:3223
npx tsx --tsconfig scripts/tsconfig.json scripts/prod-pdf-import-privacy.mts http://localhost:3223
npx tsx --tsconfig scripts/tsconfig.json scripts/prod-pdf-import-layout-gate.mts http://localhost:3223
```

The core gate checks lazy loading/CSP, the panel's resize handle and canvas re-fit, no
source transmission, retyping through the pill, the selection list, zoom-stable hit
targets, failure atomicity, duplicate clicks, an oversized paragraph split across
continuation pages in order, undo/redo/added marks, reload, keyboard selection and
split, rotation, bad-input states, concurrent publication, both readers and the
exported PDF. The failure gate checks successful-upload retry reuse, closing the panel
mid-upload, worker teardown on Close PDF and on closing the panel, locked/page-limit/
signature refusals, and compensation when publication races between storage and
recording. The privacy gate requires live telemetry: a private canary stays local and a
post-close control event is delivered. It also checks cross-page reorder in the
selection list and worker deadlines. The layout gate checks tall-photo scaling and
page-fit conversion, theme/footer/logo geometry, persisted image decoding, and atomic
refusal at the 200-page limit.

Repository lint, app/script typechecks, touched-file formatting and the production
build remain required. The user's browser pass on the implementation PR is still a
required handoff before merge.
