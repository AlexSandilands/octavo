import {
  MAX_PAGES,
  blockSchema,
  isPageOwning,
  makeBlock,
  type Block,
  type Page,
  type TextSize,
} from "@/lib/blocks";
import { createId } from "@/lib/id";
import { markdownToDoc } from "@/lib/markdown-doc";
import { stringToDoc, type RichTextValue } from "@/lib/rich-text-doc";
import {
  aiToolSchemas,
  type AiInsertItem,
  type AiToolInput,
  type AiReadOnlyTool,
  type AiToolName,
} from "@/lib/ai-tools";
import type { AiCoverToolName } from "@/lib/ai-cover-tools";
import type { EditMeasurer } from "./page-report";
import { placePlan } from "./plan-sections";
import { refuse } from "./refusal";
import { editable, ownedByPhoto } from "./page-guards";
import { splitPage } from "./split-page";
import { carryPaint, choosePaint, styleWords } from "./text-styling";

// The assistant's page edits (#310), lifted from the spike's executor: intent
// in, blocks out, through the same zod the save path uses. Each edit returns a
// new page list — untouched pages keep their identity, so the canvas and the
// fill cache see only what changed. A refusal throws `Refusal`, which the
// executor turns into a result the model reads.

export { Refusal } from "./refusal";

export type EditContext = {
  pages: Page[];
  /** Photos uploaded to this issue, by id: the only ones insert_blocks places. */
  photos: ReadonlySet<string>;
  /** The size new text starts at (the magazine setting); absent reads M. */
  defaultTextSize?: TextSize;
  measure: EditMeasurer;
  /** The run's: aborted when it ends or is stopped. */
  signal?: AbortSignal;
};

export type EditResult = {
  pages: Page[];
  /** One line saying what changed, before the fill lines. */
  text: string;
  /** Page ids whose fill the result reports, in order. */
  report: string[];
  /** The block a move_block moved, for the circuit-breaker. */
  moved?: string;
  /** A cover item's cell and width before and after a placement, for the
   *  breaker's rule against putting it back where it was. */
  spot?: { id: string; from: string; to: string };
  /** Lines for the author's run summary (a photo the plan suggested, #312). */
  notes?: string[];
};

type MutatingTool = Exclude<AiToolName, AiReadOnlyTool | AiCoverToolName>;
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

const richDoc = (v: RichTextValue) =>
  typeof v === "string" ? stringToDoc(v) : v;

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

/** `block` at `size`; M is the default and is never stored. No size keeps it. */
function withSize(block: Block, size?: TextSize): Block {
  if (!size) return block;
  const next = { ...block, size } as Block & { size?: TextSize };
  if (size === "m") delete next.size;
  return next;
}

/** The stored field for a text column: full is the absence of one. */
const columnField = (column?: "full" | "left" | "right") =>
  column && column !== "full" ? { column } : {};

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
    block = {
      ...makeBlock("text", item.size ?? ctx.defaultTextSize),
      text: md.doc,
      ...columnField(item.column),
    } as Block;
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
        return refuse(`block ${a.blockId} is a ${at.block.type}, not text`);
      const md = markdownToDoc(a.markdown);
      // Markdown can't carry colour/font: put them back on words that stayed.
      const kept = carryPaint(richDoc(at.block.text), md.doc);
      if (kept.dropped.length)
        md.notes.push(
          `colour/font dropped from changed words ${kept.dropped.map((t) => `"${t}"`).join(", ")}; style_text restyles them`,
        );
      const blocks = at.page.blocks.map((b, i) =>
        i === at.blockIdx
          ? ({ ...withSize(b, a.size), text: kept.doc } as Block)
          : b,
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
        paint: choosePaint(b.paint, a),
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
    case "style_text": {
      const a = aiToolSchemas.style_text.parse(input);
      if (a.color === undefined && a.font === undefined)
        refuse("give color, font or both");
      const at = find(pages, a.blockId);
      editable(pages, at.pageIdx);
      if (at.block.type === "heading")
        refuse("a heading takes color and font through set_heading");
      if (at.block.type !== "text")
        return refuse(`block ${a.blockId} is a ${at.block.type}, not text`);
      const styled = styleWords(richDoc(at.block.text), a.match, a);
      if (!styled.count)
        refuse(
          a.match === undefined
            ? `block ${a.blockId} has no text to style`
            : `"${a.match}" isn't in block ${a.blockId} as whole words; match its words exactly`,
        );
      return {
        pages: withBlocks(
          pages,
          at.pageIdx,
          at.page.blocks.map((b, i) =>
            i === at.blockIdx ? ({ ...b, text: styled.doc } as Block) : b,
          ),
        ),
        text:
          a.match === undefined
            ? "Styled the whole block."
            : `Styled ${styled.count === 1 ? "1 occurrence" : `${styled.count} occurrences`} of "${a.match}".`,
        report: [at.page.id],
      };
    }
    case "propose_sections":
      return placePlan(ctx, aiToolSchemas.propose_sections.parse(input));
    case "set_text_layout": {
      const a = aiToolSchemas.set_text_layout.parse(input);
      const at = find(pages, a.blockId);
      editable(pages, at.pageIdx);
      if (at.block.type !== "text")
        return refuse(`block ${a.blockId} is a ${at.block.type}, not text`);
      const column = a.column === "full" ? undefined : a.column;
      const text = { ...at.block, column } as Block;
      return {
        pages: withBlocks(
          pages,
          at.pageIdx,
          at.page.blocks.map((b, i) => (i === at.blockIdx ? text : b)),
        ),
        text:
          a.column === "full"
            ? "Set the text to span the page."
            : `Set the text in the ${a.column} column.`,
        report: [at.page.id],
      };
    }
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
