import {
  MAX_PAGES,
  blockSchema,
  isPageOwning,
  makeBlock,
  type Block,
  type Page,
} from "@/lib/blocks";
import { createId } from "@/lib/id";
import { markdownToDoc } from "@/lib/markdown-doc";
import { richDocBlocks, sliceRichDoc } from "@/lib/rich-text-split";
import {
  aiToolSchemas,
  type AiInsertItem,
  type AiToolInput,
  type AiToolName,
} from "@/lib/ai-tools";
import { planTextFlow } from "../text-flow";
import { describeFill } from "./page-fill";
import type { EditMeasurer } from "./page-report";

// The assistant's page edits (#310), lifted from the spike's executor: intent
// in, blocks out, through the same zod the save path uses. Each edit returns a
// new page list — untouched pages keep their identity, so the canvas and the
// fill cache see only what changed. A refusal throws `Refusal`, which the
// executor turns into a result the model reads.

export class Refusal extends Error {}
const refuse = (message: string): never => {
  throw new Refusal(message);
};

export type EditContext = {
  pages: Page[];
  /** Photos uploaded to this issue, by id: the only ones insert_blocks places. */
  photos: ReadonlySet<string>;
  measure: EditMeasurer;
};

export type EditResult = {
  pages: Page[];
  /** One line saying what changed, before the fill lines. */
  text: string;
  /** Page ids whose fill the result reports, in order. */
  report: string[];
  /** The block a move_block moved, for the circuit-breaker. */
  moved?: string;
};

type MutatingTool = Exclude<AiToolName, "read_page">;
type Found = { pageIdx: number; blockIdx: number; page: Page; block: Block };

function find(pages: Page[], id: string): Found {
  for (const [pageIdx, page] of pages.entries()) {
    const blockIdx = page.blocks.findIndex((b) => b.id === id);
    if (blockIdx !== -1)
      return { pageIdx, blockIdx, page, block: page.blocks[blockIdx]! };
  }
  return refuse(
    `no block has id "${id}"; use an id from the projection or read_page`,
  );
}

function editable(pages: Page[], pageIdx: number): Page {
  const page =
    pages[pageIdx] ??
    refuse(
      `there is no page ${pageIdx + 1}; the issue has ${pages.length} pages`,
    );
  if (page.cover)
    refuse(
      `page ${pageIdx + 1} is the cover, and the assistant can't edit covers yet`,
    );
  return page;
}

const ownedByPhoto = (page: Page, pageNo: number) =>
  page.blocks.some(isPageOwning) &&
  refuse(`page ${pageNo} is a full-page photo; nothing else can go on it`);

/** A new page list with one page's blocks replaced. */
function withBlocks(pages: Page[], pageIdx: number, blocks: Block[]): Page[] {
  const next = [...pages];
  next[pageIdx] = { ...pages[pageIdx]!, blocks };
  return next;
}

/** Width when none is given: full means full width; a float can't be 100%. */
function defaultWidth(align: "full" | "left" | "right", current: number) {
  if (align === "full") return 100;
  return current >= 100 ? 45 : current;
}

const notesLine = (notes: string[]) =>
  notes.length ? ` Note: ${notes.join("; ")}.` : "";

function buildBlock(
  ctx: EditContext,
  item: AiInsertItem,
): { block: Block; notes: string[] } {
  let block: Block;
  const notes: string[] = [];
  if (item.kind === "heading") {
    block = {
      ...makeBlock("heading"),
      title: item.title,
      kicker: item.kicker ?? "",
      level: item.level,
    } as Block;
  } else if (item.kind === "text") {
    const md = markdownToDoc(item.markdown);
    notes.push(...md.notes);
    block = { ...makeBlock("text"), text: md.doc } as Block;
  } else {
    if (!ctx.photos.has(item.imageId))
      refuse(`"${item.imageId}" isn't a photo uploaded to this issue`);
    const align = item.align ?? "full";
    block = {
      ...makeBlock("image"),
      imageId: item.imageId,
      align,
      width: item.width ?? defaultWidth(align, 100),
      caption: item.caption ?? "",
      alt: item.alt ?? "",
    } as Block;
  }
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success)
    refuse(`that ${item.kind} isn't valid: ${parsed.error.issues[0]?.message}`);
  return { block: parsed.data!, notes };
}

/** An anchor as [page index, insertion index]; `moving` is left out of the page. */
function resolveAnchor(
  pages: Page[],
  after: AiToolInput<"move_block">["after"],
  moving?: string,
): [number, number] {
  if ("page" in after) {
    ownedByPhoto(editable(pages, after.page - 1), after.page);
    return [after.page - 1, 0];
  }
  if (after.blockId === moving) refuse("a block can't be moved after itself");
  const at = find(pages, after.blockId);
  ownedByPhoto(editable(pages, at.pageIdx), at.pageIdx + 1);
  return [at.pageIdx, at.blockIdx + 1];
}

/**
 * The editor's overflow fix, run on the page the model names: the first block
 * past the text area is split between top-level nodes (`planTextFlow`, from
 * the measured layout) or, when it can't be, carried whole. Everything after it
 * goes with it, so the reading order holds; a heading left at the foot of the
 * page goes too.
 */
async function splitPage(ctx: EditContext, pageIdx: number) {
  const page = editable(ctx.pages, pageIdx);
  ownedByPhoto(page, pageIdx + 1);
  const report = await ctx.measure.report(page);
  const at = report.overflowAt;
  if (!at)
    return refuse(
      `page ${pageIdx + 1} already fits (${describeFill(report.fill)}); nothing to split`,
    );
  const i = page.blocks.findIndex((b) => b.id === at.blockId);
  const cross = page.blocks[i]!;
  let keep = page.blocks.slice(0, i);
  let carried: Block[][] = [page.blocks.slice(i)];

  const nodes = cross.type === "text" ? richDocBlocks(cross.text) : [];
  if (cross.type === "text" && nodes.length > 1) {
    const metrics = await ctx.measure.textFlow([...keep, cross], cross.id);
    const cuts = metrics ? planTextFlow(metrics) : [];
    if (cuts.length) {
      const bounds = [0, ...cuts, nodes.length];
      keep = [...keep, { ...cross, text: sliceRichDoc(nodes, 0, cuts[0]!) }];
      carried = cuts.map((_, c) => [
        {
          ...cross,
          id: createId(),
          text: sliceRichDoc(nodes, bounds[c + 1]!, bounds[c + 2]!),
        },
      ]);
      carried.at(-1)!.push(...page.blocks.slice(i + 1));
    }
  }
  while (keep.length > 1 && keep.at(-1)!.type === "heading")
    carried[0]!.unshift(keep.pop()!);
  if (!keep.length)
    refuse(
      `page ${pageIdx + 1}'s first block doesn't fit a page on its own; shorten it or move it`,
    );
  if (ctx.pages.length + carried.length > MAX_PAGES)
    refuse(`an issue can have at most ${MAX_PAGES} pages`);

  const added = carried.map((blocks) => ({ id: createId(), blocks }));
  const next = [...ctx.pages];
  next.splice(pageIdx, 1, { ...page, blocks: keep }, ...added);
  const moved = carried.flat().length;
  return {
    pages: next,
    text: `Moved ${moved === 1 ? "1 block" : `${moved} blocks`} onto ${added.length === 1 ? `a new page ${pageIdx + 2}` : `new pages ${pageIdx + 2}–${pageIdx + 1 + added.length}`}; later pages renumbered.`,
    report: [page.id, ...added.map((p) => p.id)],
  };
}

/** Apply one editing tool to the page list. Arguments are parsed here. */
export async function applyEdit(
  ctx: EditContext,
  name: MutatingTool,
  input: unknown,
): Promise<EditResult> {
  const pages = ctx.pages;
  switch (name) {
    case "set_text": {
      const a = aiToolSchemas.set_text.parse(input);
      const at = find(pages, a.blockId);
      editable(pages, at.pageIdx);
      if (at.block.type !== "text")
        refuse(`block ${a.blockId} is a ${at.block.type}, not text`);
      const md = markdownToDoc(a.markdown);
      const blocks = at.page.blocks.map((b, i) =>
        i === at.blockIdx ? ({ ...b, text: md.doc } as Block) : b,
      );
      return {
        pages: withBlocks(pages, at.pageIdx, blocks),
        text: `Updated the text.${notesLine(md.notes)}`,
        report: [at.page.id],
      };
    }
    case "set_heading": {
      const a = aiToolSchemas.set_heading.parse(input);
      const at = find(pages, a.blockId);
      editable(pages, at.pageIdx);
      const b = at.block;
      if (b.type !== "heading")
        return refuse(`block ${a.blockId} is a ${b.type}, not a heading`);
      const heading = {
        ...b,
        title: a.title,
        level: a.level,
        kicker: a.kicker ?? b.kicker,
      };
      return {
        pages: withBlocks(
          pages,
          at.pageIdx,
          at.page.blocks.map((x, i) => (i === at.blockIdx ? heading : x)),
        ),
        text: "Updated the heading.",
        report: [at.page.id],
      };
    }
    case "insert_blocks": {
      const a = aiToolSchemas.insert_blocks.parse(input);
      const [pageIdx, index] = resolveAnchor(pages, a.after);
      const built = a.blocks.map((item) => buildBlock(ctx, item));
      const blocks = [...pages[pageIdx]!.blocks];
      blocks.splice(index, 0, ...built.map((b) => b.block));
      const ids = built.map((b) => `${b.block.type} [${b.block.id}]`);
      return {
        pages: withBlocks(pages, pageIdx, blocks),
        text: `Inserted ${ids.join(", ")} on page ${pageIdx + 1}.${notesLine(built.flatMap((b) => b.notes))}`,
        report: [pages[pageIdx]!.id],
      };
    }
    case "delete_block": {
      const a = aiToolSchemas.delete_block.parse(input);
      const at = find(pages, a.blockId);
      editable(pages, at.pageIdx);
      return {
        pages: withBlocks(
          pages,
          at.pageIdx,
          at.page.blocks.filter((_, i) => i !== at.blockIdx),
        ),
        text: `Deleted the ${at.block.type}.`,
        report: [at.page.id],
      };
    }
    case "move_block": {
      const a = aiToolSchemas.move_block.parse(input);
      const from = find(pages, a.blockId);
      editable(pages, from.pageIdx);
      if (isPageOwning(from.block))
        refuse("a full-page photo can't be moved by the assistant yet");
      resolveAnchor(pages, a.after, a.blockId); // refuse before removing
      const lifted = withBlocks(
        pages,
        from.pageIdx,
        from.page.blocks.filter((_, i) => i !== from.blockIdx),
      );
      const [pageIdx, index] = resolveAnchor(lifted, a.after, a.blockId);
      const blocks = [...lifted[pageIdx]!.blocks];
      blocks.splice(index, 0, from.block);
      const next = withBlocks(lifted, pageIdx, blocks);
      return {
        pages: next,
        text: `Moved the ${from.block.type}.`,
        report: [...new Set([from.page.id, next[pageIdx]!.id])],
        moved: a.blockId,
      };
    }
    case "add_page": {
      const a = aiToolSchemas.add_page.parse(input);
      if (a.after > pages.length)
        refuse(
          `there is no page ${a.after}; the issue has ${pages.length} pages`,
        );
      if (pages.length >= MAX_PAGES)
        refuse(`an issue can have at most ${MAX_PAGES} pages`);
      const next = [...pages];
      next.splice(a.after, 0, { id: createId(), blocks: [] });
      return {
        pages: next,
        text: `Added an empty page ${a.after + 1}; later pages renumbered.`,
        report: [],
      };
    }
    case "split_page":
      return splitPage(ctx, aiToolSchemas.split_page.parse(input).page - 1);
    case "set_image_text": {
      const a = aiToolSchemas.set_image_text.parse(input);
      if (a.alt === undefined && a.caption === undefined)
        refuse("give alt, caption or both");
      const at = find(pages, a.blockId);
      editable(pages, at.pageIdx);
      if (at.block.type !== "image")
        refuse(`block ${a.blockId} is a ${at.block.type}, not a photo`);
      const photo = {
        ...at.block,
        ...(a.alt !== undefined ? { alt: a.alt } : {}),
        ...(a.caption !== undefined ? { caption: a.caption } : {}),
      } as Block;
      const what = [
        a.alt !== undefined && "alt text",
        a.caption !== undefined && "caption",
      ].filter(Boolean);
      return {
        pages: withBlocks(
          pages,
          at.pageIdx,
          at.page.blocks.map((b, i) => (i === at.blockIdx ? photo : b)),
        ),
        text: `Updated the photo's ${what.join(" and ")}.`,
        report: [at.page.id],
      };
    }
    case "set_image_layout": {
      const a = aiToolSchemas.set_image_layout.parse(input);
      const at = find(pages, a.blockId);
      editable(pages, at.pageIdx);
      const b = at.block;
      if (b.type !== "image" && b.type !== "montage" && b.type !== "video")
        return refuse(`block ${a.blockId} is a ${b.type}, not a photo`);
      if (isPageOwning(b))
        refuse("full-page photos can't be re-laid out by the assistant yet");
      const w = a.width ?? defaultWidth(a.align, b.width);
      const photo = { ...b, align: a.align, width: w } as Block;
      return {
        pages: withBlocks(
          pages,
          at.pageIdx,
          at.page.blocks.map((x, i) => (i === at.blockIdx ? photo : x)),
        ),
        text: `Set the photo to ${a.align} ${w}%.`,
        report: [at.page.id],
      };
    }
  }
}
