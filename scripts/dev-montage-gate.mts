// Dev-only: validates montage compatibility and per-image captions (#95, #280) *in memory* —
// no database, no storage, no dev server. It builds the seed issues with fake
// image ids and asserts, through the same zod schema the save path runs:
//
//   - every seeded issue still validates and stamps CONTENT_VERSION,
//   - the seed authors per-image captions and one deliberate legacy montage,
//   - collectImageIds reaches into montage slides, so the readers can resolve
//     them (a montage whose ids were missed renders as an empty frame),
//   - the deliberate legacy fixture (a plain string + a constrained-HTML string
//     body, see docs/database.md) survives the bump,
//   - a version-3 document — the additive-bump guarantee — still parses and
//     keeps its stored version.
//
// This is the seed check for the v8 bump: `npm run db:seed` wipes every
// authored issue, so it must never be run to verify a content-model change.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-montage-gate.mts
import {
  CONTENT_VERSION,
  issueContentSchema,
  type Block,
} from "../src/lib/blocks";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { blockEditHistoryGroup } from "../src/features/editor/block-edit-history";
import { BlockView } from "../src/features/blocks/block-view";
import { resolveMontageSlides } from "../src/features/blocks/montage";
import { MontageCaption } from "../src/features/blocks/montage-caption";
import { getTheme } from "../src/features/blocks/themes/registry";
import { montageItemSchema } from "../src/lib/blocks";
import { collectImageIds } from "../src/lib/images";
import { buildIssues } from "../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

// Stand-in image ids (the real seed mints a uuid per generated image row), kept
// derivable from the art key so the manifest check below can invert them.
const img = Object.fromEntries(
  SEED_IMAGES.map((s) => [s.key, `id-${s.key}`]),
) as SeedImages;

const issues = buildIssues(img);
ok(issues.length === 6, "buildIssues still returns the six seed issues");

// 1. Every seeded issue validates through the save path's schema.
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

// 2. A current montage on the camera-club issue, plus one legacy fixture.
type Montage = Extract<Block, { type: "montage" }>;
const montages: { issue: number; block: Montage }[] = [];
for (const issue of issues) {
  for (const page of issue.content.pages) {
    for (const block of page.blocks) {
      if (block.type === "montage") {
        montages.push({ issue: issue.number, block });
      }
    }
  }
}
ok(
  montages.length === 2,
  `seed authors a current and a legacy montage (got ${montages.length})`,
);
const found = montages[0]!;
ok(found.issue === 2, `the montage lives on issue 2 (got ${found.issue})`);

const m = found.block;
ok(m.items.length === 3, `the montage holds 3 slides (got ${m.items.length})`);
ok(
  m.items.every((i) => i.imageId !== "" && i.alt.trim().length > 10),
  "every slide carries an image id and real alt text",
);
ok(
  new Set(m.items.map((i) => i.imageId)).size === 3,
  "the three slides are three different images",
);
ok(m.interval === 5, `interval is the 5-second default (got ${m.interval})`);
ok(m.align === "full" && m.width === 100, "placement defaults to full width");
ok(m.caption === "", "new montage does not use a shared caption");
ok(m.items[0]?.caption?.trim(), "first image carries its own caption");
ok(m.items[1]?.caption?.trim(), "second image carries a different caption");
ok(m.items[2]?.caption === "", "third image deliberately has no caption");
const legacyMontage = montages.find((entry) => entry.issue === 5)!.block;
ok(legacyMontage.caption.trim(), "legacy seed retains its shared caption");
ok(
  legacyMontage.items.every((item) => !("caption" in item)),
  "legacy items keep their original shape",
);

// 3. The slides are reachable by the image resolver the readers use.
const ids = collectImageIds(issues[1]!.content);
for (const item of m.items) {
  ok(
    ids.includes(item.imageId),
    `collectImageIds picks up montage slide ${item.imageId}`,
  );
}

// 4. Each referenced image is a real art spec, so the seed can generate bytes.
const keys = new Set<string>(SEED_IMAGES.map((s) => s.key));
for (const item of m.items) {
  ok(
    keys.has(item.imageId.replace(/^id-/, "")),
    `slide ${item.imageId} maps to a generated art spec`,
  );
}

// 5. The deliberate legacy fixture survives the bump.
const hasRawString = issues.some((i) =>
  i.content.pages.some((p) =>
    p.blocks.some((b) => b.type === "text" && typeof b.text === "string"),
  ),
);
ok(hasRawString, "a deliberately legacy-shaped (string) text block remains");
const hasLegacyHtml = issues.some((i) =>
  i.content.pages.some((p) =>
    p.blocks.some(
      (b) =>
        b.type === "text" &&
        typeof b.text === "string" &&
        /<(em|strong|a)\b/.test(b.text),
    ),
  ),
);
ok(hasLegacyHtml, "the legacy constrained-HTML text block remains too");

// 6. A version-3 document still parses untouched — the additive-bump guarantee.
const v3 = {
  version: 3,
  pages: [
    {
      id: "p1",
      cover: true,
      blocks: [
        { id: "b1", type: "heading", kicker: "k", title: "t" },
        { id: "b2", type: "text", text: "legacy string" },
        { id: "b3", type: "image", caption: "c", align: "full", width: 100 },
        { id: "b4", type: "sponsor", name: "Acme", href: "https://a.example" },
      ],
    },
  ],
};
const old = issueContentSchema.safeParse(v3);
ok(old.success, "a version-3 document still validates under the v4 schema");
ok(
  old.success && old.data.version === 3,
  "…and keeps its stored version (no silent rewrite)",
);

// 7. The additive v8 schema keeps v7 montage items and shared caption untouched.
const legacyDocument = {
  version: 7,
  pages: [{ id: "legacy", blocks: [legacyMontage] }],
};
const parsedLegacy = issueContentSchema.parse(legacyDocument);
ok(
  JSON.stringify(parsedLegacy.pages[0]!.blocks[0]) ===
    JSON.stringify(legacyMontage),
  "v7 montage survives parsing without an item rewrite",
);
ok(parsedLegacy.version === 7, "v7 document keeps its stored version");
ok(
  montageItemSchema.safeParse({ imageId: "i", caption: "c".repeat(300) })
    .success,
  "300-character item caption accepted",
);
ok(
  !montageItemSchema.safeParse({ imageId: "i", caption: "c".repeat(301) })
    .success,
  "oversized item caption rejected",
);
ok(
  !montageItemSchema.safeParse({ imageId: "i", caption: 7 }).success,
  "non-string item caption rejected",
);
const images = Object.fromEntries(
  m.items.map((item, index) => [
    item.imageId,
    { url: `/montage-${index}.webp`, width: 600, height: 400 },
  ]),
);
const slides = resolveMontageSlides(m.items, images);
ok(
  slides[0]?.caption === m.items[0]?.caption,
  "image resolution preserves captions with their image",
);
ok(
  resolveMontageSlides(m.items, {
    [m.items[1]!.imageId]: images[m.items[1]!.imageId]!,
  })[0]?.caption === m.items[1]?.caption,
  "missing images never misalign their surviving captions",
);
for (const themeId of ["classic", "modern"] as const) {
  const staticMarkup = renderToStaticMarkup(
    createElement(MontageCaption, { slides, themeId }),
  );
  ok(
    staticMarkup.includes('data-montage-caption-active="true"') &&
      staticMarkup.includes(m.items[0]!.caption!),
    `${themeId} deterministic caption renderer uses first image`,
  );
  const editor = renderToStaticMarkup(
    createElement(BlockView, {
      block: { ...m, items: [] },
      images: {},
      theme: getTheme(themeId),
      edit: { onChange: () => undefined },
    }),
  );
  ok(
    !editor.includes("contenteditable") &&
      !editor.includes("Caption (optional)"),
    `${themeId} montage has no shared inline caption editor`,
  );
  const blank = renderToStaticMarkup(
    createElement(MontageCaption, { slides, themeId, index: 2 }),
  );
  ok(
    blank.includes("visibility:hidden") &&
      !blank.includes('data-montage-caption-active="true"'),
    `${themeId} blank image hides the full caption including theme decoration`,
  );
  const next = renderToStaticMarkup(
    createElement(MontageCaption, { slides, themeId, index: 1 }),
  );
  ok(
    next.includes(
      `data-montage-caption-active="true" aria-hidden="false" class="col-start-1 row-start-1 ">${m.items[1]!.caption}</span>`,
    ),
    `${themeId} active index selects the matching caption`,
  );
  const shared = renderToStaticMarkup(
    createElement(MontageCaption, {
      slides,
      themeId,
      caption: "Preserved shared caption",
      index: 2,
    }),
  );
  ok(
    shared.includes("Preserved shared caption") &&
      !shared.includes(m.items[0]!.caption!),
    `${themeId} legacy shared caption remains authoritative until conversion`,
  );
}
ok(
  renderToStaticMarkup(
    createElement(MontageCaption, {
      slides: slides.map((slide) => ({ ...slide, caption: "  " })),
    }),
  ) === "",
  "all blank captions reserve no caption space",
);
// 8. Caption typing groups per image and field; structural edits stand alone.
const editItem = (index: number, field: "alt" | "caption", value: string) => ({
  items: m.items.map((item, i) =>
    i === index ? { ...item, [field]: value } : item,
  ),
});
const firstCaption = blockEditHistoryGroup(
  m,
  editItem(0, "caption", "First edit"),
);
ok(
  firstCaption ===
    blockEditHistoryGroup(m, editItem(0, "caption", "Continued typing")),
  "typing one image caption folds into one undo step",
);
ok(
  firstCaption !==
    blockEditHistoryGroup(m, editItem(1, "caption", "Other image")),
  "different image captions have separate undo steps",
);
ok(
  firstCaption !==
    blockEditHistoryGroup(m, editItem(0, "alt", "Visual description")),
  "caption and description have separate undo steps",
);
ok(
  blockEditHistoryGroup(m, {
    items: [m.items[1]!, m.items[0]!, m.items[2]!],
  }) === undefined,
  "reordering montage images creates its own undo step",
);
ok(
  blockEditHistoryGroup(m, { items: m.items.slice(1) }) === undefined,
  "removing a montage image creates its own undo step",
);
ok(
  blockEditHistoryGroup(m, { items: [...m.items, m.items[0]!] }) === undefined,
  "adding a montage image creates its own undo step",
);
ok(
  blockEditHistoryGroup(legacyMontage, {
    items: legacyMontage.items.map((item) => ({
      ...item,
      caption: legacyMontage.caption,
    })),
    caption: "",
  }) === undefined,
  "legacy conversion creates one independent undo step",
);
console.log("\nall checks passed");
