import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  coverElementSchema,
  makeCoverElement,
} from "../src/lib/cover-elements";
import {
  COVER_FONT_IDS,
  clampWeight,
  coverFontStyle,
  elementFontContext,
  fontWeights,
} from "../src/lib/cover-fonts";
import { coverRichDocSchema, plainCoverDoc } from "../src/lib/cover-rich-text";
import { CONTENT_VERSION, issueContentSchema } from "../src/lib/blocks";
import { CoverElementView } from "../src/features/blocks/cover-element-view";
import { CoverRichText } from "../src/features/blocks/cover-rich-text";
import { buildIssues } from "../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";

const story = makeCoverElement("story");
assert.equal(story.type, "story");
if (story.type !== "story") throw new Error("Expected Story");
story.items[0]!.title = "Māori stories";
story.items[0]!.description = "Supporting copy";
assert.equal(CONTENT_VERSION, 8);
assert.deepEqual(
  COVER_FONT_IDS.map((f) => fontWeights(f).length),
  [7, 9, 9],
);
assert.deepEqual(coverFontStyle(), {});
assert.equal(clampWeight("newsreader", 900), 800);
assert.equal(clampWeight("newsreader", 100), 200);
assert.equal(clampWeight("hanken-grotesk", 900), 900);
for (const family of COVER_FONT_IDS) {
  for (const weight of fontWeights(family)) {
    assert(
      coverElementSchema.safeParse({
        ...story,
        headlineFont: family,
        headlineWeight: weight,
      }).success,
    );
    const doc = plainCoverDoc("Māori stories");
    doc.content[0]!.content![0] = {
      type: "text",
      text: "Māori stories",
      marks: [
        { type: "bold" },
        { type: "italic" },
        { type: "underline" },
        {
          type: "coverPaint",
          attrs: {
            fontFamily: family,
            fontWeight: weight,
            fontStyle: "italic",
            color: "paper",
            shadow: "strong",
          },
        },
      ],
    };
    assert(coverRichDocSchema.safeParse(doc).success);
    const html = renderToStaticMarkup(
      createElement(CoverRichText, { text: "Māori stories", doc }),
    );
    assert(
      html.includes(`font-weight:max(var(--cover-bold-weight, 0), ${weight})`),
    );
    assert(html.includes("font-style:italic"));
    assert(html.includes("max(700, var(--cover-font-weight, 700))"));
  }
}
for (const bad of [0, 150, 950, "900", "black", null])
  assert(
    !coverElementSchema.safeParse({ ...story, headlineWeight: bad }).success,
  );
assert(
  !coverElementSchema.safeParse({ ...story, headlineFont: "other" }).success,
);
assert(
  !coverElementSchema.safeParse({
    ...story,
    headlineFont: "newsreader",
    headlineWeight: 900,
  }).success,
);
const invalid = plainCoverDoc("Unsafe");
invalid.content[0]!.content = [
  {
    type: "text",
    text: "Unsafe",
    marks: [
      {
        type: "coverPaint",
        attrs: { fontFamily: "newsreader", fontWeight: 900 },
      },
    ],
  },
];
assert(!coverRichDocSchema.safeParse(invalid).success);
const legacy = coverElementSchema.parse(story);
assert(!("headlineFont" in legacy));
assert(!("headlineWeight" in legacy));
const html = renderToStaticMarkup(
  createElement(CoverElementView, { element: legacy, images: {} }),
);
assert(!html.includes("--font-cover-"));
const authored = {
  ...story,
  headlineFont: "roboto-condensed" as const,
  headlineWeight: 900 as const,
};
assert.deepEqual(elementFontContext(authored, `${story.items[0]!.id}:title`), {
  family: "roboto-condensed",
  weight: 900,
});
assert.deepEqual(
  elementFontContext(authored, `${story.items[0]!.id}:description`),
  { family: "hanken-grotesk", weight: 400 },
);
const styled = renderToStaticMarkup(
  createElement(CoverElementView, { element: authored, images: {} }),
);
assert.equal((styled.match(/--font-cover-roboto/g) ?? []).length, 1);
assert(styled.includes('class="cover-story-description">Supporting copy'));
const seeds = buildIssues(
  Object.fromEntries(SEED_IMAGES.map((i) => [i.key, i.key])) as SeedImages,
);
for (const issue of seeds)
  assert(issueContentSchema.safeParse(issue.content).success);
const elements = seeds[5]!.content.pages[0]!.coverElements!;
assert(
  elements.some(
    (e) =>
      e.type === "story" &&
      e.headlineFont === "newsreader" &&
      e.headlineWeight === 800,
  ),
);
assert(
  elements.some(
    (e) =>
      e.type === "story" &&
      e.headlineFont === "roboto-condensed" &&
      e.headlineWeight === 900,
  ),
);
assert(JSON.stringify(elements).includes('"fontFamily":"hanken-grotesk"'));
assert(
  seeds[4]!.content.pages.some((p) =>
    p.blocks.some((b) => b.type === "text" && typeof b.text === "string"),
  ),
);
console.log(
  "PASS: cover weights, validation, legacy defaults, renderer parity, bold inheritance, field contexts and v8/legacy seeds",
);
