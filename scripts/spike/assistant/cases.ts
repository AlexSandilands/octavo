// Loads the spike's cases (cases/*.json) and builds each one's starting issue:
// a seed issue with the case's `setup` applied through the same block builder
// the tools use.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { buildBlock } from "./executor.ts";
import { CONTENT_VERSION, type Page } from "../../../src/lib/blocks.ts";
import { createId } from "../../../src/lib/id.ts";
import { generateImages, generateLogo, loadPhotos } from "./generated.ts";
import {
  seedIssues,
  withSeededIds,
  type ImageInfo,
  type IssueContext,
} from "./seed.ts";
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
  /** A seed issue by index; omitted when setup.newIssue builds one from nothing. */
  issue: z.number().int().min(0).max(5).optional(),
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
      newIssue: z
        .object({ title: z.string(), theme: z.string(), clubName: z.string() })
        .optional(),
      generatedImages: z
        .array(
          z.object({
            id: z.string(),
            role: z.string(),
            width: z.number().int(),
            height: z.number().int(),
          }),
        )
        .optional(),
      generatedLogo: z.object({ name: z.string() }).optional(),
      /** `run.mts --photos <dir>` replaces generatedImages with real photos (opaque ids). */
      acceptsPhotos: z.boolean().optional(),
      /** Empty the cover; its photos become unplaced uploads. */
      stripCover: z.boolean().optional(),
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
    /** Views allowed with --vision (default 6). */
    maxViews: z.number().int().optional(),
    maxChangedBlocks: z.number().int().optional(),
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

/** A fresh issue (seed or new) with the case's setup applied. */
export async function startingContext(
  c: Case,
  photosDir?: string,
): Promise<IssueContext> {
  const generated =
    photosDir && c.setup?.acceptsPhotos
      ? await loadPhotos(photosDir, c.id)
      : await generateImages(c.setup?.generatedImages ?? []);
  const logo = c.setup?.generatedLogo
    ? await generateLogo(c.setup.generatedLogo.name)
    : null;
  return withSeededIds(306, () => buildStart(c, generated, logo));
}

function newIssue(
  n: NonNullable<NonNullable<Case["setup"]>["newIssue"]>,
): IssueContext {
  const cover: Page = { id: createId(), cover: true, blocks: [] };
  return {
    title: n.title,
    theme: n.theme,
    content: {
      version: CONTENT_VERSION,
      pages: [cover, { id: createId(), blocks: [] }],
    },
    images: new Map(),
    uploads: [],
    logos: [],
    sponsorNames: [],
    // The new club's own branding on the running head and footer.
    settings: { name: n.title.split(" — ")[0]!, org: n.clubName },
  };
}

function buildStart(
  c: Case,
  generated: ImageInfo[],
  logo: Awaited<ReturnType<typeof generateLogo>> | null,
): IssueContext {
  const ctx = c.setup?.newIssue
    ? newIssue(c.setup.newIssue)
    : seedIssues()[c.issue ?? -1];
  if (!ctx) throw new Error(`${c.id}: needs "issue" or setup.newIssue`);
  for (const img of generated) {
    ctx.uploads.push(img);
    ctx.images.set(img.id, img);
  }
  if (logo) {
    ctx.logos = [logo.logo, ...ctx.logos];
    ctx.images.set(logo.image.id, logo.image);
  }
  const cover = ctx.content.pages.find((p) => p.cover);
  if (c.setup?.stripCover && cover) {
    for (const b of cover.blocks)
      if (b.type === "image" && b.imageId) {
        const info = ctx.images.get(b.imageId);
        if (info) ctx.uploads.push(info);
      }
    cover.blocks = [];
    delete cover.coverElements;
    delete cover.coverOverlay;
  }
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
