// Cover composition regression gate. Optional local browser pass creates and
// removes its own issue/admin; existing images are referenced read-only.
// npx tsx --tsconfig scripts/tsconfig.json scripts/dev-cover-overlay-gate.mts [base-url]
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  coverOverlaySchema,
  issueContentSchema,
  type Page,
} from "../src/lib/blocks";
import {
  setCoverBackground,
  withCoverStyle,
} from "../src/features/editor/cover-layout";
import { PageBlocks } from "../src/features/blocks/page-blocks";
import { MobileCover } from "../src/features/reader/mobile-cover";
import { resolveTheme } from "../src/features/blocks/themes/registry";

const cover: Page = {
  id: "cover",
  cover: true,
  blocks: [
    {
      id: "heading",
      type: "heading",
      kicker: "The Members’ Magazine",
      title: "Out in the Field",
    },
    {
      id: "photo",
      type: "image",
      imageId: "photo",
      caption: "Hidden background caption",
      alt: "Club members in the field",
      align: "full",
      width: 55,
    },
    {
      id: "tagline",
      type: "text",
      text: "September 2026 · Stories from our community",
    },
  ],
};
const styles = coverOverlaySchema.shape.style.options;
const positions = coverOverlaySchema.shape.position.options;
const images = { photo: { url: "/cover.webp", width: null, height: null } };
assert.deepEqual(
  issueContentSchema.parse({ version: 6, pages: [cover] }).pages,
  [cover],
);
assert(
  !coverOverlaySchema.safeParse({ style: "arbitrary", position: "top" })
    .success,
);
assert(
  !coverOverlaySchema.safeParse({ style: "light", position: "left" }).success,
);
for (const align of ["page-fill", "page-fit"] as const) {
  const filled = setCoverBackground(cover, "photo", align);
  assert.equal(filled.blocks.length, cover.blocks.length);
  assert.equal(
    cover.blocks[1]!.type === "image" && cover.blocks[1]!.align,
    "full",
  );
  const demoted = withCoverStyle(filled, false);
  assert.deepEqual(
    demoted.blocks,
    cover.blocks,
    "demotion preserves every block and normal width",
  );
  const single = { ...filled, blocks: [filled.blocks[1]!] };
  assert.deepEqual(
    withCoverStyle(single, false).blocks,
    single.blocks,
    "image-only demotion keeps Fill/Fit",
  );
  const replaced = setCoverBackground(
    {
      ...filled,
      blocks: [...filled.blocks, { ...cover.blocks[1]!, id: "second" }],
    },
    "second",
    align,
  );
  assert.equal(
    replaced.blocks[1]!.type === "image" && replaced.blocks[1]!.align,
    "full",
  );
  for (const style of styles)
    for (const position of positions) {
      const page = { ...filled, coverOverlay: { style, position } };
      assert.deepEqual(
        issueContentSchema.parse(
          JSON.parse(JSON.stringify({ version: 6, pages: [page] })),
        ).pages[0],
        page,
      );
      for (const theme of ["classic", "modern"]) {
        const html = renderToStaticMarkup(
          createElement(PageBlocks, {
            page,
            theme: resolveTheme(theme),
            images,
            sponsors: {},
          }),
        );
        assert(html.includes(`data-cover-style="${style}"`));
        assert(html.includes(`data-cover-position="${position}"`));
        assert(
          html.includes("Out in the Field") && html.includes("September 2026"),
        );
        assert(
          html.includes(
            align === "page-fill" ? "object-cover" : "object-contain",
          ),
        );
        assert(!html.includes("Hidden background caption"));
      }
      const mobile = renderToStaticMarkup(
        createElement(MobileCover, {
          page,
          images,
          sponsors: {},
          m: 19,
          minHeight: "calc(100dvh - 52px)",
        }),
      );
      assert(
        mobile.includes(
          align === "page-fill" ? "object-cover" : "object-contain",
        ),
      );
      assert(
        mobile.includes("Out in the Field") &&
          mobile.includes("data-cover-copy"),
      );
    }
}
console.log(
  "PASS: legacy schema, all cover styles/positions, Fill/Fit, content preservation, background replacement and cover demotion",
);

const base = process.argv[2];
if (base) {
  const { browserPass } = await import("./cover-overlay-browser.mts");
  await browserPass(base, cover);
}
