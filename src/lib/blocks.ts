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

export function makePage(): Page {
  return { id: createId(), blocks: [] };
}

export function emptyIssueContent(): IssueContent {
  return { pages: [makePage()] };
}
