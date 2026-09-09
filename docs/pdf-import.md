# Assisted PDF import

An admin can open **Import PDF** in a draft editor, choose a local PDF, select source
regions, correct the review tray, and **Add to magazine**. Source pages navigate
independently of magazine pages. The same desktop editor gate applies (768px minimum).
The PDF itself never leaves the browser. Only accepted blocks and selected raster
images leave the browser when Add is pressed.

The tray keeps selections across source pages. Its default order is source page then
inferred reading order. An explicit reorder is retained when more regions are selected.
Text suggestions can become headings at any existing heading level; body size,
alignment, emphasis and paragraph breaks can be edited. Split separates paragraphs,
or cuts a single paragraph at a word boundary; repeat or edit the preview to remove
neighbouring text. Combine preserves compatible body paragraphs and separate headings
and images. Nothing forces the author to accept the detector's boundaries.

Insertion starts after the selected block, or at the selected normal page's end.
Covers and page-owning photos instead get a new normal page immediately afterwards.
The destination's prefix, import and suffix are fitted in that order; later authored
pages stay intact. Each Add is one undo step, including continuation pages and text
splits. The last inserted block becomes selected. Source labels are derived from block
IDs currently present, so Undo, Redo and removal update them. Import again is explicit.

Closing/replacing a source releases its worker, canvases, selections and local mapping;
it leaves magazine content alone. A refresh requires choosing the PDF again. The
ordinary save/retry/conflict status remains authoritative. Draft editor saves, including
retries and history replay after source close, use a draft-only atomic database write;
a concurrent publication refuses them. Deliberately publishing an issue after using
import ends that session's document undo history, closes the source, and establishes
a saved published baseline that remains editable through normal tools.

## Extraction and resource boundaries

`pdfjs-dist` is pinned to **6.3.289** behind `pdf-import/adapter.ts`. The importer and
parser load only when opened. `predev` and `prebuild` copy the matching worker, CMaps,
standard fonts and license to `/pdfjs/6.3.289/`. No CDN or PDF upload endpoint exists.
The adapter passes an actual module `Worker` to `PDFWorker.create({port})`; it does not
permit a fake-worker fallback. Version 6 has no `isEvalSupported`/generated-function
path. Font faces and WASM are disabled, using the same-origin standard-font/CMap
assets. CSP adds only `worker-src 'self'`; fonts remain self-only and production
scripts gain no unsafe-eval exception. PDF annotations, scripting and XFA are not run.

Central limits are in `pdf-import/model.ts`: 40 MiB input, 100 source pages, 16 MP per
source image, 8 MP per preview canvas, three cached previews, and 30 seconds per active
PDF operation. Per-page exported images also have 32 MP decoded / 32 MiB encoded /
200 occurrence budgets; analysis caps 20,000 positioned runs, two million text
characters and 100,000 drawing operations per page. The
review tray caps 300 items / 64 MiB. PDF signature and MIME metadata are checked.
Timeout and cancellation terminate the actual worker and invalidate asynchronous
results. Analysis yields in bounded batches, and page proxies are cleaned once the
preview and regions have been extracted. Preview zoom uses stable viewport geometry
with a bounded raster surface, so extreme zoom may look softer.

Text is reconstructed from positioned runs, with columns ordered separately. Tagged
headings, relative size, font names, spacing and line length support editable heading
suggestions. Bold/italic require evidence; font aliases can hide it. Alignment is
conservative, and source body sizes are fixed per extracted page so later pages do
not change previous imports. Only soft wrapping hyphens are unambiguously removed;
ordinary hyphens remain for review. Underlines drawn as separate vectors, tables,
complex columns, rotated text within an otherwise unrotated page, decorative lettering,
and uncertain styling remain best effort. There is no OCR or automatic whole-document
import. Repeated headers/footers remain selectable.

Ordinary RGB/RGBA raster occurrences are recovered with graphics transforms and
per-occurrence bounds. Reused objects retain separate placements and share locally
encoded bytes. Containing rectangular clips are supported; arbitrary clips, masks,
composite groups and unsupported encodings are visibly warned and remain preview-only.
The importer does not represent an unsupported crop as a faithful image extraction.

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
before committing. Source navigation/cancellation stays available.

Uploads are sequential through the existing authenticated `/api/admin/images` route,
with its format sniffing, sharp processing, 12 MB cap and 30/minute limit. Successful
uploads are cached for retry. A failed batch inserts nothing. Cancelling prevents later
uploads/commit; an already-sent upload may finish as an ordinary issue-owned image.
Storage-success/record-failure compensates through `sweepOrphanedObjects`. Issue
delete uses the normal reference-safe asset cleanup; Undo does not delete images that
Redo may need. No source PDF objects, tables, buckets or backend parser were added.

Browser Sentry breadcrumbs/events are suppressed while the private source workspace is
open. The parser uses quiet logging and UI failures use fixed messages, not source
filenames, text or image bytes. No source state is put in persistent browser storage.

## Verification

Synthetic fixtures and provenance are in [the fixture README](../scripts/fixtures/pdf-import/README.md).
No club PDF was available. The public LOC newsletter demonstrated a normal portrait
inside Word-style rectangular clips; its masked logo is warned unsupported. The
PDF.js Tracemonkey paper checks a denser academic layout. These observations establish
feasibility, not universal newsletter quality.

Initial local Chromium 149 / Linux / 1440×1000 / DPR 2 measurements: first lazy-load
single-column fixture about 1.07 s (4 text / 1 image regions); warm two-column and
rotated fixtures 82–83 ms; LOC first page 184 ms (31 text / 5 raster occurrences,
unsupported masked/composite warning); Tracemonkey first page 199 ms (46 text regions).
These are single local observations, not device-wide performance promises. The 768px
workspace, desktop/mobile readers, and exported PDF are also visually checked.
The final production recheck recovered 30 text / 5 raster regions on the LOC first
page and 33 text regions on the Tracemonkey first page after grouping refinements;
the LOC masked/composite artwork warning remained explicit.

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

The core gate checks lazy loading/CSP, no source transmission, measured mixed insertion,
order, oversized paragraphs, failure atomicity, duplicate clicks, undo/redo/source labels,
reload, correction controls, rotations, repeated images, bad-input states, concurrent
publication, both readers and the exported PDF. The failure gate checks successful-upload
retry reuse, source-navigation/close races, worker teardown, locked/page-limit/signature
refusals, and compensation when publication races between storage and recording.
The privacy gate requires live telemetry: a private canary stays local and a post-close
control event is delivered. It also checks cross-page reorder and worker deadlines.
The layout gate checks tall-photo scaling and page-fit conversion, theme/footer/logo
geometry, persisted image decoding, and atomic refusal at the 200-page limit.

Repository lint, app/script typechecks, touched-file formatting, production build,
production action-refresh and existing alignment/flow gates remain required. The user's
browser pass on the implementation PR is still a required handoff before merge.
