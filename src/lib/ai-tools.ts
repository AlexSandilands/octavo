// The assistant's tool contract (#306): intent in, never block JSON. Shared by
// the chat route (which declares the tools and validates the model's arguments)
// and the editor's executor (which runs them), so both read the same zod.
// Lifted from the spike (`scripts/spike/assistant/tools.ts`) with the editing
// tools (#310); their executor is src/features/editor/assistant/.
import { z } from "zod";

const pageNo = z
  .number()
  .int()
  .min(1)
  .max(200)
  .describe("Page number, 1-based as in the outline.");
const blockId = z
  .string()
  .min(1)
  .max(64)
  .describe("A block id from the projection or read_page.");
// The save path's own limits (src/lib/blocks.ts): short text is 300 characters.
const short = (what: string) => z.string().max(300).describe(what);
const title = z.string().min(1).max(300).describe("The heading text.");
const kicker = short("Small label above the title, 1–4 words.");
const markdown = z.string().max(40_000).describe("Body text as markdown.");
const level = z
  .enum(["main", "section", "paragraph"])
  .describe(
    "main = page/feature title, section = an article's section title, paragraph = small run-in sub-head.",
  );
const align = z
  .enum(["full", "left", "right"])
  .describe(
    "full = full column width; left/right = floated, following text wraps beside it.",
  );
const width = z
  .number()
  .int()
  .min(20)
  .max(100)
  .describe("Percent of the column width (35–50 suits a wrapped photo).");
const anchor = z
  .union([z.object({ blockId }).strict(), z.object({ page: pageNo }).strict()])
  .describe(
    "Where: after a block ({ blockId }) or at the top of a page ({ page }).",
  );

export const aiInsertItemSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("heading"),
      title,
      level,
      kicker: kicker.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("text"), markdown: markdown.min(1) }).strict(),
  z
    .object({
      kind: z.literal("image"),
      imageId: z.string().min(1).max(64).describe("A photo id from the issue."),
      align: align.optional(),
      width: width.optional(),
      caption: short("Visible caption (optional, short).").optional(),
      alt: short("Alt text: what a screen reader says.").optional(),
    })
    .strict(),
]);
export type AiInsertItem = z.infer<typeof aiInsertItemSchema>;

// A long paste's plan (#312): one call, placed by the paginator. Headline,
// kicker and standfirst are separate fields so the model can't blur them.
export const AI_PLAN_MAX_SECTIONS = 40;
export const AI_PLAN_MAX_BODY = 20_000;
const planPhoto = z
  .object({
    imageId: z
      .string()
      .min(1)
      .max(64)
      .describe(
        "A photo id from the issue. Omit it to suggest a photo you don't have.",
      )
      .optional(),
    after: z
      .union([
        z.literal("standfirst"),
        z
          .number()
          .int()
          .min(1)
          .max(500)
          .describe("After the body's nth paragraph or list, 1-based."),
      ])
      .optional(),
    align: align.optional(),
  })
  .strict();
export const aiPlanSectionSchema = z
  .object({
    headline: title.describe("The article's title: its headline as written."),
    kicker: kicker.optional(),
    standfirst: z
      .string()
      .max(1_000)
      .describe("The intro sentence or two under the headline, as markdown.")
      .optional(),
    body: z
      .string()
      .min(1)
      .max(AI_PLAN_MAX_BODY)
      .describe(
        "The article's text as markdown. A line starting ## is a section heading, ### a run-in sub-head.",
      ),
    photos: z.array(planPhoto).max(12).optional(),
  })
  .strict();
export type AiPlanSection = z.infer<typeof aiPlanSectionSchema>;

// The order here is the order the model sees: part of the cached prompt prefix,
// so new tools go at the end.
export const aiToolSchemas = {
  read_page: z.object({ page: pageNo }).strict(),
  set_text: z
    .object({
      blockId,
      markdown: markdown.describe("The block's new text, as markdown."),
    })
    .strict(),
  set_heading: z
    .object({ blockId, title, kicker: kicker.optional(), level })
    .strict(),
  insert_blocks: z
    .object({
      after: anchor,
      blocks: z.array(aiInsertItemSchema).min(1).max(40),
    })
    .strict(),
  delete_block: z.object({ blockId }).strict(),
  move_block: z.object({ blockId, after: anchor }).strict(),
  add_page: z
    .object({ after: pageNo.describe("The new page goes after this one.") })
    .strict(),
  split_page: z.object({ page: pageNo }).strict(),
  set_image_text: z
    .object({
      blockId,
      alt: short("Alt text.").optional(),
      caption: short("Caption.").optional(),
    })
    .strict(),
  set_image_layout: z
    .object({ blockId, align, width: width.optional() })
    .strict(),
  propose_sections: z
    .object({
      after: pageNo.describe(
        "The sections go on new pages after this page. If this page is empty (and not the cover), the first section starts on it.",
      ),
      sections: z.array(aiPlanSectionSchema).min(1).max(AI_PLAN_MAX_SECTIONS),
    })
    .strict(),
} as const;

export const aiToolDescriptions: Record<AiToolName, string> = {
  read_page:
    "Read one page in full: every block with its id, text as markdown, and how full the page is.",
  set_text:
    "Replace a text block's content with markdown (paragraphs, - bullets, 1. numbered lists, **bold**, *italic*, [links](url)). A single newline is a line break; a blank line starts a new paragraph.",
  set_heading:
    'Change a heading\'s title, level and (optionally) kicker. Omit kicker to keep it; pass "" to remove it.',
  insert_blocks:
    "Insert new blocks, in order, after a block or at the top of a page. Headings take a title and level; text takes markdown; images take the id of a photo uploaded to the issue, with optional align (default full), width (default 100 for full, 45 for left/right), caption and alt.",
  delete_block: "Delete a block.",
  move_block:
    "Move a block to after another block, or to the top of a page. Works across pages.",
  add_page: "Add an empty page after the given page. Later pages renumber.",
  split_page:
    "Carry the end of an overflowing page onto a new page inserted after it, the way the editor's own fix does: a long text block is split between paragraphs and what follows it moves with the remainder. Later pages renumber.",
  set_image_text:
    'Set a placed photo\'s alt text (what a screen reader says) and/or its visible caption. Pass "" to clear a caption.',
  set_image_layout:
    "Re-align or resize a placed photo. Setting align to full without a width makes it full width (100); setting left/right without a width keeps its width, or uses 45 if it was full width.",
  propose_sections: `Lay out long pasted content (several articles, or more than a page of text) in one call. Each section is one article: it starts at the top of a new page under a main heading, and the editor fits it onto as many pages as it needs, adding pages, so don't split or measure it yourself. Keep every word of the author's text. Fields, from a pasted article:
  SPRING SHOW DRAWS RECORD CROWD
  More than 400 visitors came through the hall on Saturday.
  The doors opened at nine…
→ { "headline": "SPRING SHOW DRAWS RECORD CROWD", "standfirst": "More than 400 visitors came through the hall on Saturday.", "body": "The doors opened at nine…" }
The line in capitals is the headline, never the kicker. The sentence under it is the standfirst, never the headline. Give a kicker (a 1–4 word label such as "Club Notes") only when the author's text has one above the headline. Photos: an issue photo's id, placed after the standfirst or after a body paragraph; without an id it is only a suggestion, reported to the author.`,
};

/** Tools that only read; every other tool edits the issue. */
export const AI_READ_ONLY_TOOLS: readonly AiToolName[] = ["read_page"];

export type AiToolName = keyof typeof aiToolSchemas;
export const AI_TOOL_NAMES = Object.keys(aiToolSchemas) as AiToolName[];
export type AiToolInput<N extends AiToolName> = z.infer<
  (typeof aiToolSchemas)[N]
>;

// What every tool returns to the model, from the browser via addToolOutput.
// Refusals and invalid arguments are ordinary outputs the model reads, never
// throws. `images` is for #342's view tools: base64 without a data: prefix.
export const AI_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const AI_MAX_IMAGE_BASE64 = 1_500_000;
export const AI_MAX_TOOL_TEXT = 60_000;
export const AI_MAX_IMAGES_PER_OUTPUT = 8;

export const aiToolOutputSchema = z
  .object({
    text: z.string().max(AI_MAX_TOOL_TEXT),
    images: z
      .array(
        z
          .object({
            mediaType: z.enum(AI_IMAGE_TYPES),
            data: z.string().min(1).max(AI_MAX_IMAGE_BASE64),
          })
          .strict(),
      )
      .max(AI_MAX_IMAGES_PER_OUTPUT)
      .optional(),
  })
  .strict();
export type AiToolOutput = z.infer<typeof aiToolOutputSchema>;
