# PDF import regression fixtures

These tiny PDFs are original deterministic test artwork authored for Octavo issue #223.
They contain synthetic text and a generated green raster rectangle, **not real club
newsletters or photographic-quality proof**. They may be redistributed under the same
terms as this repository.

Regenerate the ordinary samples with `npx tsx scripts/pdf-import-fixtures.mts`.
The locked fixture is `single-column.pdf` rewritten with pypdf 6.18.0, encrypted with
the test password `octavo-test-password`; it tests the unlocked-copy refusal, not a
password entry UI. Its source content is the same synthetic fixture.

- `single-column.pdf`: heading, body wrapping, italic evidence, photo, continuation page/photo.
- `two-column.pdf`: spanning heading, separate columns, repeated use of one raster object.
- `rotated.pdf`: 90-degree page rotation with positioned text and raster occurrence.
- `scan-only.pdf`: image-only page; no OCR is expected.
- `malformed.pdf`: deliberately invalid bytes after a valid signature.
- `too-many-pages.pdf`: 101 tiny source pages, refused before page rendering.
- `locked.pdf`: password-protected input, refused with an unlocked-copy instruction.

Public samples used locally (not committed; no private club sample was supplied):

- Library of Congress Digital Preservation Newsletter, December 2012:
  https://digitalpreservation.gov/news/newsletter/201212.pdf
  SHA-256 `db426cff6c925986bd75f549b7c2b4e136af8a8c53e88685872c8a9da6e67f35`.
  Tagged Word/Acrobat export with a sidebar, columns, a normal JPEG portrait and masked logo.
  Credited third-party photography means this is a verification reference, not a bundled asset.
- Official PDF.js demonstration paper:
  https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf
  SHA-256 `3662ff519e485810520552bf301d8c3b2b917fd2f83303f4965d7abed367e113`.
  Dense academic multi-column text; not representative of a club newsletter.
