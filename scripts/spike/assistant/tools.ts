// The assistant's tool contract: intent in, never block JSON (#306, #310). The
// zod schemas are what `src/lib/ai-tools.ts` would share between the route and
// the editor's executor; the JSON schemas are the same contract as the model is
// shown it (the AI SDK derives these from zod; the spike's MCP server can't).
import { z } from "zod";

const blockId = z.string().min(1).max(64);
const pageNo = z.number().int().min(1).max(200);
const title = z.string().min(1).max(300);
const markdown = z.string().max(40_000);
const align = z.enum(["full", "left", "right"]);
const width = z.number().int().min(20).max(100);
const level = z.enum(["main", "section", "paragraph"]);
export const anchorSchema = z.union([
  z.object({ blockId }).strict(),
  z.object({ page: pageNo }).strict(),
]);

export const insertItemSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("heading"),
      title,
      level,
      kicker: z.string().max(300).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("text"), markdown: markdown.min(1) }).strict(),
  z
    .object({
      kind: z.literal("image"),
      imageId: blockId,
      align: align.optional(),
      width: width.optional(),
    })
    .strict(),
]);
export type InsertItem = z.infer<typeof insertItemSchema>;

export const toolSchemas = {
  read_page: z.object({ page: pageNo }).strict(),
  set_text: z.object({ blockId, markdown }).strict(),
  set_heading: z
    .object({ blockId, title, kicker: z.string().max(300).optional(), level })
    .strict(),
  insert_blocks: z
    .object({
      after: anchorSchema,
      blocks: z.array(insertItemSchema).min(1).max(40),
    })
    .strict(),
  delete_block: z.object({ blockId }).strict(),
  move_block: z.object({ blockId, after: anchorSchema }).strict(),
  add_page: z.object({ after: pageNo }).strict(),
  split_page: z.object({ page: pageNo }).strict(),
  set_image_text: z
    .object({
      blockId,
      alt: z.string().max(300).optional(),
      caption: z.string().max(300).optional(),
    })
    .strict()
    .refine(
      (a) => a.alt !== undefined || a.caption !== undefined,
      "give alt, caption or both",
    ),
  set_image_layout: z
    .object({ blockId, align, width: width.optional() })
    .strict(),
} as const;

export type ToolName = keyof typeof toolSchemas;
export const TOOL_NAMES = Object.keys(toolSchemas) as ToolName[];
export const READ_ONLY_TOOLS: ToolName[] = ["read_page"];

// --- JSON schemas + descriptions, as the model sees them ----------------------

const str = (description: string, extra: object = {}) => ({
  type: "string",
  description,
  ...extra,
});
const int = (description: string, min: number, max: number) => ({
  type: "integer",
  description,
  minimum: min,
  maximum: max,
});
const idProp = str("A block id from the projection.");
const pageProp = int("Page number, 1-based as in the outline.", 1, 200);
const levelProp = {
  type: "string",
  enum: ["main", "section", "paragraph"],
  description:
    "main = page/feature title, section = an article's section title, paragraph = small run-in sub-head.",
};
const alignProp = {
  type: "string",
  enum: ["full", "left", "right"],
  description:
    "full = full column width; left/right = floated, following text wraps beside it.",
};
const widthProp = int(
  "Percent of the column width (35–50 suits a wrapped photo).",
  20,
  100,
);
const anchorProp = {
  description:
    "Where: after a block ({ blockId }) or at the top of a page ({ page }).",
  anyOf: [
    {
      type: "object",
      properties: { blockId: idProp },
      required: ["blockId"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: { page: pageProp },
      required: ["page"],
      additionalProperties: false,
    },
  ],
};
const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export const toolDefinitions: {
  name: ToolName;
  description: string;
  inputSchema: object;
}[] = [
  {
    name: "read_page",
    description:
      "Read one page in full: every block with its id, text as markdown, and how full the page is.",
    inputSchema: obj({ page: pageProp }, ["page"]),
  },
  {
    name: "set_text",
    description:
      "Replace a text block's content with markdown (paragraphs, - bullets, 1. numbered lists, **bold**, *italic*, [links](url)). A single newline is a line break; a blank line starts a new paragraph.",
    inputSchema: obj(
      { blockId: idProp, markdown: str("The block's new text, as markdown.") },
      ["blockId", "markdown"],
    ),
  },
  {
    name: "set_heading",
    description:
      'Change a heading\'s title, level and (optionally) kicker. Omit kicker to keep it; pass "" to remove it.',
    inputSchema: obj(
      {
        blockId: idProp,
        title: str("The heading text."),
        kicker: str("Small label above the title."),
        level: levelProp,
      },
      ["blockId", "title", "level"],
    ),
  },
  {
    name: "insert_blocks",
    description:
      "Insert new blocks, in order, after a block or at the top of a page. Headings take a title and level; text takes markdown; images take the id of a photo uploaded to the issue.",
    inputSchema: obj(
      {
        after: anchorProp,
        blocks: {
          type: "array",
          minItems: 1,
          items: {
            anyOf: [
              obj(
                {
                  kind: { const: "heading" },
                  title: str("The heading text."),
                  level: levelProp,
                  kicker: str("Small label above the title."),
                },
                ["kind", "title", "level"],
              ),
              obj(
                {
                  kind: { const: "text" },
                  markdown: str("Body text as markdown."),
                },
                ["kind", "markdown"],
              ),
              obj(
                {
                  kind: { const: "image" },
                  imageId: str("A photo id from the issue."),
                  align: alignProp,
                  width: widthProp,
                },
                ["kind", "imageId"],
              ),
            ],
          },
        },
      },
      ["after", "blocks"],
    ),
  },
  {
    name: "delete_block",
    description: "Delete a block.",
    inputSchema: obj({ blockId: idProp }, ["blockId"]),
  },
  {
    name: "move_block",
    description:
      "Move a block to after another block, or to the top of a page. Works across pages.",
    inputSchema: obj({ blockId: idProp, after: anchorProp }, [
      "blockId",
      "after",
    ]),
  },
  {
    name: "add_page",
    description:
      "Add an empty page after the given page. Later pages renumber.",
    inputSchema: obj({ after: pageProp }, ["after"]),
  },
  {
    name: "split_page",
    description:
      "Carry the end of an overflowing page onto a new page inserted after it: trailing blocks move, and a long final text block is split between paragraphs. Later pages renumber.",
    inputSchema: obj({ page: pageProp }, ["page"]),
  },
  {
    name: "set_image_text",
    description:
      'Set a placed photo\'s alt text (what a screen reader says) and/or its visible caption. Pass "" to clear a caption.',
    inputSchema: obj(
      { blockId: idProp, alt: str("Alt text."), caption: str("Caption.") },
      ["blockId"],
    ),
  },
  {
    name: "set_image_layout",
    description: "Re-align or resize a placed photo.",
    inputSchema: obj({ blockId: idProp, align: alignProp, width: widthProp }, [
      "blockId",
      "align",
    ]),
  },
];
