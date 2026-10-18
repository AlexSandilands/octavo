import assert from "node:assert/strict";
import type { Block, Page } from "../src/lib/blocks.ts";
import { paginateImport } from "../src/features/editor/pdf-import/paginate.ts";
import {
  contentSpan,
  photoWidth,
  snapImageWidth,
} from "../src/features/editor/pdf-import/photo-size.ts";
import { richTextToPlain } from "../src/lib/rich-text-doc.ts";

// Run by check-pdf-import.mts.
export async function checkPhotoSizes(pages: Page[], signal: AbortSignal) {
  // Photo sizes: a photo's share of the page's content, rounded down to an
  // editor size; the content is every region's span, so margins don't count.
  const box = (x: number, width: number) => ({ x, y: 0, width, height: 10 });
  const column = [box(50, 460), box(50, 200), box(330, 180)];
  assert.equal(contentSpan(column), 460);
  const wide = box(50, 460);
  assert.equal(photoWidth(wide, [...column, wide], 612), 100);
  const pair = [box(50, 184), box(326, 184)];
  for (const photo of pair)
    assert.equal(photoWidth(photo, [...column, ...pair], 612), 33, "40% is S");
  assert.equal(photoWidth(box(50, 120), [...column, box(50, 120)], 612), 33);
  assert.equal(photoWidth(box(50, 276), [...column, box(50, 276)], 612), 50);
  assert.equal(photoWidth(box(50, 450), [...column, box(50, 450)], 612), 66);
  // Wider than the text (a bleed): the photo is the content, Full.
  assert.equal(photoWidth(box(0, 612), [...column, box(0, 612)], 612), 100);
  // The Club background's phone photo: 236pt of a 478pt column.
  assert.equal(photoWidth(box(57, 236), [box(57, 478), box(57, 236)], 595), 33);
  // Alone on the page, or beside only a caption: against 60% of the page at least.
  assert.equal(
    photoWidth(box(50, 184), [box(50, 184), box(50, 170)], 612),
    50,
    "a caption doesn't make its photo Full",
  );
  assert.equal(photoWidth(box(50, 240), [box(50, 240)], 612), 50);
  assert.equal(photoWidth(box(50, 150), [box(50, 150)], 612), 33);
  assert.equal(photoWidth(box(0, 612), [box(0, 612)], 612), 100);
  assert.deepEqual(
    [0, 0.49, 0.5, 0.65, 0.66, 0.99, 1, 1.2].map(snapImageWidth),
    [33, 33, 50, 50, 66, 66, 100, 100],
  );
  // The paginator keeps a photo's chosen width: a photo that doesn't fit beside
  // content goes to the next page whole; only a photo too big for an empty page
  // shrinks.
  const photo = (id: string, width: number): Block => ({
    id,
    type: "image",
    imageId: id,
    caption: "",
    align: "full",
    width,
  });
  const fitsWidth = async (blocks: Block[]) =>
    blocks.reduce(
      (n, b) =>
        n +
        (b.type === "text"
          ? richTextToPlain(b.text).length
          : b.type === "image"
            ? b.width
            : 0),
      0,
    ) <= 70;
  const sized = await paginateImport({
    pages,
    index: 1,
    selected: "prefix",
    inserted: [photo("half", 50), photo("large", 66), photo("full", 100)],
    fits: fitsWidth,
    signal,
  });
  const widths = sized.pages
    .flatMap((p, page) => p.blocks.map((b) => ({ b, page })))
    .filter(({ b }) => b.type === "image")
    .map(({ b, page }) => [b.type === "image" ? b.width : 0, page]);
  assert.deepEqual(widths, [
    [50, 1],
    [66, 2],
    [70, 3],
  ]);
}
