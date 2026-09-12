import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { issueContentSchema, makePage, type Page } from "../src/lib/blocks";
import {
  coverSources,
  coverElementSchema,
  makeCoverElement,
  previewTitle,
  DEFAULT_COVER_PLACEMENT,
} from "../src/lib/cover-elements";
import { collectImageIds } from "../src/lib/images";
import { PageBlocks } from "../src/features/blocks/page-blocks";
import { resolveTheme } from "../src/features/blocks/themes/registry";
import { withCoverStyle } from "../src/features/editor/cover-layout";
import { buildIssues } from "../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";

for (const template of [
  "cover-classic",
  "cover-minimal",
  "cover-feature",
] as const) {
  const page = makePage(template);
  assert.equal(page.coverElements, undefined);
  assert(
    page.blocks.every((b) => !("coverPlacement" in b) || !b.coverPlacement),
  );
}
const body: Page = {
  id: "article",
  blocks: [
    { id: "heading", type: "heading", title: "The club story", kicker: "" },
  ],
};
const front: Page = {
  id: "cover",
  cover: true,
  blocks: [
    {
      id: "photo",
      type: "image",
      imageId: "photo",
      align: "page-fill",
      width: 100,
      caption: "",
    },
  ],
};
const contents = makeCoverElement("contents"),
  logo = makeCoverElement("logo");
assert(contents.type === "contents" && logo.type === "logo");
contents.items = [
  { headingId: "heading", title: "", description: "Our community in focus." },
];
contents.showPageNumbers = true;
logo.logoId = "club";
logo.imageId = "mark";
front.coverElements = [contents, logo];
const sources = coverSources([front, body]);
assert.equal(previewTitle(contents.items[0]!, sources), "The club story");
assert.equal(
  previewTitle({ ...contents.items[0]!, title: "A shorter headline" }, sources),
  "A shorter headline",
);
assert.equal(
  coverSources([front, { id: "blank", blocks: [] }, body])[0]?.pageNo,
  3,
);
assert.deepEqual(collectImageIds({ pages: [front] }).sort(), ["mark", "photo"]);
const demoted = withCoverStyle(front, false);
assert.deepEqual(demoted.coverElements, front.coverElements);
assert(
  demoted.blocks[0]?.type === "image" && demoted.blocks[0].align === "full",
);
for (const row of ["top", "center", "bottom"] as const)
  for (const column of ["left", "center", "right"] as const) {
    const page = {
      ...front,
      coverElements: [
        { ...contents, placement: { ...DEFAULT_COVER_PLACEMENT, row, column } },
      ],
    };
    assert(
      issueContentSchema.safeParse({ version: 7, pages: [page, body] }).success,
    );
    const html = renderToStaticMarkup(
      createElement(PageBlocks, {
        page,
        theme: resolveTheme("classic"),
        images: {},
        sponsors: {},
        sources,
        issueNo: 42,
      }),
    );
    assert(
      html.includes("The club story") &&
        html.includes("Page 2") &&
        html.includes(`data-row="${row}"`) &&
        html.includes(`data-column="${column}"`),
    );
  }
assert(!coverElementSchema.safeParse({ ...logo, size: 10000 }).success);
assert(
  !coverElementSchema.safeParse({
    ...contents,
    placement: { ...contents.placement, style: "rainbow" },
  }).success,
);
assert(
  !coverElementSchema.safeParse({
    ...contents,
    items: Array.from({ length: 7 }, (_, i) => ({
      headingId: String(i),
      title: "",
      description: "",
    })),
  }).success,
);
const seeds = buildIssues(
  Object.fromEntries(SEED_IMAGES.map((i) => [i.key, i.key])) as SeedImages,
);
seeds.forEach((i) => assert(issueContentSchema.safeParse(i.content).success));
assert.equal(seeds[5]?.content.pages[0]?.coverElements?.length, 3);
console.log(
  "PASS: opt-in defaults, schema bounds, references/page numbering, logo asset traversal, demotion preservation, all anchors, shared renderer and seed/legacy compatibility",
);
