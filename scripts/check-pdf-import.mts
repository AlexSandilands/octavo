import assert from "node:assert/strict";
import { groupRuns } from "../src/features/editor/pdf-import/grouping.ts";
import {
  reviewItem,
  synthesize,
  splitReview,
  sourceState,
  cutParagraph,
} from "../src/features/editor/pdf-import/synthesis.ts";
import { paginateImport } from "../src/features/editor/pdf-import/paginate.ts";
import { richTextToPlain, type RichDoc } from "../src/lib/rich-text-doc.ts";
import {
  issueContentSchema,
  type Block,
  type Page,
} from "../src/lib/blocks.ts";
import type { Run } from "../src/features/editor/pdf-import/model.ts";
import { cropOf } from "../src/features/editor/pdf-import/image-crop.ts";
const signal = new AbortController().signal;
const run = (
  text: string,
  x: number,
  y: number,
  width = 150,
  size = 12,
): Run => ({ text, x, y, width, height: size, size, marks: [] });
const groups = await groupRuns(
  [
    run("Spanning article heading", 40, 20, 520, 24),
    run("Left begins", 40, 80),
    run("Left continues", 40, 96),
    run("Right begins", 330, 80),
    run("Right continues", 330, 96),
  ],
  1,
  612,
  signal,
);
assert.deepEqual(
  groups.map((g) => richTextToPlain(g.doc)),
  [
    "Spanning article heading",
    "Left begins Left continues",
    "Right begins Right continues",
  ],
);
assert.equal(groups[0]?.heading, true);
const hyphen = await groupRuns(
  [run("wrap\u00ad", 40, 20), run("ping", 40, 36)],
  1,
  612,
  signal,
);
assert.equal(richTextToPlain(hyphen[0]!.doc), "wrapping");
const spaces = await groupRuns(
  [run("word ", 40, 20, 30), run(" next", 75, 20, 30)],
  1,
  612,
  signal,
);
assert.equal(richTextToPlain(spaces[0]!.doc), "word  next");
const right = await groupRuns(
  [
    run("first", 200, 20, 200),
    run("second", 250, 36, 150),
    run("third", 210, 52, 190),
  ],
  1,
  612,
  signal,
);
assert.equal(right.length, 1);
assert.equal(right[0]?.align, "right");
const center = await groupRuns(
  [
    run("first", 100, 20, 200),
    run("second", 125, 36, 150),
    run("third", 105, 52, 190),
  ],
  1,
  612,
  signal,
);
assert.equal(center[0]?.align, "center");
const justify = await groupRuns(
  [
    run("first", 40, 20, 300),
    run("second", 40, 36, 300),
    run("third", 40, 52, 300),
    run("last", 40, 68, 160),
  ],
  1,
  612,
  signal,
);
assert.equal(justify[0]?.align, "justify");
const item = reviewItem(groups[1]!);
item.block = {
  id: item.id,
  type: "text",
  text: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "a".repeat(7999) + "🐦x",
            marks: [{ type: "bold" }],
          },
        ],
      },
    ],
  },
};
const batch = synthesize([item]);
for (const b of batch.blocks)
  if (b.type === "text" && typeof b.text !== "string")
    for (const p of b.text.content)
      if (p.type === "paragraph")
        for (const n of p.content ?? [])
          if (n.type === "text") assert.equal(n.text.isWellFormed(), true);
assert.equal(
  batch.blocks
    .map((b) => (b.type === "text" ? richTextToPlain(b.text) : ""))
    .join(""),
  "a".repeat(7999) + "🐦x",
);
const split = splitReview(item);
assert.notEqual(split[0]?.id, item.id);
assert.equal(
  split
    .map((it) =>
      it.block.type === "text" ? richTextToPlain(it.block.text) : "",
    )
    .join(""),
  richTextToPlain(item.block.text),
);
const doc: RichDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Marked text ", marks: [{ type: "italic" }] },
        { type: "hardBreak" },
        { type: "text", text: "ends 🐦" },
      ],
    },
  ],
};
for (let at = 1; at < 19; at++) {
  const cut = cutParagraph(
    doc.content[0] as Extract<
      RichDoc["content"][number],
      { type: "paragraph" }
    >,
    at,
  );
  assert.equal(
    cut.map((p) => richTextToPlain({ type: "doc", content: [p] })).join(""),
    richTextToPlain(doc),
  );
}
const text = (id: string, value: string): Block => ({
  id,
  type: "text",
  text: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
  },
});
const pages: Page[] = [
  { id: "cover", cover: true, blocks: [] },
  {
    id: "destination",
    blocks: [text("prefix", "prefix "), text("suffix", " suffix")],
  },
  { id: "later", blocks: [text("latertext", "Keep later page")] },
];
const imported = text(
  "imported",
  "one two three four five six seven eight nine ten ".repeat(8),
);
const fits = async (blocks: Block[]) =>
  blocks.reduce(
    (n, b) => n + (b.type === "text" ? richTextToPlain(b.text).length : 20),
    0,
  ) <= 80;
const result = await paginateImport({
  pages,
  index: 1,
  selected: "prefix",
  inserted: [imported],
  fits,
  signal,
});
assert.deepEqual(result.pages.at(-1), pages.at(-1));
assert.equal(
  result.pages
    .slice(1, -1)
    .flatMap((p) => p.blocks)
    .map((b) => (b.type === "text" ? richTextToPlain(b.text) : ""))
    .join(""),
  "prefix " +
    richTextToPlain(imported.type === "text" ? imported.text : "") +
    " suffix",
);
assert(result.splitMap.imported!.length > 1);
assert.equal(sourceState(result.splitMap.imported!, result.pages), "imported");
assert.equal(sourceState(result.splitMap.imported!, pages), null);
assert.equal(
  sourceState(result.splitMap.imported!, [
    {
      blocks: [
        result.pages
          .flatMap((p) => p.blocks)
          .find((b) => b.id === result.splitMap.imported![0])!,
      ],
    },
  ]),
  "partial",
);
assert(issueContentSchema.safeParse({ pages: result.pages }).success);
await assert.rejects(
  paginateImport({
    pages: [
      ...pages,
      ...Array.from({ length: 197 }, (_, i) => ({
        id: `page${i}`,
        blocks: [],
      })),
    ],
    index: 1,
    selected: "prefix",
    inserted: [imported],
    fits,
    signal,
  }),
  /200 magazine pages/,
);
const heading = reviewItem(groups[0]!);
heading.block = {
  id: heading.id,
  type: "heading",
  title: "x".repeat(301),
  kicker: "",
};
assert.throws(() => synthesize([heading]), /300 characters/);
assert.deepEqual(
  pages[1]?.blocks.map((b) => b.id),
  ["prefix", "suffix"],
);
const marked: Block = {
  id: "marked",
  type: "text",
  text: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Bold words 🐦 ".repeat(20),
            marks: [{ type: "bold" }],
          },
          { type: "hardBreak" },
          {
            type: "text",
            text: "Italic words remain. ".repeat(10),
            marks: [{ type: "italic" }],
          },
        ],
      },
    ],
  },
};
const acceptedHeading: Block = {
  id: "article-heading",
  type: "heading",
  title: "Article",
  kicker: "",
};
const markedResult = await paginateImport({
  pages,
  index: 1,
  selected: "prefix",
  inserted: [acceptedHeading, marked],
  fits,
  signal,
});
assert.deepEqual(
  markedResult.pages[1]!.blocks.map((b) => b.id),
  ["prefix", "article-heading", "marked"],
  "A heading and the first measured text fragment use the destination's available space.",
);
function styledCharacters(blocks: Block[]) {
  return blocks.flatMap((block) =>
    block.type === "text" && typeof block.text !== "string"
      ? block.text.content.flatMap((paragraph) =>
          paragraph.type === "paragraph"
            ? (paragraph.content ?? []).flatMap((node): string[] =>
                node.type === "hardBreak"
                  ? ["hardBreak"]
                  : Array.from(node.text, (character) =>
                      JSON.stringify([character, node.marks ?? []]),
                    ),
              )
            : [],
        )
      : [],
  );
}
assert.deepEqual(
  styledCharacters(
    markedResult.pages
      .flatMap((p) => p.blocks)
      .filter((b) => markedResult.splitMap.marked!.includes(b.id)),
  ),
  styledCharacters([marked]),
  "Pagination preserves every Unicode character, explicit break and emphasis mark.",
);
for (const destination of [
  pages[0]!,
  {
    id: "photo-page",
    blocks: [
      {
        id: "photo",
        type: "image" as const,
        imageId: "existing",
        caption: "",
        width: 100,
        align: "page-fit" as const,
      },
    ],
  },
]) {
  const separated = await paginateImport({
    pages: [destination, pages[2]!],
    index: 0,
    selected: null,
    inserted: [text("new-body", "New body")],
    fits,
    signal,
  });
  assert.deepEqual(separated.pages[0], destination);
  assert.deepEqual(separated.pages[2], pages[2]);
  assert(!separated.pages[1]!.cover);
  assert.equal(separated.pages[1]!.blocks[0]!.id, "new-body");
}
// Crops: a phone photo (360x640) from a real Pages export, clipped to a near square.
const page = { x0: 0, y0: 0, x1: 595.28, y1: 892.91 };
const square = { x0: 0, y0: 0, x1: 100, y1: 100 };
const pixelsOf = (...args: Parameters<typeof cropOf>) => {
  const crop = cropOf(...args);
  return crop && crop !== "skewed" ? crop.pixels : crop;
};
const pages2 = cropOf(
  [271.0655, 0, 0, 481.8942, 21.62296, -84.39162],
  [{ x0: 56.74, y0: 113, x1: 292.69, y1: 344.15 }, page],
  360,
  640,
);
assert(pages2 && pages2 !== "skewed");
assert.deepEqual(pages2.pixels, { x: 47, y: 71, width: 313, height: 306 });
assert(Math.abs(pages2.rect.x0 - 56.74) < 0.5);
assert(Math.abs(pages2.rect.y1 - 344.15) < 0.5);
// Within a point of the edge: the whole image, unresampled.
assert.deepEqual(
  cropOf([100, 0, 0, 50, 10, 10], [{ x0: 9, y0: 9, x1: 111, y1: 61 }], 20, 10),
  { rect: { x0: 10, y0: 10, x1: 110, y1: 60 }, pixels: null },
);
// PDF y runs up and image rows run down: the clip's top half is the top rows.
assert.deepEqual(
  pixelsOf([100, 0, 0, 100, 0, 0], [{ ...square, y0: 50 }], 10, 10),
  { x: 0, y: 0, width: 10, height: 5 },
);
// A mirrored placement maps back to the right pixels.
assert.deepEqual(
  pixelsOf([-100, 0, 0, -100, 100, 100], [{ ...square, x1: 25 }], 8, 8),
  { x: 6, y: 0, width: 2, height: 8 },
);
// Clips intersect, and the page box crops a photo bleeding off its edge.
const bleed = cropOf(
  [200, 0, 0, 100, -100, 0],
  [{ x0: -50, y0: 0, x1: 300, y1: 80 }, page],
  20,
  10,
);
assert.deepEqual(bleed, {
  rect: { x0: 0, y0: 0, x1: 100, y1: 80 },
  pixels: { x: 10, y: 2, width: 10, height: 8 },
});
// Rotated artwork under a cutting clip falls back; uncut it still imports whole.
const turned = [0, 100, -100, 0, 100, 0] as const;
assert.equal(cropOf([...turned], [{ ...square, x1: 50 }], 10, 10), "skewed");
assert.deepEqual(cropOf([...turned], [page], 10, 10), {
  rect: square,
  pixels: null,
});
// Edges round inward: 5pt pixels cut 12pt in keep from the third pixel on.
const coarse = cropOf(
  [500, 0, 0, 500, 0, 0],
  [{ ...square, x0: 12, x1: 500, y1: 500 }],
  100,
  100,
);
assert(coarse && coarse !== "skewed");
assert.deepEqual(coarse.pixels, { x: 3, y: 0, width: 97, height: 100 });
assert.equal(coarse.rect.x0, 15);
// A cut of over a point but under a pixel drops the partly hidden pixel.
assert.deepEqual(
  pixelsOf(
    [300, 0, 0, 300, 0, 0],
    [{ x0: 1.2, y0: 0, x1: 300, y1: 300 }],
    100,
    100,
  ),
  { x: 1, y: 0, width: 99, height: 100 },
);
// Float noise in a nominally unrotated matrix still crops.
assert.deepEqual(
  pixelsOf([100, 6e-17, -6e-17, 100, 0, 0], [{ ...square, y0: 50 }], 10, 10),
  { x: 0, y: 0, width: 10, height: 5 },
);
// Nothing visible, or less than a pixel of it: no region.
const plain = [100, 0, 0, 100, 0, 0] as const;
assert.equal(
  cropOf([...plain], [{ ...square, x0: 200, x1: 300 }], 10, 10),
  null,
);
assert.equal(cropOf([...plain], [{ ...square, x1: 4 }], 10, 10), null);
console.log(
  "PDF import checks passed: ordering, corrections, alignment, Unicode/marks, schema limits, pagination progress/order, source/history states, image crops.",
);
