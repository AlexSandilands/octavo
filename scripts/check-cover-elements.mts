import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { issueContentSchema, makePage, type Page } from "../src/lib/blocks";
import {
  type CoverElement,
  coverSources,
  coverElementSchema,
  COVER_HEADLINE_SIZES,
  makeCoverElement,
  makeCoverStory,
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
const fresh = makeCoverElement("story"),
  logo = makeCoverElement("logo");
assert(fresh.type === "story");
assert(logo.type === "logo");
// A new Story starts blank: one empty story, nothing seeded on the author's behalf.
assert.deepEqual(
  [fresh.title, fresh.headlineSize, fresh.showPageNumbers, fresh.items.length],
  ["", "list", false, 1],
);
assert.deepEqual(
  [
    fresh.placement.column,
    fresh.placement.row,
    fresh.placement.width,
    fresh.placement.align,
  ],
  ["left", "center", "medium", "left"],
);
assert.deepEqual(
  [
    fresh.items[0]!.headingId,
    fresh.items[0]!.title,
    fresh.items[0]!.description,
  ],
  [undefined, "", ""],
);
const contents = {
  ...fresh,
  title: "Inside this issue",
  showPageNumbers: true,
  items: [
    { ...makeCoverStory("heading"), description: "Our community in focus." },
  ],
};
const story = { ...fresh, headlineSize: "display" as const };
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
// Entries step down a level under a list heading, and stand at h3 without one.
const render = (element: CoverElement) =>
  renderToStaticMarkup(
    createElement(PageBlocks, {
      page: { ...front, coverElements: [element] },
      theme: resolveTheme("classic"),
      images: {},
      sponsors: {},
      sources,
      issueNo: 42,
    }),
  );
const headed = render(contents);
assert(
  headed.includes('<h3 data-cover-copy="true" class="cover-story-heading"'),
);
assert(
  headed.includes('<h4 data-cover-copy="true" class="cover-story-headline"'),
);
assert(
  render({ ...contents, title: "" }).includes(
    '<h3 data-cover-copy="true" class="cover-story-headline"',
  ),
);
// A lone unlinked story keeps the size it was stored with: nothing promotes itself.
const lone = { ...story, items: [makeCoverStory()], headlineSize: "compact" };
const parsedLone = coverElementSchema.parse(lone);
assert(parsedLone.type === "story" && parsedLone.headlineSize === "compact");
assert(!parsedLone.items[0]!.headingId);
for (const size of COVER_HEADLINE_SIZES) {
  const parsed = coverElementSchema.parse({ ...story, headlineSize: size });
  assert(parsed.type === "story" && parsed.headlineSize === size);
}
assert(!coverElementSchema.safeParse({ ...story, items: [] }).success);
assert(
  !coverElementSchema.safeParse({ ...story, headlineSize: "huge" }).success,
);
for (const legacy of ["stories", "teaser", "contents"])
  assert(
    !coverElementSchema.safeParse({ ...contents, type: legacy }).success,
    `${legacy} is no longer a cover element type`,
  );
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
    items: Array.from({ length: 7 }, () => makeCoverStory()),
  }).success,
);
const seeds = buildIssues(
  Object.fromEntries(SEED_IMAGES.map((i) => [i.key, i.key])) as SeedImages,
);
seeds.forEach((i) => assert(issueContentSchema.safeParse(i.content).success));
assert.deepEqual(
  seeds.map((i) => i.number),
  [1, 2, 3, 4, 5, 6],
);
assert.equal(seeds[5]!.title, "Regatta — The Season Review");
for (const [index, issue] of seeds.entries()) {
  const front = issue.content.pages[0]!;
  if ([1, 3, 5].includes(index)) {
    assert.equal(front.coverElements?.length, 4);
    const sources = coverSources(issue.content.pages);
    const mark = front.coverElements.find((e) => e.type === "logo");
    assert(mark?.type === "logo" && mark.logoId && mark.imageId);
    for (const element of front.coverElements) {
      if (element.type === "story")
        for (const item of element.items)
          assert(sources.some((s) => s.id === item.headingId));
    }
  } else {
    assert.equal(front.coverElements, undefined);
    assert(
      !front.blocks.some(
        (b) =>
          b.type === "image" &&
          (b.align === "page-fill" || b.align === "page-fit"),
      ),
    );
  }
}
console.log(
  "PASS: Story defaults, stored headline sizes, heading hierarchy, schema bounds, references/page numbering, logo asset traversal, demotion preservation, all anchors, shared renderer and seed compatibility",
);
