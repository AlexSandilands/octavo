// Dev-only: validates the content v5 video block (issue #161) *in memory* — no
// database, no storage, no dev server, no network. It exercises the link parser
// at its boundary and builds the seed issues with fake image ids, asserting
// through the same zod schema the save path runs:
//
//   - every YouTube link form members actually paste resolves to the same id,
//     junk parameters and all, and everything else is refused,
//   - every seeded issue still validates and stamps CONTENT_VERSION,
//   - the seed authors exactly one video, on the pétanque issue, in the new
//     shape (a valid id, a stored poster, a caption),
//   - collectImageIds reaches the video's poster, so the readers can resolve it
//     (a poster whose id was missed renders as an empty frame everywhere),
//   - a malformed video id cannot enter a document through the schema,
//   - the deliberate legacy fixture (a plain string + a constrained-HTML string
//     body, see docs/database.md) survives the bump,
//   - a version-4 document — the additive-bump guarantee — still parses and
//     keeps its stored version.
//
// This is the seed check for the v5 bump: `npm run db:seed` wipes every authored
// issue, so it must never be run to verify a content-model change.
// Run: npx tsx scripts/dev-video-gate.mts
import {
  CONTENT_VERSION,
  issueContentSchema,
  type Block,
} from "../src/lib/blocks";
import { collectImageIds } from "../src/lib/images";
import { parseYouTubeId } from "../src/lib/youtube";
import { buildIssues } from "../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

// 1. The paste boundary. Every accepted form yields the identical id.
const ID = "dQw4w9WgXcQ";
const accepted = [
  `https://www.youtube.com/watch?v=${ID}`,
  `https://youtube.com/watch?v=${ID}`,
  `https://m.youtube.com/watch?v=${ID}`,
  `https://music.youtube.com/watch?v=${ID}`,
  `http://www.youtube.com/watch?v=${ID}`,
  `https://www.youtube.com/watch?v=${ID}&t=90s`,
  `https://www.youtube.com/watch?app=desktop&v=${ID}&list=PLabc123&index=4`,
  `https://youtu.be/${ID}`,
  `https://youtu.be/${ID}?si=Xy_9-abc&t=42`,
  `youtu.be/${ID}`, // pasted with the scheme stripped, as phones often do
  `  https://youtu.be/${ID}  `, // clipboard whitespace
  `https://www.youtube.com/embed/${ID}`,
  `https://www.youtube-nocookie.com/embed/${ID}`,
  `https://www.youtube.com/shorts/${ID}`,
  `https://www.youtube.com/live/${ID}`,
  `https://www.youtube.com/v/${ID}`,
];
for (const link of accepted) {
  ok(parseYouTubeId(link) === ID, `accepts ${link.trim()}`);
}

const refused = [
  "",
  "   ",
  "not a link at all",
  ID, // a bare id is deliberately not a link
  "https://vimeo.com/123456789",
  "https://www.youtube.com/", // the site, not a video
  "https://www.youtube.com/@someclub", // a channel
  "https://www.youtube.com/watch?v=tooshort",
  "https://www.youtube.com/watch?v=way-too-long-to-be-an-id",
  "https://www.youtube.com/watch?v=abcdefghij!", // 11 chars, wrong alphabet
  "https://notyoutube.com/watch?v=" + ID,
  "https://youtube.com.evil.example/watch?v=" + ID, // lookalike host
  "javascript:alert(1)//youtube.com/watch?v=" + ID,
  "data:text/html,<script>alert(1)</script>",
];
for (const link of refused) {
  ok(parseYouTubeId(link) === null, `refuses ${JSON.stringify(link)}`);
}

// Stand-in image ids (the real seed mints a uuid per generated image row), kept
// derivable from the art key so the manifest check below can invert them.
const img = Object.fromEntries(
  SEED_IMAGES.map((s) => [s.key, `id-${s.key}`]),
) as SeedImages;

const issues = buildIssues(img);
ok(issues.length === 6, "buildIssues still returns the six seed issues");

// 2. Every seeded issue validates through the save path's schema.
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

// 3. Exactly one video, on the pétanque issue, in the v5 shape.
type Video = Extract<Block, { type: "video" }>;
const videos: { issue: number; block: Video }[] = [];
for (const issue of issues) {
  for (const page of issue.content.pages) {
    for (const block of page.blocks) {
      if (block.type === "video") videos.push({ issue: issue.number, block });
    }
  }
}
ok(
  videos.length === 1,
  `seed authors exactly one video (got ${videos.length})`,
);
const found = videos[0]!;
ok(found.issue === 1, `the video lives on issue 1 (got ${found.issue})`);

const v = found.block;
ok(v.provider === "youtube", "the video names its provider");
ok(
  Boolean(v.videoId) && /^[A-Za-z0-9_-]{11}$/.test(v.videoId!),
  `the stored value is a video id, not a URL (got ${v.videoId})`,
);
ok(Boolean(v.posterImageId), "the video carries a stored poster image");
ok(v.align === "full" && v.width === 100, "placement defaults to full width");
ok(v.caption.trim().length > 0, "the video carries a caption");

// 4. The poster is reachable by the image resolver every surface uses.
const ids = collectImageIds(issues[0]!.content);
ok(
  ids.includes(v.posterImageId!),
  `collectImageIds picks up the video poster ${v.posterImageId}`,
);
const keys = new Set<string>(SEED_IMAGES.map((s) => s.key));
ok(
  keys.has(v.posterImageId!.replace(/^id-/, "")),
  "the poster maps to a generated art spec (the seed needs no network)",
);
const spec = SEED_IMAGES.find(
  (s) => s.key === v.posterImageId!.replace(/^id-/, ""),
)!;
ok(
  Math.abs(spec.width / spec.height - 16 / 9) < 0.01,
  `the seeded poster is 16:9 (${spec.width}×${spec.height})`,
);

// 5. A malformed id cannot enter a document through the save path.
const badId = {
  version: CONTENT_VERSION,
  pages: [
    {
      id: "p1",
      blocks: [{ id: "b1", type: "video", videoId: "../../etc/passwd" }],
    },
  ],
};
ok(
  !issueContentSchema.safeParse(badId).success,
  "a video block with a malformed id is rejected by the schema",
);

// 6. The deliberate legacy fixture survives the bump.
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

// 7. A version-4 document still parses untouched — the additive-bump guarantee.
// Every pre-v5 block shape in one document, including a montage (v4's addition).
const v4 = {
  version: 4,
  pages: [
    {
      id: "p1",
      cover: true,
      blocks: [
        { id: "b1", type: "heading", kicker: "k", title: "t" },
        { id: "b2", type: "text", text: "legacy string" },
        { id: "b3", type: "image", caption: "c", align: "full", width: 100 },
        {
          id: "b4",
          type: "montage",
          items: [{ imageId: "i1", alt: "a" }],
          interval: 5,
        },
        { id: "b5", type: "sponsor", name: "Acme", href: "https://a.example" },
      ],
    },
  ],
};
const old = issueContentSchema.safeParse(v4);
ok(old.success, "a version-4 document still validates under the v5 schema");
ok(
  old.success && old.data.version === 4,
  "…and keeps its stored version (no silent rewrite)",
);
// The additive guarantee stated precisely. Parsing has always filled the
// schema's own defaults (an image block's caption/align/width, say), so the
// output is not the input verbatim and never was. What v5 must not do is add
// anything to a document that has no video in it: none of the block fields this
// version introduced may appear, and a second pass must be a fixed point.
const parsedV4 = JSON.stringify(old.success ? old.data : null);
ok(
  !/"(provider|videoId|posterImageId)"/.test(parsedV4),
  "…and gains none of v5's fields (the new shape is confined to video blocks)",
);
ok(
  old.success &&
    JSON.stringify(issueContentSchema.parse(old.data)) === parsedV4,
  "…and re-parsing it changes nothing further",
);

console.log("\nall checks passed");
