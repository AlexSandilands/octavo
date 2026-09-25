// The model-selection fixture's cases (#315, cases/*.json) and the issue each
// starts from: a seed issue (fictional demo content, committed) or a new one,
// with the case's setup applied through the app's own block builders. Block
// ids are seeded, so every run and every model sees a byte-identical message.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { buildIssues } from "../../../src/db/seed-data.ts";
import { SEED_LOGOS } from "../../../src/db/seed/cover-elements.ts";
import type { SeedImages } from "../../../src/db/seed/images.ts";
import { makeBlock, type Block, type Page } from "../../../src/lib/blocks.ts";
import { createId } from "../../../src/lib/id.ts";
import { collectImageIds } from "../../../src/lib/images.ts";
import { markdownToDoc } from "../../../src/lib/markdown-doc.ts";
import { checkSchema } from "../../assistant-models/checks.mts";
import {
  clubMark,
  generatedArt,
  loadPhotos,
  seedArt,
  type FixtureImage,
} from "./art.mts";

const item = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("heading"),
    title: z.string(),
    level: z.enum(["main", "section", "paragraph"]),
    kicker: z.string().optional(),
  }),
  z.object({
    kind: z.literal("text"),
    markdown: z.string().min(1),
    size: z.enum(["s", "m", "l", "xl"]).optional(),
  }),
  z.object({
    kind: z.literal("image"),
    imageId: z.string(),
    align: z.enum(["full", "left", "right"]).optional(),
    width: z.number().optional(),
    caption: z.string().optional(),
  }),
]);
const pageBlocks = z.object({
  page: z.number().int().min(1),
  blocks: z.array(item),
});
const tokens = z.object({
  input: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
  output: z.number(),
});

export const caseSchema = z.object({
  id: z.string(),
  description: z.string(),
  /** What counts as success, in words: the scorer checks what it can of it. */
  expectation: z.string().min(1),
  /** Tool families the case needs; it's skipped until they exist. */
  requires: z.array(z.enum(["cover", "vision"])).optional(),
  /** A seed issue by index; omitted when setup.newIssue builds one. */
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
      /** `--photos <dir>` replaces generatedImages with real photos. */
      acceptsPhotos: z.boolean().optional(),
      /** Empty the cover; its photos become unplaced uploads. */
      stripCover: z.boolean().optional(),
    })
    .optional(),
  /** Tokens of one run on Sonnet 5 in the spike, for the cost estimate. */
  estimate: tokens,
  instruction: z.string(),
  paste: z.string().optional(),
  expect: z.object({
    preserve: z.enum(["page", "paste", "none"]),
    tools: z.array(z.string()),
    forbiddenTools: z.array(z.string()).optional(),
    maxCalls: z.number().int(),
    noOverflow: z.boolean(),
    noEdits: z.boolean().optional(),
    maxViews: z.number().int().optional(),
    maxChangedBlocks: z.number().int().optional(),
    /** What "done" looks like, checked on the final pages (checks.mts). */
    done: z.array(checkSchema).min(1),
  }),
});
export type Case = z.infer<typeof caseSchema>;

const CASES_DIR = join(import.meta.dirname, "cases");

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

/** An issue as the fixture holds it: the editor's state plus its images. */
export type FixtureIssue = {
  title: string;
  theme: string;
  pages: Page[];
  /** Every image the issue can resolve, by id. */
  images: Map<string, FixtureImage>;
  /** Photos uploaded to the issue, placed or not (logos excluded). */
  uploads: string[];
  logos: { id: string; name: string; imageId: string }[];
  sponsorNames: string[];
  /** A new club's branding on the running head and footer. */
  settings?: { name?: string; org?: string };
};

/** Run `fn` with `crypto.randomUUID` seeded, so ids repeat run to run. */
function withSeededIds<T>(seed: number, fn: () => T): T {
  const original = crypto.randomUUID;
  let state = seed >>> 0;
  const next = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0).toString(16).padStart(8, "0");
  };
  crypto.randomUUID = () => {
    const h = next() + next() + next() + next();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
  try {
    return fn();
  } finally {
    crypto.randomUUID = original;
  }
}

function buildItem(i: z.infer<typeof item>): Block {
  if (i.kind === "heading")
    return {
      ...makeBlock("heading"),
      title: i.title,
      kicker: i.kicker ?? "",
      level: i.level,
    } as Block;
  if (i.kind === "text")
    return {
      ...makeBlock("text"),
      text: markdownToDoc(i.markdown).doc,
      ...(i.size ? { size: i.size } : {}),
    } as Block;
  const align = i.align ?? "full";
  return {
    ...makeBlock("image"),
    imageId: i.imageId,
    align,
    width: i.width ?? (align === "full" ? 100 : 45),
    caption: i.caption ?? "",
    alt: "",
  } as Block;
}

const seedIds = new Proxy({} as SeedImages, {
  get: (_, key) => `img-${String(key)}`,
});

/** The issue a case starts from, its setup applied. */
export async function startingIssue(
  c: Case,
  photosDir?: string,
): Promise<FixtureIssue> {
  const seedImages = await seedArt();
  const extra =
    photosDir && c.setup?.acceptsPhotos
      ? await loadPhotos(photosDir, c.id)
      : await generatedArt(c.setup?.generatedImages ?? []);
  const unplaced = await generatedArt(
    (c.setup?.unplacedImages ?? []).map((i) => ({ ...i, role: "upload" })),
  );
  const mark = c.setup?.generatedLogo
    ? await clubMark(c.setup.generatedLogo.name)
    : null;
  return withSeededIds(306, () =>
    build(c, seedImages, [...extra, ...unplaced], mark),
  );
}

function build(
  c: Case,
  seedImages: Map<string, FixtureImage>,
  extra: FixtureImage[],
  mark: Awaited<ReturnType<typeof clubMark>> | null,
): FixtureIssue {
  const s = c.setup ?? {};
  let issue: FixtureIssue;
  if (s.newIssue) {
    issue = {
      title: s.newIssue.title,
      theme: s.newIssue.theme,
      pages: [
        { id: createId(), cover: true, blocks: [] },
        { id: createId(), blocks: [] },
      ],
      images: new Map(),
      uploads: [],
      logos: [],
      sponsorNames: [],
      settings: {
        name: s.newIssue.title.split(" — ")[0]!,
        org: s.newIssue.clubName,
      },
    };
  } else {
    const seed = buildIssues(seedIds)[c.issue ?? -1];
    if (!seed) throw new Error(`${c.id}: needs "issue" or setup.newIssue`);
    const sponsors = new Set<string>();
    for (const p of seed.content.pages)
      for (const b of p.blocks) if (b.type === "sponsor") sponsors.add(b.name);
    issue = {
      title: seed.title,
      theme: seed.theme,
      pages: seed.content.pages,
      images: new Map(seedImages),
      uploads: collectImageIds(seed.content),
      logos: SEED_LOGOS.map((l) => ({
        id: l.id,
        name: l.name,
        imageId: `img-${l.imageKey}`,
      })),
      sponsorNames: [...sponsors],
    };
  }
  const upload = (img: FixtureImage) => {
    issue.images.set(img.id, img);
    if (!issue.uploads.includes(img.id)) issue.uploads.push(img.id);
  };
  extra.forEach(upload);
  if (mark) {
    issue.logos = [mark.logo, ...issue.logos];
    issue.images.set(mark.image.id, mark.image);
  }
  const cover = issue.pages.find((p) => p.cover);
  if (s.stripCover && cover) {
    cover.blocks = [];
    delete cover.coverElements;
    delete cover.coverOverlay;
  }
  const logoImages = new Set(issue.logos.map((l) => l.imageId));
  issue.uploads = issue.uploads.filter((id) => !logoImages.has(id));
  if (s.replacePage)
    issue.pages[s.replacePage.page - 1]!.blocks =
      s.replacePage.blocks.map(buildItem);
  if (s.appendToPage)
    issue.pages[s.appendToPage.page - 1]!.blocks.push(
      ...s.appendToPage.blocks.map(buildItem),
    );
  return issue;
}

/** The author's words for the case: the instruction, then any paste. */
export const authorText = (c: Case) =>
  c.paste ? `${c.instruction}\n\n${c.paste}` : c.instruction;
