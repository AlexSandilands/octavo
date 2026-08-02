// Dev-only: validates the content v4 montage block (issue #95) *in memory* —
// no database, no storage, no dev server. It builds the seed issues with fake
// image ids and asserts, through the same zod schema the save path runs:
//
//   - every seeded issue still validates and stamps CONTENT_VERSION,
//   - the seed authors exactly one montage, on the camera-club issue, in the
//     new shape (3 slides, per-slide alt text, an interval, a caption),
//   - collectImageIds reaches into montage slides, so the readers can resolve
//     them (a montage whose ids were missed renders as an empty frame),
//   - the deliberate legacy fixture (a plain string + a constrained-HTML string
//     body, see docs/database.md) survives the bump,
//   - a version-3 document — the additive-bump guarantee — still parses and
//     keeps its stored version.
//
// This is the seed check for the v4 bump: `npm run db:seed` wipes every
// authored issue, so it must never be run to verify a content-model change.
// Run: npx tsx scripts/dev-montage-gate.mts
import {
  CONTENT_VERSION,
  issueContentSchema,
  type Block,
} from "../src/lib/blocks";
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

// 2. Exactly one montage, on the camera-club issue, in the v4 shape.
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
  montages.length === 1,
  `seed authors exactly one montage (got ${montages.length})`,
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
ok(m.caption.trim().length > 0, "the montage carries a caption");

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

console.log("\nall checks passed");
