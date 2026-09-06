import { z } from "zod";
import { createId } from "./id";
import { richTextValueSchema } from "./rich-text-doc";
import { YOUTUBE_ID_RE } from "./youtube";

// The canonical content model. Editor, reader and (later) PDF all speak this.
// An issue is pages → ordered blocks; stored as one JSONB document on the issue.
//
// Every string is length-capped and the page/block arrays bounded, so a bad or
// malicious save can't persist an unbounded document. The caps are far above
// anything a real issue needs. Sponsor/link hrefs are capped but not
// shape-validated here — rejecting a half-typed URL would break autosave — the
// readers validate every href through `externalHref` before rendering it.

const SHORT_TEXT_MAX = 300; // titles, kickers, captions, names
const HREF_MAX = 2_000;
const ID_MAX = 64; // uuids (36 chars) with headroom
export const MAX_PAGES = 200;
const MAX_BLOCKS_PER_PAGE = 100;
export const MAX_MONTAGE_IMAGES = 20; // a slideshow, not a photo dump

export const headingBlockSchema = z.object({
  id: z.string().max(ID_MAX),
  type: z.literal("heading"),
  kicker: z.string().max(SHORT_TEXT_MAX).default(""),
  title: z.string().max(SHORT_TEXT_MAX).default(""),
  // Heading rank: "main" is the big page/feature title, "section" an article
  // sub-head, "paragraph" a small run-in sub-head. Optional → "main" so existing
  // headings keep their look. (Cover pages ignore this and use the hero style.)
  level: z.enum(["main", "section", "paragraph"]).optional(),
});

export const textBlockSchema = z.object({
  id: z.string().max(ID_MAX),
  type: z.literal("text"),
  // Content v3: body text is a structured rich-text document (Tiptap JSON) —
  // see rich-text-doc.ts, which bounds/depth-caps it and re-validates link
  // hrefs. A legacy v1/v2 value (plain-text or constrained-HTML string) still
  // validates and renders through the same React path via `stringToDoc`. Cover
  // pages keep a plain string here (authored as a tagline, rendered as text).
  text: richTextValueSchema.default(""),
  // Body-text size, authored per block. Optional so existing content keeps the
  // default. The page is a fixed design canvas that scales as a unit, so this is
  // an absolute size on desktop/print; the reflowing mobile reader treats it as
  // a multiplier on its adjustable base size.
  size: z.enum(["s", "m", "l", "xl"]).optional(),
  // Optional, per block: legacy text stays left-aligned. Covers ignore this.
  align: z.enum(["left", "center", "right", "justify"]).optional(),
});

export const imageBlockSchema = z.object({
  id: z.string().max(ID_MAX),
  type: z.literal("image"),
  imageId: z.string().max(ID_MAX).optional(), // resolved to an R2 image later
  caption: z.string().max(SHORT_TEXT_MAX).default(""),
  // Screen-reader description of the photo. Optional (legacy documents lack it,
  // and it stays a backward-compatible content-model addition — no version
  // bump); the readers fall back to the caption when it is absent.
  alt: z.string().max(SHORT_TEXT_MAX).optional(),
  // Layout: "full" breaks the text (block, full column width); "left"/"right"
  // float the image so the following text wraps beside it. The two page-owning
  // placements (content v6) take the whole PAGE_W×PAGE_H canvas: "page-fill"
  // crops the photo to cover it, "page-fit" grows the photo to the first edge
  // and leaves page-coloured bars. `width` is a percent of the text column, and
  // is ignored by both (kept, so unsetting the placement restores the size).
  align: z
    .enum(["full", "left", "right", "page-fill", "page-fit"])
    .default("full"),
  width: z.number().min(20).max(100).default(100),
});

/** The image block's placement values, so callers derive them rather than restate them. */
export type ImageAlign = z.infer<typeof imageBlockSchema>["align"];

/** The placements where the photo owns the whole page rather than sitting in the column. */
export const PAGE_ALIGNS = ["page-fill", "page-fit"] as const;
export type PageAlign = (typeof PAGE_ALIGNS)[number];

// Montage timing. The stored value is whole seconds; 0 is the sentinel for
// "manual only" (no autoplay). MONTAGE_INTERVALS is what the editor offers —
// the schema accepts the whole 0…MONTAGE_INTERVAL_MAX range so changing the
// preset list later never invalidates stored content.
export const MONTAGE_MANUAL = 0;
export const MONTAGE_DEFAULT_INTERVAL = 5;
export const MONTAGE_INTERVAL_MAX = 30;

export const MONTAGE_INTERVALS: { value: number; label: string }[] = [
  { value: MONTAGE_MANUAL, label: "Manual only" },
  { value: 3, label: "3 seconds" },
  { value: 5, label: "5 seconds" },
  { value: 7, label: "7 seconds" },
  { value: 10, label: "10 seconds" },
];

// One slide of a montage: an uploaded image plus its own screen-reader
// description. Alt is per image (each slide is a different photo), so it lives
// here rather than on the block.
export const montageItemSchema = z.object({
  imageId: z.string().max(ID_MAX),
  alt: z.string().max(SHORT_TEXT_MAX).default(""),
});

export const montageBlockSchema = z.object({
  id: z.string().max(ID_MAX),
  type: z.literal("montage"),
  // Ordered slides. Bounded like every other array here so a bad save can't
  // persist an unbounded document; the editor caps the picker at the same
  // number. An empty montage renders the photo placeholder, exactly as an image
  // block with no imageId does.
  items: z.array(montageItemSchema).max(MAX_MONTAGE_IMAGES).default([]),
  caption: z.string().max(SHORT_TEXT_MAX).default(""),
  // Seconds between cross-fades; `MONTAGE_MANUAL` (0) means "manual only" — no
  // autoplay, the arrows are the only way to advance. Bounded rather than an
  // enum so a future preset doesn't invalidate stored content.
  interval: z
    .number()
    .int()
    .min(0)
    .max(MONTAGE_INTERVAL_MAX)
    .default(MONTAGE_DEFAULT_INTERVAL),
  // Placement/sizing are identical to the image block (same flow rules in
  // blockFlowStyle), so a montage drops into a layout wherever a photo would.
  align: z.enum(["full", "left", "right"]).default("full"),
  width: z.number().min(20).max(100).default(100),
});

export const videoBlockSchema = z.object({
  id: z.string().max(ID_MAX),
  type: z.literal("video"),
  // Which service hosts the video. Only YouTube ships (issue #161), but the
  // field is stored from day one so adding a second provider later is a widened
  // enum rather than a migration: every existing block already says which one it
  // is. Defaulted, so a document written before the field existed still parses.
  provider: z.literal("youtube").default("youtube"),
  // The *extracted* video id, never the pasted URL — 11 characters of the
  // URL-safe base64 alphabet, validated here as well as at the paste boundary,
  // because this is what the embed src and the poster URL are built from. See
  // lib/youtube.ts. Optional like the image block's `imageId`: a freshly
  // inserted block has no video yet and renders the placeholder.
  videoId: z.string().regex(YOUTUBE_ID_RE).optional(),
  // The poster frame, fetched once at edit time and stored through the ordinary
  // image pipeline (an `images` row like any upload). Holding our own copy is
  // what lets the readers show the video without touching a Google origin until
  // someone presses play — and it is what makes the poster printable, since the
  // PDF container already reaches R2 and reaches nothing else.
  posterImageId: z.string().max(ID_MAX).optional(),
  caption: z.string().max(SHORT_TEXT_MAX).default(""),
  // Placement/sizing are the image block's fields verbatim (same flow rules in
  // blockFlowStyle), so a video drops into a layout wherever a photo would. The
  // box itself is always 16:9 — the frame's shape belongs to the video, not to
  // the page.
  align: z.enum(["full", "left", "right"]).default("full"),
  width: z.number().min(20).max(100).default(100),
});

export const sponsorBlockSchema = z.object({
  id: z.string().max(ID_MAX),
  type: z.literal("sponsor"),
  // Content v2: a sponsor block points at a managed sponsor (the `sponsors`
  // table) by id, and the reader resolves its name/href/logo at render time.
  // Optional so version-1 documents — which carry the inline fields below and no
  // `sponsorId` — still parse and render unchanged (see the sponsor case in
  // BlockView). New blocks placed via the editor picker set `sponsorId`; the
  // editor's manual-entry fallback leaves it unset and uses the inline fields.
  sponsorId: z.string().max(ID_MAX).optional(),
  // Version-1 inline fields, retained as the fallback for legacy documents and
  // for manual (unmanaged) entries. Kept optional so both shapes validate.
  name: z.string().max(SHORT_TEXT_MAX).default(""),
  href: z.string().max(HREF_MAX).optional(),
  logoId: z.string().max(ID_MAX).optional(),
});

export const blockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  montageBlockSchema,
  videoBlockSchema,
  sponsorBlockSchema,
]);

export const pageSchema = z.object({
  id: z.string().max(ID_MAX),
  // A cover page is laid out and styled differently from a normal page —
  // vertically centred, oversized hero type, every block centred (see the
  // "cover" variant in BlockView and `blockFlowStyle`). Optional + defaults to a
  // normal page, so existing issues are unaffected.
  cover: z.boolean().optional(),
  blocks: z.array(blockSchema).max(MAX_BLOCKS_PER_PAGE),
});

// `version` marks which shape of the content model a document holds, so future
// block-shape changes can migrate old rows deliberately instead of guessing.
//
// v2 (issue #8): sponsor blocks gained `sponsorId` and now reference the
// managed `sponsors` table — backward-compatible (optional field, v1 inline
// fields retained), no rewrite.
//
// v3 (issue #13): body text moved from a stored HTML string to structured
// rich-text JSON (rich-text-doc.ts), rendered through React so the read path
// carries no `dangerouslySetInnerHTML`. Backward-compatible by construction —
// `text` accepts a string (v1/v2) or a doc, and legacy strings render through
// the same React path via `stringToDoc`. An optional one-off migration converts
// stored strings to docs in place (npm run db:migrate-content — keyed on the
// stored `version`; see docs/database.md "Changing the content model").
//
// v4 (issue #95): a new `montage` block type — an ordered list of images that
// cross-fade on a timer in the readers, with the image block's placement/sizing
// options. Purely additive: it adds a member to the block union, so every
// version-1…3 document (which has no montage blocks) parses and renders
// unchanged, and no stored row is rewritten. New documents and any resave stamp
// version 4. The print/PDF path renders only the first image, deterministically.
//
// v5 (issue #161): a new `video` block type — a YouTube video, stored as the
// extracted video id plus a poster frame we hold ourselves (an ordinary
// `images` row), played inline in the readers behind a facade that loads no
// third-party frame until the member presses play. Additive in exactly the way
// v4 was: a version-1…4 document has no video blocks, so it parses and renders
// unchanged and no stored row is rewritten. The print/PDF path renders the
// poster plus the visible link, deterministically — a PDF cannot play video.
//
// v6 (issue #227): the image block's `align` gained two page-owning values —
// "page-fill" (crop the photo to cover the canvas) and "page-fit" (grow it to
// the first edge, page-coloured bars on the other axis). Either way the photo
// takes the whole canvas and owns its page (no margins, no running footer).
// Additive in the same way v4 and v5 were, but by widening an enum rather than
// adding a block type: no version-1…5 document holds either value, so every one
// parses and renders unchanged and no stored row is rewritten. Confined to
// `image`; montage and video keep the three-value union (see docs/database.md).
export const CONTENT_VERSION = 6;

export const issueContentSchema = z.object({
  version: z.number().int().min(1).default(CONTENT_VERSION),
  pages: z.array(pageSchema).max(MAX_PAGES),
});

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type Page = z.infer<typeof pageSchema>;
export type IssueContent = z.infer<typeof issueContentSchema>;

// A partial update to one block's own fields (never its id/type), used by the
// editor's write-back path. Distributes over the union, so a patch can only
// carry real block fields with their proper value types — the compiler rejects
// a misspelled field or a wrong type at the call site.
export type BlockPatch = {
  [T in Block as T["type"]]: Partial<Omit<T, "id" | "type">>;
}[BlockType];

// Apply a patch to a block, preserving its identity and discriminant.
// Cast: the distributed patch union is wider than any one block accepts now that
// only images take the page-owning aligns; each call site holds one concrete block.
export function mergeBlock(block: Block, patch: BlockPatch): Block {
  return { ...block, ...patch } as Block;
}

export const BLOCK_TYPES: BlockType[] = [
  "heading",
  "text",
  "image",
  "montage",
  "video",
  "sponsor",
];

export type MontageItem = z.infer<typeof montageItemSchema>;

export type TextSize = "s" | "m" | "l" | "xl";

export type TextAlign = NonNullable<z.infer<typeof textBlockSchema>["align"]>;

/** Shared by the editor, fixed page/print/thumbnail and mobile body text. */
export function textAlignClass(align: TextAlign = "left"): string {
  return {
    left: "text-left",
    center: "text-center",
    right: "text-right",
    justify: "text-justify hyphens-auto",
  }[align];
}

// The per-text-block size choices offered in the editor, and the two ways a
// size resolves: absolute px on the fixed-canvas desktop/print page, and a
// relative multiplier in the reflowing mobile reader.
export const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];

export function textSizePx(size: TextSize = "m"): number {
  // Absolute px on the ≈A4 design canvas (PAGE_W×PAGE_H ≈ A4 in points), so
  // these read like print point sizes: M ≈ normal 11pt A4 body, S a touch
  // smaller, L/XL for emphasis. The whole page scales to the viewport, so on
  // screen they render proportionally smaller than these raw numbers.
  return { s: 11, m: 13, l: 15, xl: 18 }[size];
}

export function textSizeScale(size: TextSize = "m"): number {
  return { s: 0.88, m: 1, l: 1.18, xl: 1.42 }[size];
}

export type HeadingLevel = "main" | "section" | "paragraph";

// The heading-rank choices offered in the editor (mirrors TEXT_SIZES).
export const HEADING_LEVELS: { value: HeadingLevel; label: string }[] = [
  { value: "main", label: "Main" },
  { value: "section", label: "Section" },
  { value: "paragraph", label: "Para" },
];

export function makeBlock(type: BlockType): Block {
  const id = createId();
  switch (type) {
    case "heading":
      return { id, type, kicker: "Section", title: "New heading" };
    case "text":
      return {
        id,
        type,
        text: "Write your paragraph here. The theme takes care of the type, spacing and rules.",
      };
    case "image":
      return { id, type, caption: "", align: "full", width: 100 };
    case "montage":
      return {
        id,
        type,
        items: [],
        caption: "",
        interval: MONTAGE_DEFAULT_INTERVAL,
        align: "full",
        width: 100,
      };
    case "video":
      return {
        id,
        type,
        provider: "youtube",
        caption: "",
        align: "full",
        width: 100,
      };
    case "sponsor":
      return { id, type, name: "Sponsor name" };
  }
}

// Page templates the editor offers from the "Add page" menu. "blank" is the
// plain page; the rest are cover layouts. Covers carry `cover: true` so the
// reader and editor render them with the dedicated cover treatment (centred,
// oversized hero type) — see `makePage` and the "cover" variant in BlockView.
export type PageTemplate =
  | "blank"
  | "cover-classic"
  | "cover-feature"
  | "cover-minimal";

export const PAGE_TEMPLATES: {
  id: PageTemplate;
  label: string;
  description: string;
}[] = [
  { id: "blank", label: "Blank page", description: "Start with nothing." },
  {
    id: "cover-classic",
    label: "Classic cover",
    description: "Masthead, title, photo and a tagline.",
  },
  {
    id: "cover-feature",
    label: "Feature cover",
    description: "Photo-led with a bold headline.",
  },
  {
    id: "cover-minimal",
    label: "Minimal cover",
    description: "Just a title and a date line.",
  },
];

export function makePage(template: PageTemplate = "blank"): Page {
  const id = createId();
  const bid = () => createId();
  switch (template) {
    case "cover-classic":
      return {
        id,
        cover: true,
        blocks: [
          {
            id: bid(),
            type: "heading",
            kicker: "The Members' Magazine",
            title: "Spring Issue",
          },
          { id: bid(), type: "image", caption: "", align: "full", width: 55 },
          { id: bid(), type: "text", text: "Official Club Newsletter" },
          { id: bid(), type: "text", text: "Spring 2026" },
        ],
      };
    case "cover-feature":
      return {
        id,
        cover: true,
        blocks: [
          {
            id: bid(),
            type: "heading",
            kicker: "In this issue",
            title: "The Headline Story",
          },
          { id: bid(), type: "image", caption: "", align: "full", width: 70 },
          {
            id: bid(),
            type: "text",
            text: "A standfirst that draws the reader into the lead feature.",
          },
        ],
      };
    case "cover-minimal":
      return {
        id,
        cover: true,
        blocks: [
          {
            id: bid(),
            type: "heading",
            kicker: "Volume One",
            title: "The Issue Title",
          },
          { id: bid(), type: "text", text: "Spring 2026" },
        ],
      };
    case "blank":
      return { id, blocks: [] };
  }
}

// Every issue opens with a cover page (enforced — see the editor), followed by a
// blank page to start writing on.
export function emptyIssueContent(): IssueContent {
  return {
    version: CONTENT_VERSION,
    pages: [makePage("cover-classic"), makePage("blank")],
  };
}

// Ensure a page list always begins with a cover page (the magazine's front
// cover). Used on load and after edits in the editor so the invariant holds, and
// relied on by the reader (cover shown standalone as page one) and the library
// (cover rendered as the issue thumbnail).
export function ensureCoverFirst(pages: Page[]): Page[] {
  if (pages.length === 0 || pages[0]!.cover) return pages;
  return [{ ...pages[0]!, cover: true }, ...pages.slice(1)];
}

// The issue's front cover page (the first one flagged `cover`), if any. Returns
// undefined for legacy issues without a cover — callers fall back to a
// placeholder rather than showing a content page as the cover.
export function coverPageOf(content: IssueContent): Page | undefined {
  return content.pages.find((p) => p.cover);
}
