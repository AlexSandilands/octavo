// Dev-only: validates the content v6 full-bleed image placement (issue #227)
// *in memory* — no database, no storage, no dev server, no network. It is the
// seed check for the v6 bump (`npm run db:seed` wipes every authored issue, so
// it must never be run to verify a content-model change) and the mechanical
// half of the "identical on all four surfaces" criterion:
//
//   - every seeded issue still validates and stamps CONTENT_VERSION,
//   - the seed authors exactly one image of each page-owning placement — the
//     portrait fill-page plate alone on a non-cover page of the camera-club
//     issue, the landscape fit-page plate alone on one of the sailing issue's —
//     each with alt text and no caption,
//   - both values are confined to the image block: a montage or video carrying
//     one is refused by the schema,
//   - a version-5 document still parses, keeps its version and gains nothing,
//   - the shared renderers agree: the reader/print page and the library
//     thumbnail both put the photo over the whole PAGE_W×PAGE_H canvas, drop the
//     caption and drop the running footer, cropping it to fill for "page-fill"
//     and fitting it whole against page-coloured bars for "page-fit" — while an
//     ordinary page on the same code path keeps its footer,
//   - the mobile reader (which has no pages) shows the same photo full width and
//     uncropped,
//   - and a cover page ignores the placement, which is why it is never offered
//     there.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-fill-page-gate.mts
// (the --tsconfig is not optional — see the note in dev-thumb-anchor-gate.mts.)
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CONTENT_VERSION,
  issueContentSchema,
  PAGE_ALIGNS,
  type Block,
  type Page,
  type PageAlign,
} from "../src/lib/blocks";
import { DEFAULT_FOOTER_STYLE } from "../src/lib/branding";
import type { SiteSettings } from "../src/lib/branding";
import type { ImageMap } from "../src/lib/images";
import {
  isFillPage,
  pageAlignOf,
  pageFillsCanvas,
} from "../src/features/blocks/layout";
import { PAGE_H, PAGE_PAD, PAGE_W } from "../src/features/blocks/page-frame";
import { PageFrame } from "../src/features/blocks/page-frame";
import { PageBlocks } from "../src/features/blocks/page-blocks";
import { CoverThumb } from "../src/features/library/cover-thumb";
import { MobileBlock } from "../src/features/reader/mobile-block";
import { readerSections } from "../src/features/reader/mobile-sections";
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

// 2. Exactly one image of each page-owning placement, and each owns its page.
const owned: { issue: number; page: Page; block: Block }[] = [];
for (const issue of issues) {
  for (const page of issue.content.pages) {
    for (const block of page.blocks) {
      if (isFillPage(block)) owned.push({ issue: issue.number, page, block });
    }
  }
}
for (const [align, expectIssue] of [
  ["page-fill", 2],
  ["page-fit", 4],
] as const) {
  const found = owned.filter((o) => pageAlignOf(o.block) === align);
  ok(
    found.length === 1,
    `seed authors exactly one "${align}" image (got ${found.length})`,
  );
  const seeded = found[0]!;
  ok(
    seeded.issue === expectIssue,
    `…on issue ${expectIssue} (got ${seeded.issue})`,
  );
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
  ok(pageFillsCanvas(seeded.page), "…and pageFillsCanvas agrees it owns it");
}
ok(
  owned.length === 2,
  `and nothing else in the seed takes the page (got ${owned.length})`,
);

// 3. Both placements are confined to the image block: the other two picture
//    blocks kept the three-value union, so the schema refuses them.
for (const type of ["montage", "video"] as const) {
  for (const align of PAGE_ALIGNS) {
    const doc = {
      version: CONTENT_VERSION,
      pages: [
        {
          id: "p1",
          blocks: [
            type === "montage"
              ? { id: "b1", type, items: [], align }
              : { id: "b1", type, videoId: "dQw4w9WgXcQ", align },
          ],
        },
      ],
    };
    ok(
      !issueContentSchema.safeParse(doc).success,
      `a ${type} block cannot take the "${align}" placement`,
    );
  }
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
  PAGE_ALIGNS.every((a) => !parsedV5.includes(`"align":"${a}"`)),
  "…and gains neither of v6's placements (both are opt-in only)",
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
const ownedPage = (align: PageAlign): Page => ({
  id: `p-${align}`,
  blocks: [
    {
      id: `b-${align}`,
      type: "image",
      imageId: IMAGE_ID,
      caption: "A caption that must not print over the photo",
      alt: "A tall duotone study",
      align,
      width: 50,
    },
  ],
});
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
      cover: page.cover,
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
    for (const align of PAGE_ALIGNS) {
      const bled = render(ownedPage(align), theme);
      const crop = align === "page-fill" ? "object-cover" : "object-contain";
      ok(
        bled.includes(GEOMETRY),
        `[${theme}/${surface}/${align}] the photo takes the whole canvas (${GEOMETRY})`,
      );
      ok(
        bled.includes(crop),
        `[${theme}/${surface}/${align}] …${align === "page-fill" ? "cropped to fill" : "fitted whole, not cropped"} (${crop})`,
      );
      ok(
        bled.includes('class="bg-page h-full"'),
        `[${theme}/${surface}/${align}] …on the page's own colour, so a fitted photo's bars match the page`,
      );
      ok(
        !bled.includes("data-page-footer"),
        `[${theme}/${surface}/${align}] …with no running footer over the photo`,
      );
      ok(
        !bled.includes("A caption that must not print"),
        `[${theme}/${surface}/${align}] …and no caption`,
      );
    }

    // The same renderer, an ordinary page: nothing about it changed.
    const plain = render(plainPage, theme);
    ok(
      !plain.includes(GEOMETRY) &&
        !plain.includes("object-cover") &&
        !plain.includes("object-contain"),
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
for (const align of PAGE_ALIGNS) {
  const mobile = renderToStaticMarkup(
    createElement(MobileBlock, {
      block: ownedPage(align).blocks[0]!,
      m: 18,
      images,
      sponsors: {},
    }),
  );
  ok(
    mobile.includes("-mx-5"),
    `mobile: a "${align}" photo runs edge to edge of the column`,
  );
  ok(
    !mobile.includes("object-cover") && !mobile.includes("object-contain"),
    "mobile: …at its own aspect ratio, neither cropped nor boxed",
  );
  ok(
    !/class="[^"]*\bmy?-\d/.test(mobile) && !/class="[^"]*\bmt-\d/.test(mobile),
    "mobile: …with no vertical margin, so it fills the section it owns",
  );
}

// The column's sections carry the flag the padding rule reads, and only on the
// pages a photo owns.
const allSections = issues.flatMap((issue) =>
  readerSections(issue.content.pages).map((s) => ({
    s,
    page: issue.content.pages.find((p) => p.id === s.id)!,
  })),
);
ok(
  allSections.every(({ s, page }) => s.filled === pageFillsCanvas(page)),
  `mobile: every one of the ${allSections.length} sections agrees with its page on who owns it`,
);
ok(
  allSections.filter(({ s }) => s.filled).length === 2,
  "mobile: …and exactly the two page-owning sections drop their padding",
);
// The photo's page is banded either side, so the band the column draws between
// two pages is what the photo runs between (it has no heading to be banded on).
const bandCheck = readerSections([
  {
    id: "p0",
    cover: true,
    blocks: [{ id: "b0", type: "text", text: "cover" }],
  },
  { id: "p1", blocks: [{ id: "b1", type: "text", text: "body" }] },
  { ...ownedPage("page-fit"), id: "p2" },
  { id: "p3", blocks: [{ id: "b3", type: "text", text: "after" }] },
]).map((s) => s.divided);
ok(
  JSON.stringify(bandCheck) === "[false,true,true,true]",
  `mobile: a photo-owned page is banded either side (${JSON.stringify(bandCheck)})`,
);

// 7. Covers ignore page-owning image placement and omit the running footer
//    in both render paths and themes, while retaining their theme decoration.
for (const theme of ["classic", "modern"]) {
  for (const [surface, render] of [
    ["page", framed],
    ["thumbnail", thumbed],
  ] as const) {
    for (const align of PAGE_ALIGNS) {
      const coverPage: Page = {
        ...ownedPage(align),
        id: "p-cover",
        cover: true,
      };
      const label = `[${theme}/${surface}/${align}]`;
      ok(
        !pageFillsCanvas(coverPage),
        `${label} a cover never treats the image as owning the page`,
      );
      const coverHtml = render(coverPage, theme);
      ok(
        !coverHtml.includes(GEOMETRY) &&
          !coverHtml.includes("object-cover") &&
          !coverHtml.includes("object-contain"),
        `${label} the image keeps its ordinary centred cover treatment`,
      );
      ok(
        !coverHtml.includes("data-page-footer"),
        `${label} the cover omits its running footer`,
      );
      const decoration = renderToStaticMarkup(
        createElement(
          Fragment,
          null,
          resolveTheme(theme).page.decoration({
            issueNo: 1,
            side: surface === "page" ? "left" : "right",
            magazineName: settings.name,
          }),
        ),
      );
      ok(
        decoration.length > 0 && coverHtml.includes(decoration),
        `${label} the cover keeps its theme decoration`,
      );
    }
  }
}

console.log("\nall checks passed");
