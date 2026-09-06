// Dev-only: validates the content v6 full-bleed image placement (issue #227)
// *in memory* — no database, no storage, no dev server, no network. It is the
// seed check for the v6 bump (`npm run db:seed` wipes every authored issue, so
// it must never be run to verify a content-model change) and the mechanical
// half of the "identical on all four surfaces" criterion:
//
//   - every seeded issue still validates and stamps CONTENT_VERSION,
//   - the seed authors exactly one fill-page image, alone on a non-cover page of
//     the camera-club issue, with alt text and no caption,
//   - "page" is confined to the image block: a montage or video carrying it is
//     refused by the schema,
//   - a version-5 document still parses, keeps its version and gains nothing,
//   - the shared renderers agree: the reader/print page and the library
//     thumbnail both put the photo over the whole PAGE_W×PAGE_H canvas, crop it
//     to fill, drop the caption and drop the running footer — while an ordinary
//     page on the same code path keeps its footer,
//   - the mobile reader (which has no pages) shows the same photo full width and
//     uncropped,
//   - and a cover page ignores the placement, which is why it is never offered
//     there.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-fill-page-gate.mts
// (the --tsconfig is not optional — see the note in dev-thumb-anchor-gate.mts.)
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONTENT_VERSION,
  issueContentSchema,
  type Block,
  type Page,
} from "../src/lib/blocks";
import { DEFAULT_FOOTER_STYLE } from "../src/lib/branding";
import type { SiteSettings } from "../src/lib/branding";
import type { ImageMap } from "../src/lib/images";
import { isFillPage, pageFillsCanvas } from "../src/features/blocks/layout";
import { PAGE_H, PAGE_PAD, PAGE_W } from "../src/features/blocks/page-frame";
import { PageFrame } from "../src/features/blocks/page-frame";
import { PageBlocks } from "../src/features/blocks/page-blocks";
import { CoverThumb } from "../src/features/library/cover-thumb";
import { MobileBlock } from "../src/features/reader/mobile-block";
import { resolveTheme } from "../src/features/blocks/themes/registry";
import { buildIssues } from "../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

// 1. The seed, built with stand-in image ids (the real seed mints a uuid a row).
const img = Object.fromEntries(
  SEED_IMAGES.map((s) => [s.key, `id-${s.key}`]),
) as SeedImages;
const issues = buildIssues(img);
ok(issues.length === 6, "buildIssues still returns the six seed issues");

for (const issue of issues) {
  const parsed = issueContentSchema.safeParse(issue.content);
  if (!parsed.success) {
    throw new Error(
      `FAIL: issue ${issue.number} failed issueContentSchema: ` +
        JSON.stringify(parsed.error.issues, null, 2),
    );
  }
  ok(
    parsed.data.version === CONTENT_VERSION,
    `issue ${issue.number} stamps content version ${CONTENT_VERSION}`,
  );
}

// 2. Exactly one fill-page image, and it owns its page.
const filled: { issue: number; page: Page; block: Block }[] = [];
for (const issue of issues) {
  for (const page of issue.content.pages) {
    for (const block of page.blocks) {
      if (isFillPage(block)) filled.push({ issue: issue.number, page, block });
    }
  }
}
ok(
  filled.length === 1,
  `seed authors exactly one fill-page image (got ${filled.length})`,
);
const seeded = filled[0]!;
ok(seeded.issue === 2, `it lives on issue 2 (got ${seeded.issue})`);
ok(!seeded.page.cover, "…on a normal page, not a cover");
ok(seeded.page.blocks.length === 1, "…alone on that page (it owns it)");
ok(
  seeded.block.type === "image" && Boolean(seeded.block.imageId),
  "…and carries an image",
);
ok(
  seeded.block.type === "image" && (seeded.block.alt ?? "").trim().length > 0,
  "…described for screen readers (alt survives the placement)",
);
ok(
  seeded.block.type === "image" && seeded.block.caption === "",
  "…with no caption (there is no margin to set one in)",
);
ok(pageFillsCanvas(seeded.page), "pageFillsCanvas agrees the page is filled");

// 3. The placement is confined to the image block: the other two picture blocks
//    kept the three-value union, so the schema refuses it.
for (const type of ["montage", "video"] as const) {
  const doc = {
    version: CONTENT_VERSION,
    pages: [
      {
        id: "p1",
        blocks: [
          type === "montage"
            ? { id: "b1", type, items: [], align: "page" }
            : { id: "b1", type, videoId: "dQw4w9WgXcQ", align: "page" },
        ],
      },
    ],
  };
  ok(
    !issueContentSchema.safeParse(doc).success,
    `a ${type} block cannot take the fill-page placement`,
  );
}

// 4. A version-5 document survives untouched — the additive-bump guarantee.
const v5 = {
  version: 5,
  pages: [
    {
      id: "p1",
      cover: true,
      blocks: [
        { id: "b1", type: "heading", kicker: "k", title: "t" },
        { id: "b2", type: "text", text: "legacy string" },
        { id: "b3", type: "image", caption: "c", align: "full", width: 100 },
        { id: "b4", type: "montage", items: [{ imageId: "i1", alt: "a" }] },
        { id: "b5", type: "video", videoId: "dQw4w9WgXcQ" },
        { id: "b6", type: "sponsor", name: "Acme" },
      ],
    },
  ],
};
const old = issueContentSchema.safeParse(v5);
ok(old.success, "a version-5 document still validates under the v6 schema");
ok(
  old.success && old.data.version === 5,
  "…and keeps its stored version (no silent rewrite)",
);
const parsedV5 = JSON.stringify(old.success ? old.data : null);
ok(
  !parsedV5.includes('"align":"page"'),
  "…and gains none of v6's placement (the new value is opt-in only)",
);
ok(
  old.success &&
    JSON.stringify(issueContentSchema.parse(old.data)) === parsedV5,
  "…and re-parsing it changes nothing further",
);

// 5. The fixed-canvas surfaces. The reader spread, the editor canvas, the
//    library thumbnail and the print document all draw a page through PageFrame
//    + blockFlowStyle; the two rendered here are the two that are server-only.
const IMAGE_ID = "img-1";
// No intrinsic dimensions on purpose: BlockImage then takes its plain-<img>
// branch, which is the one this script can render (next/image is a Next
// build-time component and resolves to nothing outside the framework). Both
// branches take the identical class string, which is what is asserted below.
const images: ImageMap = {
  [IMAGE_ID]: {
    url: "https://cdn.example/plate.webp",
    width: null,
    height: null,
  },
};
const bledPage: Page = {
  id: "p-bleed",
  blocks: [
    {
      id: "b-bleed",
      type: "image",
      imageId: IMAGE_ID,
      caption: "A caption that must not print over the photo",
      alt: "A tall duotone study",
      align: "page",
      width: 50,
    },
  ],
};
const plainPage: Page = {
  id: "p-plain",
  blocks: [
    {
      id: "b-plain",
      type: "image",
      imageId: IMAGE_ID,
      caption: "An ordinary captioned photo",
      alt: "A tall duotone study",
      align: "full",
      width: 100,
    },
  ],
};

const settings: SiteSettings = {
  name: "The Magazine",
  org: "The Club",
  tagline: "",
  footer: DEFAULT_FOOTER_STYLE,
  pdfDownloads: false,
};

// The reader spread and the print document render exactly this pair.
const framed = (page: Page, theme: string) =>
  renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- as createElement's third argument it doesn't satisfy PageFrame's required `children` prop under tsc.
    createElement(PageFrame, {
      theme: resolveTheme(theme),
      w: PAGE_W,
      h: PAGE_H,
      issueNo: 1,
      pageNo: 4,
      settings,
      bleed: pageFillsCanvas(page),
      children: createElement(PageBlocks, {
        page,
        theme: resolveTheme(theme),
        images,
        sponsors: {},
      }),
    }),
  );

const thumbed = (page: Page, theme: string) =>
  renderToStaticMarkup(
    createElement(CoverThumb, {
      page,
      theme,
      images,
      sponsors: {},
      issueNo: 1,
      settings,
      width: PAGE_W,
    }),
  );

// The geometry blockFlowStyle emits for a full-bleed block, as React serialises
// it — the whole canvas, pulled back over the page's own margin.
const GEOMETRY = `position:absolute;top:-${PAGE_PAD}px;left:-${PAGE_PAD}px;width:${PAGE_W}px;height:${PAGE_H}px`;

for (const theme of ["classic", "modern"]) {
  for (const [surface, render] of [
    ["page", framed],
    ["thumbnail", thumbed],
  ] as const) {
    const bled = render(bledPage, theme);
    ok(
      bled.includes(GEOMETRY),
      `[${theme}/${surface}] the photo covers the whole canvas (${GEOMETRY})`,
    );
    ok(
      bled.includes("object-cover"),
      `[${theme}/${surface}] …cropped to fill rather than letterboxed`,
    );
    ok(
      !bled.includes("data-page-footer"),
      `[${theme}/${surface}] …with no running footer over the photo`,
    );
    ok(
      !bled.includes("A caption that must not print"),
      `[${theme}/${surface}] …and no caption`,
    );

    // The same renderer, an ordinary page: nothing about it changed.
    const plain = render(plainPage, theme);
    ok(
      !plain.includes(GEOMETRY) && !plain.includes("object-cover"),
      `[${theme}/${surface}] an ordinary photo keeps its own flow style`,
    );
    ok(
      plain.includes("data-page-footer"),
      `[${theme}/${surface}] …and its page keeps the running footer`,
    );
    ok(
      plain.includes("An ordinary captioned photo"),
      `[${theme}/${surface}] …and its caption`,
    );
  }
}

// 6. The mobile reader has no pages to bleed off, so it goes full column width
//    at the photo's own aspect ratio — no crop of a crop.
const mobile = renderToStaticMarkup(
  createElement(MobileBlock, {
    block: bledPage.blocks[0]!,
    m: 18,
    images,
    sponsors: {},
  }),
);
ok(
  mobile.includes("-mx-5"),
  "mobile: the fill-page photo runs edge to edge of the column",
);
ok(
  !mobile.includes("object-cover"),
  "mobile: …at its own aspect ratio, uncropped",
);

// 7. A cover ignores the placement entirely — which is why the editor does not
//    offer it there, and why the library thumbnail (always a cover) is untouched.
const coverPage: Page = { ...bledPage, id: "p-cover", cover: true };
ok(
  !pageFillsCanvas(coverPage),
  "a cover page is never treated as filled (its title owns the page)",
);
const coverHtml = thumbed(coverPage, "classic");
ok(
  !coverHtml.includes(GEOMETRY) && !coverHtml.includes("object-cover"),
  "…so the same block renders as an ordinary centred cover photo",
);
ok(
  coverHtml.includes("data-page-footer"),
  "…and the cover keeps its running footer",
);

console.log("\nall checks passed");
