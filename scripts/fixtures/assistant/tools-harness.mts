// The stand-in measurer and editor for check-ai-tools.mts (#310): fixed block
// heights on an 800px text area, a history that records what the executor
// hands it, the seed with opaque photo ids, and block builders.
import { coverSources } from "../../../src/lib/cover-elements";
import { readCoverWarnings } from "../../../src/features/editor/use-cover-layout-warnings";
import { buildIssues } from "../../../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../../../src/db/seed/images";
import { createId } from "../../../src/lib/id";
import { makeBlock, type Block, type Page } from "../../../src/lib/blocks";
import { stringToDoc, type RichDoc } from "../../../src/lib/rich-text-doc";
import { richDocBlocks } from "../../../src/lib/rich-text-split";
import type { EditorSnapshot } from "../../../src/features/editor/use-editor-history";
import { createAssistantExecutor } from "../../../src/features/editor/assistant/executor";
import type {
  EditMeasurer,
  PageReport,
} from "../../../src/features/editor/assistant/page-report";
import { fillFromMeasure } from "../../../src/features/editor/assistant/page-fill";

export let failures = 0;
export const ok = (cond: unknown, msg: string) => {
  if (!cond) failures++;
  console.log(`${cond ? "ok" : "FAIL"} — ${msg}`);
};
export const heading = (name: string) =>
  console.log(`\n── ${name} `.padEnd(72, "─"));

// ── A stand-in measurer: fixed heights on an 800px text area ───────────────
const AVAIL = 800;
const NODE_PX = 40;
export const docOf = (b: Extract<Block, { type: "text" }>): RichDoc =>
  typeof b.text === "string" ? stringToDoc(b.text) : b.text;
const height = (b: Block) =>
  b.type === "text"
    ? richDocBlocks(b.text).length * NODE_PX
    : b.type === "heading"
      ? 60
      : "width" in b
        ? 3 * b.width
        : 80;
export let measured = 0;
export const measurer: EditMeasurer = {
  // No layout here: only the warnings a cover's data can show (broken links).
  async cover(page, pages) {
    return readCoverWarnings(page, coverSources(pages));
  },
  async report(page: Page): Promise<PageReport> {
    measured++;
    if (page.cover)
      return {
        fill: { kind: "cover" },
        overflowAt: null,
        overflowPx: 0,
        heights: {},
        text: [],
      };
    let y = 0;
    let overflowAt: PageReport["overflowAt"] = null;
    const heights: Record<string, number> = {};
    for (const b of page.blocks) {
      heights[b.id] = height(b);
      if (!overflowAt && y + height(b) > AVAIL)
        overflowAt = { blockId: b.id, fitsAlone: height(b) <= AVAIL };
      y += height(b);
    }
    return {
      fill: fillFromMeasure({ used: y, avail: AVAIL }),
      overflowAt,
      overflowPx: Math.max(0, y - AVAIL),
      heights,
      text: overflowAt
        ? page.blocks
            .filter((b) => b.type === "text")
            .map((b) => ({
              id: b.id,
              lines: richDocBlocks(b.text).length * 2,
              lastLines: richDocBlocks(b.text).map(() => 3),
            }))
        : [],
    };
  },
  async textFlow(blocks, blockId) {
    let y = 0;
    for (const b of blocks) {
      if (b.id === blockId && b.type === "text") {
        const nodes = richDocBlocks(b.text).map((_, i) => ({
          top: y + i * NODE_PX,
          bottom: y + (i + 1) * NODE_PX,
        }));
        return { nodes, firstAvail: AVAIL - y, restAvail: AVAIL };
      }
      y += height(b);
    }
    return null;
  },
};

// ── The seed, with opaque photo ids ────────────────────────────────────────
const ids = Object.fromEntries(
  SEED_IMAGES.map((s) => [s.key, createId()]),
) as SeedImages;
export const issues = buildIssues(ids);
export const photos = new Set(Object.values(ids));
/** The logo library add_logo names from; its mark is an ordinary image id. */
export const logos = [
  { id: "logo-burgee", name: "Club burgee", imageId: "img-burgee" },
];
export const call = {
  photos,
  logos,
  read: () => ({ text: "(read_page)" }),
  view: async () => ({ text: "(view)" }),
};

export function harness(pages: Page[]) {
  let state: EditorSnapshot = { pages, curPage: 1, sel: null };
  const history: EditorSnapshot[] = [];
  const executor = createAssistantExecutor({
    measure: measurer,
    handle: {
      state: () => state,
      apply: async (next, record) => {
        if (record) history.push(record);
        state = next;
      },
    },
  });
  return {
    executor,
    history,
    get pages() {
      return state.pages;
    },
    set(next: EditorSnapshot) {
      state = next;
    },
    run: (name: string, input: unknown) => executor.run(name, input, call),
  };
}

export const para = (text: string) => ({
  type: "paragraph" as const,
  content: [{ type: "text" as const, text }],
});
export type TextBlock = Extract<Block, { type: "text" }>;
export const textBlock = (n: number, label = "Para"): TextBlock => ({
  ...(makeBlock("text") as TextBlock),
  text: {
    type: "doc",
    content: Array.from({ length: n }, (_, i) => para(`${label} ${i + 1}.`)),
  },
});
export const headingBlock = (title: string): Block => ({
  ...(makeBlock("heading") as Extract<Block, { type: "heading" }>),
  title,
  level: "section",
});
export const photo = (
  width = 100,
  align: "full" | "left" | "right" = "full",
): Block =>
  ({
    ...makeBlock("image"),
    imageId: [...photos][0]!,
    align,
    width,
  }) as Block;
export const cover: Page = { id: createId(), blocks: [], cover: true } as Page;
export const page = (...blocks: Block[]): Page => ({ id: createId(), blocks });
