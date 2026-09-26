// The assistant's projection over every seed issue (#309), in memory:
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-assistant-projection.mts
// Each projection stays under the route's limit, lists every block id of the
// page it shows exactly once, gives every page a fill figure, keeps photo ids
// opaque (no url or file name), and each text block's markdown round-trips through the rich-text
// schema unchanged. Fills here are stand-ins: the real figures come from the
// editor's DOM measurement, which `dev-assistant-panel-gate.mts` checks.
import assert from "node:assert/strict";
import { buildIssues } from "../src/db/seed-data";
import { SEED_LOGOS } from "../src/db/seed/cover-elements";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";
import { isPageOwning, type Page } from "../src/lib/blocks";
import { collectImageIds } from "../src/lib/images";
import { createId } from "../src/lib/id";
import { docToMarkdown, markdownToDoc } from "../src/lib/markdown-doc";
import { richDocSchema, stringToDoc } from "../src/lib/rich-text-doc";
import type { AssistantIssue } from "../src/features/editor/assistant/issue-context";
import {
  describeFill,
  fillFromMeasure,
  type PageFill,
} from "../src/features/editor/assistant/page-fill";
import {
  PROJECTION_MAX,
  outline,
  pageView,
  projection,
} from "../src/features/editor/assistant/projection";

// Opaque ids, as the database mints them: nothing in an id may name the photo.
const ids = Object.fromEntries(
  SEED_IMAGES.map((s) => [s.key, createId()]),
) as SeedImages;
// The editor hands over its ImageMap, urls and all; none of it may leak.
const shapes = Object.fromEntries(
  SEED_IMAGES.map((s) => [
    ids[s.key],
    { url: `/uploads/seed/${s.key}.webp`, width: s.width, height: s.height },
  ]),
);

const standInFill = (page: Page): PageFill =>
  page.cover
    ? { kind: "cover" }
    : page.blocks.some(isPageOwning)
      ? { kind: "photo-page" }
      : fillFromMeasure({ used: 400, avail: 800 });

const blockIds = (page: Page) => [
  ...page.blocks.map((b) => b.id),
  ...(page.coverElements ?? []).map((e) => e.id),
];
const count = (text: string, needle: string) =>
  text.split(`[${needle}]`).length - 1;

let pages = 0;
let textBlocks = 0;
for (const seed of buildIssues(ids)) {
  const placed = collectImageIds(seed.content);
  const spare = Object.values(ids).find((id) => !placed.includes(id))!;
  const issue: AssistantIssue = {
    title: seed.title,
    theme: seed.theme,
    pages: seed.content.pages,
    images: shapes,
    // One unplaced upload, so the header's list is exercised.
    uploads: [...placed, spare],
    logos: SEED_LOGOS.map((l) => ({ id: l.id, name: l.name })),
    sponsorNames: ["Harbour Chandlery"],
    fills: Object.fromEntries(
      seed.content.pages.map((p) => [p.id, standInFill(p)]),
    ),
  };

  const lines = outline(issue).split("\n");
  assert.equal(lines.length, issue.pages.length, `${seed.title}: outline`);
  for (const line of lines)
    assert.match(
      line,
      /· (fits, ~\d+% full|overflows by ~\d+ lines?|a full-page photo)$| cover$/,
      `${seed.title}: a fill figure on "${line}"`,
    );

  issue.pages.forEach((page, i) => {
    pages++;
    const whole = projection(issue, i + 1);
    assert(whole.length <= PROJECTION_MAX, `${seed.title} p${i + 1}: size`);
    assert(whole.includes(`Photos uploaded but not placed: ${spare} (`));
    for (const id of blockIds(page)) {
      assert.equal(count(whole, id), 1, `${seed.title} p${i + 1}: [${id}]`);
      assert.equal(count(pageView(issue, i + 1), id), 1);
    }
    assert(!/\/uploads\/|\.webp/.test(whole), `${seed.title}: a photo url`);

    for (const block of page.blocks) {
      if (block.type !== "text" || page.cover) continue;
      textBlocks++;
      const doc =
        typeof block.text === "string" ? stringToDoc(block.text) : block.text;
      // The projection drops empty paragraphs; the rest must survive exactly.
      const kept = {
        ...doc,
        content: doc.content.filter(
          (b) => b.type !== "paragraph" || (b.content?.length ?? 0) > 0,
        ),
      };
      const back = markdownToDoc(docToMarkdown(doc));
      assert.deepEqual(back.notes, [], `${block.id}: notes`);
      assert.deepEqual(richDocSchema.parse(back.doc), kept, `${block.id}`);
    }
  });

  assert.match(pageView(issue, 999), /^There is no page 999; this issue has/);
}

// The fill wording against the measurement it comes from.
assert.equal(
  describeFill(fillFromMeasure({ used: 640, avail: 800 })),
  "fits, ~80% full",
);
assert.equal(
  describeFill(fillFromMeasure({ used: 800.5, avail: 800 })),
  "fits, ~100% full",
);
assert.equal(
  describeFill(fillFromMeasure({ used: 810, avail: 800 })),
  "overflows by ~1 line",
);
assert.equal(
  describeFill(fillFromMeasure({ used: 926, avail: 800 })),
  "overflows by ~6 lines",
);
assert.equal(describeFill(undefined), "fill not measured");

// A projection past the limit is cut, never the header or the outline.
const huge: AssistantIssue = {
  title: "Long",
  theme: "classic",
  pages: [
    {
      id: "p",
      blocks: Array.from({ length: 60 }, (_, i) => ({
        id: `t${i}`,
        type: "text" as const,
        text: stringToDoc("word ".repeat(3000)),
      })),
    },
  ],
  images: {},
  uploads: [],
  logos: [],
  sponsorNames: [],
  fills: {},
};
const cut = projection(huge, 1);
assert(cut.length <= PROJECTION_MAX && cut.startsWith("ISSUE"));
assert(cut.includes("[…]"));

console.log(
  `projection: ${pages} pages over ${buildIssues(ids).length} seed issues, ${textBlocks} text blocks round-tripped`,
);
