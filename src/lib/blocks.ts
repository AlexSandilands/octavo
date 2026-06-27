import { z } from "zod";
import { createId } from "./id";

// The canonical content model. Editor, reader and (later) PDF all speak this.
// An issue is pages → ordered blocks; stored as one JSONB document on the issue.

export const headingBlockSchema = z.object({
  id: z.string(),
  type: z.literal("heading"),
  kicker: z.string().default(""),
  title: z.string().default(""),
});

export const textBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  text: z.string().default(""),
});

export const imageBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image"),
  imageId: z.string().optional(), // resolved to an R2 image later
  caption: z.string().default(""),
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
      return { id, type, caption: "" };
    case "sponsor":
      return { id, type, name: "Sponsor name" };
  }
}

// Page templates the editor offers from the "Add page" menu. "blank" is the
// plain page; the rest are cover layouts pre-filled with arranged blocks so the
// author starts from a finished-looking design and edits in place. Covers are
// composed from ordinary blocks, so they render through the same theme and
// reader path as every other page — no special-casing downstream.
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
        blocks: [
          { id: bid(), type: "heading", kicker: "Members' Magazine", title: "Spring Issue" },
          { id: bid(), type: "image", caption: "Cover photograph" },
          {
            id: bid(),
            type: "text",
            text: "A short, evocative line that sets the tone for this issue.",
          },
        ],
      };
    case "cover-feature":
      return {
        id,
        blocks: [
          { id: bid(), type: "image", caption: "Cover photograph" },
          { id: bid(), type: "heading", kicker: "In this issue", title: "The Headline Story" },
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
        blocks: [
          { id: bid(), type: "heading", kicker: "Volume One", title: "The Issue Title" },
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
