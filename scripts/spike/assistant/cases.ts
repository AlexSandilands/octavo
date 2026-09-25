// Loads the spike's cases (cases/*.json) and builds each one's starting issue:
// a seed issue with the case's `setup` applied through the same block builder
// the tools use.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { buildBlock } from "./executor.ts";
import { seedIssues, type IssueContext } from "./seed.ts";
import { insertItemSchema } from "./tools.ts";

// Setup items are insert items plus the two fields only a fixture may set.
const setupItem = z.union([
  insertItemSchema,
  z.object({
    kind: z.literal("text"),
    markdown: z.string().min(1),
    size: z.enum(["s", "m", "l", "xl"]),
  }),
  z.object({
    kind: z.literal("image"),
    imageId: z.string(),
    align: z.enum(["full", "left", "right"]).optional(),
    width: z.number().optional(),
    caption: z.string(),
  }),
]);
const pageBlocks = z.object({
  page: z.number().int().min(1),
  blocks: z.array(setupItem),
});

export const caseSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  issue: z.number().int().min(0).max(5),
  page: z.number().int().min(1),
  setup: z
    .object({
      replacePage: pageBlocks.optional(),
      appendToPage: pageBlocks.optional(),
      unplacedImages: z
        .array(
          z.object({ id: z.string(), width: z.number(), height: z.number() }),
        )
        .optional(),
    })
    .optional(),
  instruction: z.string(),
  paste: z.string().optional(),
  expect: z.object({
    preserve: z.enum(["page", "paste", "none"]),
    tools: z.array(z.string()),
    forbiddenTools: z.array(z.string()).optional(),
    maxCalls: z.number().int(),
    noOverflow: z.boolean(),
    noEdits: z.boolean().optional(),
  }),
});
export type Case = z.infer<typeof caseSchema>;

export const CASES_DIR = join(import.meta.dirname, "cases");

export function loadCases(): Case[] {
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const parsed = caseSchema.safeParse(
        JSON.parse(readFileSync(join(CASES_DIR, f), "utf8")),
      );
      if (!parsed.success)
        throw new Error(
          `${f}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
        );
      return parsed.data;
    });
}

function buildItems(ctx: IssueContext, items: z.infer<typeof setupItem>[]) {
  return items.map((item) => {
    const extras = {
      caption: "caption" in item ? item.caption : undefined,
      size: "size" in item ? item.size : undefined,
    };
    const base =
      item.kind === "text"
        ? { kind: "text" as const, markdown: item.markdown }
        : item.kind === "image"
          ? {
              kind: "image" as const,
              imageId: item.imageId,
              align: item.align,
              width: item.width,
            }
          : item;
    return buildBlock(ctx, base, extras).block;
  });
}

/** A fresh seed issue with the case's setup applied. */
export function startingContext(c: Case): IssueContext {
  const ctx = seedIssues()[c.issue]!;
  for (const img of c.setup?.unplacedImages ?? []) {
    ctx.uploads.push(img);
    ctx.images.set(img.id, img);
  }
  const { replacePage, appendToPage } = c.setup ?? {};
  if (replacePage)
    ctx.content.pages[replacePage.page - 1]!.blocks = buildItems(
      ctx,
      replacePage.blocks,
    );
  if (appendToPage)
    ctx.content.pages[appendToPage.page - 1]!.blocks.push(
      ...buildItems(ctx, appendToPage.blocks),
    );
  return ctx;
}

/** The message the route would send: the projection, then the author's words. */
export function userMessage(projectionText: string, c: Case): string {
  const words = c.paste ? `${c.instruction}\n\n${c.paste}` : c.instruction;
  return `The editor's view of the issue right now:\n\n${projectionText}\n\n---\n\nThe editor's message:\n\n${words}`;
}
