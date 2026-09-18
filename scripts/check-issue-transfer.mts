// In-memory companion to scripts/dev-issue-transfer-gate.mts (issue #293). No
// server, no database, no storage: it exercises the pure half of issue transfer
// — the manifest checks, the document checks and the resolution/rewrite — plus
// the one invariant the whole feature rests on, that `collectImageIds` and the
// import's rewrite walk the same document sites.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-issue-transfer.mts
import { CONTENT_VERSION, type IssueContent } from "../src/lib/blocks.ts";
import { imageSites } from "../src/lib/image-sites.ts";
import { collectImageIds } from "../src/lib/images.ts";
import { checkBundledIssue } from "../src/lib/issue-transfer/document.ts";
import { MAX_DOCUMENT_BYTES } from "../src/lib/issue-transfer/limits.ts";
import {
  checkManifest,
  normaliseLibraryName,
  type BundleManifest,
} from "../src/lib/issue-transfer/manifest.ts";
import {
  mintIds,
  resolveBundle,
  type DestinationLibrary,
} from "../src/lib/issue-transfer/resolve.ts";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(72, "─"));

const SHA = "a".repeat(64);
const imageIds = [
  "img-block",
  "img-slide",
  "img-poster",
  "img-logo",
  "img-bare",
];

// Every image-bearing use the content model has, in one document: an image
// block, a montage slide, a video poster, a cover logo that names a library
// logo, and a cover logo that carries only its own artwork.
function everyUse(): IssueContent {
  return {
    version: CONTENT_VERSION,
    pages: [
      {
        id: "page-cover",
        cover: true,
        coverElements: [
          {
            id: "el-logo",
            type: "logo",
            placement: {
              column: "right",
              row: "bottom",
              width: "medium",
              align: "right",
              offset: 0,
            },
            logoId: "logo-1",
            imageId: "img-logo",
            alt: "",
            size: 100,
          },
          {
            id: "el-bare",
            type: "logo",
            placement: {
              column: "left",
              row: "bottom",
              width: "medium",
              align: "left",
              offset: 0,
            },
            imageId: "img-bare",
            alt: "",
            size: 100,
          },
        ],
        blocks: [
          { id: "b-title", type: "heading", kicker: "", title: "Cover" },
        ],
      },
      {
        id: "page-1",
        blocks: [
          {
            id: "b-image",
            type: "image",
            imageId: "img-block",
            caption: "",
            align: "full",
            width: 100,
          },
          {
            id: "b-montage",
            type: "montage",
            items: [{ imageId: "img-slide", alt: "" }],
            caption: "",
            interval: 5,
            align: "full",
            width: 100,
          },
          {
            id: "b-video",
            type: "video",
            provider: "youtube",
            videoId: "dQw4w9WgXcQ",
            posterImageId: "img-poster",
            caption: "",
            align: "full",
            width: 100,
          },
          { id: "b-sponsor", type: "sponsor", sponsorId: "sp-1", name: "" },
        ],
      },
    ],
  };
}

function manifestFor(content: IssueContent): BundleManifest {
  return {
    format: "octavo-issues",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    contentVersion: content.version,
    issues: [
      {
        id: "iss-1",
        file: "issues/iss-1/issue.json",
        title: "Spring",
        bytes: 1,
        sha256: SHA,
      },
    ],
    images: imageIds.map((id) => ({
      id,
      file: `images/${id}.webp`,
      width: 100,
      height: 80,
      bytes: 10,
      sha256: SHA,
    })),
    sponsors: [
      {
        id: "sp-1",
        name: "Acme Ltd",
        href: "https://acme.example",
        activeUntil: null,
        logoImageId: null,
      },
    ],
    logos: [{ id: "logo-1", name: "Crest", imageId: "img-logo" }],
  };
}

function bundled(content: IssueContent) {
  return {
    manifestId: "iss-1",
    issue: {
      title: "Spring",
      theme: "classic" as const,
      content,
      footerMarkSize: 27,
      footerTextSize: 10,
      logoId: "logo-1",
      number: null,
      status: "draft" as const,
      publishedAt: null,
    },
  };
}

const EMPTY: DestinationLibrary = { sponsors: [], logos: [] };

function resolve(
  content: IssueContent,
  destination: DestinationLibrary,
  manifest = manifestFor(content),
) {
  const ids = mintIds(manifest);
  const result = resolveBundle({
    manifest,
    documents: [bundled(content)],
    destination,
    ids,
  });
  return { result, ids };
}

// ── the traversal agreement ─────────────────────────────────────────────────
heading("collectImageIds and the rewrite walk the same sites");

const source = everyUse();
const collected = collectImageIds(source).sort();
ok(
  JSON.stringify(collected) === JSON.stringify([...imageIds].sort()),
  `collectImageIds finds every image-bearing use (${collected.join(", ")})`,
);

{
  const { result } = resolve(source, EMPTY);
  if (!result.ok) throw new Error("resolution refused");
  const rewritten = result.bundle.issues[0]!.content;
  const text = JSON.stringify(rewritten);
  const survivors = collected.filter((id) => text.includes(id));
  ok(
    survivors.length === 0,
    "every id collectImageIds reports is rewritten (none survives)",
  );
  ok(
    [...imageSites(rewritten)].length === [...imageSites(source)].length,
    "no use is dropped when every image is supplied",
  );
  ok(
    collectImageIds(rewritten).length === collected.length,
    "the rewritten document references exactly as many images",
  );
}

// ── images resolved per use ─────────────────────────────────────────────────
heading("images are resolved per use, not by one global swap");

{
  // A destination logo called "Crest" whose artwork is `dest-image` — and whose
  // bundled artwork (img-logo) is ALSO used by an ordinary block on page 1.
  const content = everyUse();
  content.pages[1]!.blocks[0] = {
    id: "b-image",
    type: "image",
    imageId: "img-logo",
    caption: "",
    align: "full",
    width: 100,
  };
  const { result, ids } = resolve(content, {
    sponsors: [],
    logos: [{ id: "dest-logo", name: "crest", imageId: "dest-image" }],
  });
  if (!result.ok) throw new Error("resolution refused");
  const bundle = result.bundle;
  const page = bundle.issues[0]!.content.pages;
  const element = page[0]!.coverElements![0]!;
  ok(
    element.type === "logo" &&
      element.logoId === "dest-logo" &&
      element.imageId === "dest-image",
    "a matched cover logo takes the destination logo and its image",
  );
  const block = page[1]!.blocks[0]!;
  ok(
    block.type === "image" && block.imageId === ids.images["img-logo"],
    "the ordinary block using the same source photo keeps the bundled bytes",
  );
  ok(
    bundle.images.some((i) => i.bundleId === "img-logo"),
    "so that photo is still uploaded",
  );
  ok(
    bundle.logos[0]!.action === "reuse" && bundle.logos[0]!.id === "dest-logo",
    "the destination logo is reused untouched",
  );
  ok(
    bundle.issues[0]!.logoId === "dest-logo",
    "the issue's footer mark follows the matched logo",
  );
}

{
  // The same match, but nothing else uses the logo's artwork: it is not needed.
  const { result } = resolve(everyUse(), {
    sponsors: [],
    logos: [{ id: "dest-logo", name: " CREST ", imageId: "dest-image" }],
  });
  if (!result.ok) throw new Error("resolution refused");
  ok(
    !result.bundle.images.some((i) => i.bundleId === "img-logo"),
    "a matched logo's bundled photo is not uploaded when no other use needs it",
  );
  ok(
    normaliseLibraryName(" CREST ") === normaliseLibraryName("Crest"),
    "names match on trim and case",
  );
}

// ── destination wins, and ambiguity refuses ─────────────────────────────────
heading("library matching");

{
  const { result } = resolve(everyUse(), {
    sponsors: [{ id: "dest-sp", name: "acme ltd" }],
    logos: [],
  });
  if (!result.ok) throw new Error("resolution refused");
  const sponsor = result.bundle.sponsors[0]!;
  ok(
    sponsor.action === "reuse" && sponsor.id === "dest-sp",
    "a matched sponsor is reused as it is, whatever the bundle says about it",
  );
  const block = result.bundle.issues[0]!.content.pages[1]!.blocks[3]!;
  ok(
    block.type === "sponsor" && block.sponsorId === "dest-sp",
    "the sponsor block points at the destination row",
  );
}

{
  const { result } = resolve(everyUse(), {
    sponsors: [
      { id: "a", name: "Acme Ltd" },
      { id: "b", name: "ACME  LTD" },
    ],
    logos: [],
  });
  ok(
    !result.ok && result.refusal.code === "ambiguous-library-name",
    "two destination sponsors with the same name refuse the import",
  );
  ok(
    !result.ok && result.refusal.message.includes("Acme Ltd"),
    "and the refusal names the entry",
  );
}

// ── unresolved references are cleared ───────────────────────────────────────
heading("unresolved references are cleared, never carried");

{
  const manifest = manifestFor(everyUse());
  manifest.images = [];
  manifest.sponsors = [];
  manifest.logos = [];
  const { result } = resolve(everyUse(), EMPTY, manifest);
  if (!result.ok) throw new Error("resolution refused");
  const pages = result.bundle.issues[0]!.content.pages;
  const text = JSON.stringify(pages);
  ok(
    imageIds.every((id) => !text.includes(id)),
    "no bundled image id survives when the bundle supplies none",
  );
  ok(!text.includes("sp-1"), "an unsupplied sponsor reference is emptied");
  ok(!text.includes("logo-1"), "an unsupplied logo reference is emptied");
  ok(
    result.bundle.issues[0]!.logoId === null,
    "the issue's footer mark is emptied too",
  );
  ok(
    !pages[1]!.blocks.some((b) => b.type === "montage"),
    "a montage whose only slide had to go is dropped with it",
  );
  const kinds = result.bundle.cleared.map((c) => c.kind).sort();
  ok(
    ["image", "logo", "montage", "slide", "sponsor"].every((k) =>
      kinds.includes(k as never),
    ),
    `every clearing is reported (${kinds.join(", ")})`,
  );
}

// ── manifest checks ─────────────────────────────────────────────────────────
heading("manifest checks");

{
  const base = manifestFor(everyUse());
  ok(checkManifest(base) === null, "a well-formed manifest passes");

  const duplicateIssue = manifestFor(everyUse());
  duplicateIssue.issues.push({ ...duplicateIssue.issues[0]! });
  ok(
    checkManifest(duplicateIssue)?.code === "duplicate-id",
    "the same issue listed twice is refused",
  );

  const wrongPath = manifestFor(everyUse());
  wrongPath.issues[0]!.file = "../../etc/passwd";
  ok(
    checkManifest(wrongPath)?.code === "not-a-bundle",
    "a path that is not the entry's own shape is refused",
  );

  const twoNames = manifestFor(everyUse());
  twoNames.sponsors.push({
    id: "sp-2",
    name: "acme  ltd",
    href: null,
    activeUntil: null,
    logoImageId: null,
  });
  ok(
    checkManifest(twoNames)?.code === "duplicate-library-name",
    "two bundled sponsors with the same normalised name are refused",
  );

  const danglingLogo = manifestFor(everyUse());
  danglingLogo.logos[0]!.imageId = "nope";
  ok(
    checkManifest(danglingLogo)?.code === "not-a-bundle",
    "a logo whose artwork the bundle does not list is refused",
  );
}

// ── document checks ─────────────────────────────────────────────────────────
heading("document checks");

{
  const code = (value: unknown) => {
    const checked = checkBundledIssue(value, "Spring");
    return checked.ok ? null : checked.refusal.code;
  };
  ok(code(bundled(everyUse()).issue) === null, "a well-formed document passes");

  const tooNew = bundled(everyUse()).issue;
  tooNew.content = { ...tooNew.content, version: CONTENT_VERSION + 1 };
  ok(
    code(tooNew) === "content-too-new",
    "a document from a newer content model is refused",
  );

  const duplicateIds = bundled(everyUse()).issue;
  duplicateIds.content.pages[1]!.blocks[1]!.id = "b-image";
  ok(
    code(duplicateIds) === "duplicate-document-id",
    "a document repeating a block id is refused",
  );

  const huge = bundled(everyUse()).issue;
  huge.content.pages = Array.from({ length: 150 }, (_, i) => ({
    id: `p-${i}`,
    blocks: Array.from({ length: 90 }, (_, j) => ({
      id: `p-${i}-b-${j}`,
      type: "text" as const,
      text: "y".repeat(280),
    })),
  }));
  ok(
    code(huge) === "document-too-large",
    `a document over ${Math.round(MAX_DOCUMENT_BYTES / 1024)} KB is refused, so an import stays savable`,
  );

  ok(
    code({ ...bundled(everyUse()).issue, theme: "neon" }) ===
      "invalid-document",
    "a theme this site does not have is refused",
  );

  // The real shape of a newer content model: a version this site has never seen
  // AND something in the document its schema cannot parse. The version has to be
  // read first, or this is refused as unreadable and the admin is told to fix a
  // file that is fine.
  const future = bundled(everyUse()).issue;
  future.content = {
    ...future.content,
    version: CONTENT_VERSION + 1,
    pages: [
      future.content.pages[0]!,
      {
        id: "p-future",
        blocks: [{ id: "b-future", type: "timeline", entries: [] } as never],
      },
    ],
  };
  ok(
    code(future) === "content-too-new",
    "a document carrying a block type this site has never heard of is refused as too new, not as unreadable",
  );

  const twinElement = bundled(everyUse()).issue;
  const elements = twinElement.content.pages[0]!.coverElements!;
  elements[1]!.id = elements[0]!.id;
  ok(
    code(twinElement) === "duplicate-document-id",
    "a document repeating a cover element id is refused",
  );
}

console.log("\nAll issue-transfer in-memory checks passed.");
