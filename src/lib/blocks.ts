import { z } from "zod";
import { createId } from "./id";

// The canonical content model. Editor, reader and (later) PDF all speak this.
// An issue is pages → ordered blocks; stored as one JSONB document on the issue.

export const headingBlockSchema = z.object({
  id: z.string(),
  type: z.literal("heading"),
  kicker: z.string().default(""),
  title: z.string().default(""),
  // Heading rank: "main" is the big page/feature title, "section" an article
  // sub-head, "paragraph" a small run-in sub-head. Optional → "main" so existing
  // headings keep their look. (Cover pages ignore this and use the hero style.)
  level: z.enum(["main", "section", "paragraph"]).optional(),
});

export const textBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  text: z.string().default(""),
  // Body-text size, authored per block. Optional so existing content keeps the
  // default. The page is a fixed design canvas that scales as a unit, so this is
  // an absolute size on desktop/print; the reflowing mobile reader treats it as
  // a multiplier on its adjustable base size.
  size: z.enum(["s", "m", "l", "xl"]).optional(),
});

export const imageBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image"),
  imageId: z.string().optional(), // resolved to an R2 image later
  caption: z.string().default(""),
  // Layout: "full" breaks the text (block, full column width); "left"/"right"
  // float the image so the following text wraps beside it. `width` is a percent
  // of the text column.
  align: z.enum(["full", "left", "right"]).default("full"),
  width: z.number().min(20).max(100).default(100),
});

export const sponsorBlockSchema = z.object({
  id: z.string(),
  type: z.literal("sponsor"),
  name: z.string().default(""),
  href: z.string().optional(),
  logoId: z.string().optional(),
});

export const blockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  sponsorBlockSchema,
]);

export const pageSchema = z.object({
  id: z.string(),
  // A cover page is laid out and styled differently from a normal page —
  // vertically centred, oversized hero type, every block centred (see the
  // "cover" variant in BlockView and `blockFlowStyle`). Optional + defaults to a
  // normal page, so existing issues are unaffected.
  cover: z.boolean().optional(),
  blocks: z.array(blockSchema),
});

export const issueContentSchema = z.object({
  pages: z.array(pageSchema),
});

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type Page = z.infer<typeof pageSchema>;
export type IssueContent = z.infer<typeof issueContentSchema>;

export const BLOCK_TYPES: BlockType[] = ["heading", "text", "image", "sponsor"];

export type TextSize = "s" | "m" | "l" | "xl";

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

export function emptyIssueContent(): IssueContent {
  return { pages: [makePage()] };
}
