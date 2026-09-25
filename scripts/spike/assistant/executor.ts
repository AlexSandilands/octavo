// Executes a tool call against the issue — the spike's stand-in for #310's
// editor executor. Pure over `IssueContext`: validate with the tool's zod, edit
// `content`, re-validate the result with the save path's schema, and answer in
// one short line ending with the touched pages' (estimated) fill. Every refusal
// is a result the model reads, never a throw.
import {
  blockSchema,
  issueContentSchema,
  isPageOwning,
  makeBlock,
  type Block,
  type Page,
} from "../../../src/lib/blocks.ts";
import { createId } from "../../../src/lib/id.ts";
import {
  TEXT_AREA_H,
  describeFill,
  describeFillAction,
  estimateFill,
  textDoc,
  usedHeight,
} from "./fill.ts";
import { markdownToDoc } from "./markdown.ts";
import { pageView } from "./projection.ts";
import { issueImageIds, type IssueContext } from "./seed.ts";
import { toolSchemas, type InsertItem, type ToolName } from "./tools.ts";

export type ToolResult = { ok: boolean; text: string; mutated: boolean };

class Refusal extends Error {}
const refuse = (msg: string): never => {
  throw new Refusal(msg);
};

type Found = { pageIdx: number; blockIdx: number; page: Page; block: Block };

function find(ctx: IssueContext, id: string): Found {
  for (const [pageIdx, page] of ctx.content.pages.entries()) {
    const blockIdx = page.blocks.findIndex((b) => b.id === id);
    if (blockIdx !== -1)
      return { pageIdx, blockIdx, page, block: page.blocks[blockIdx]! };
  }
  return refuse(
    `no block has id "${id}" — use an id from the projection or read_page`,
  );
}

function editable(ctx: IssueContext, pageIdx: number): Page {
  const page =
    ctx.content.pages[pageIdx] ??
    refuse(
      `there is no page ${pageIdx + 1}; the issue has ${ctx.content.pages.length} pages`,
    );
  if (page.cover)
    refuse(
      `page ${pageIdx + 1} is the cover, and cover editing isn't available yet`,
    );
  return page;
}

const fillLine = (ctx: IssueContext, pageIdx: number) =>
  `page ${pageIdx + 1}: ${describeFillAction(estimateFill(ctx.content.pages[pageIdx]!, ctx.images))}`;

/** Width when none is given: full means full width; a float can't be 100%. */
function floatDefault(
  align: "full" | "left" | "right",
  current: number,
): number {
  if (align === "full") return 100;
  return current >= 100 ? 45 : current;
}

/** Build a block from an insert item. `extras` carries fields only a case's setup may set. */
export function buildBlock(
  ctx: IssueContext,
  item: InsertItem,
  extras: { caption?: string; size?: "s" | "m" | "l" | "xl" } = {},
): { block: Block; notes: string[] } {
  const notes: string[] = [];
  let block: Block;
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
      ...makeBlock("text"),
      text: md.doc,
      ...(extras.size ? { size: extras.size } : {}),
    } as Block;
  } else {
    if (!issueImageIds(ctx).has(item.imageId))
      refuse(`"${item.imageId}" isn't a photo uploaded to this issue`);
    block = {
      ...makeBlock("image"),
      imageId: item.imageId,
      align: item.align ?? "full",
      width: item.width ?? floatDefault(item.align ?? "full", 100),
      caption: item.caption ?? extras.caption ?? "",
      alt: item.alt ?? "",
    } as Block;
  }
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success)
    refuse(`that ${item.kind} isn't valid: ${parsed.error.issues[0]?.message}`);
  return { block: parsed.data!, notes };
}

/** Resolve an anchor to [pageIdx, insertion index]. `moving` is excluded from the page. */
function resolveAnchor(
  ctx: IssueContext,
  after: { blockId: string } | { page: number },
  moving?: string,
): [number, number] {
  if ("page" in after) {
    const page = editable(ctx, after.page - 1);
    if (page.blocks.some(isPageOwning))
      refuse(
        `page ${after.page} is a full-page photo; nothing else can go on it`,
      );
    return [after.page - 1, 0];
  }
  if (after.blockId === moving) refuse("a block can't be moved after itself");
  const at = find(ctx, after.blockId);
  editable(ctx, at.pageIdx);
  if (isPageOwning(at.block))
    refuse(
      `page ${at.pageIdx + 1} is a full-page photo; nothing else can go on it`,
    );
  return [at.pageIdx, at.blockIdx + 1];
}

function splitPage(ctx: IssueContext, pageIdx: number): string {
  const page = editable(ctx, pageIdx);
  const blocks = [...page.blocks];
  const moved: Block[] = [];
  const over = () => usedHeight(blocks, ctx.images) > TEXT_AREA_H;
  if (!over())
    refuse(
      `page ${pageIdx + 1} already fits (${describeFill(estimateFill(page, ctx.images))}); nothing to split`,
    );
  while (over() && blocks.length > 1) {
    const last = blocks[blocks.length - 1]!;
    if (last.type === "text") {
      // Keep as many of the text's leading paragraphs/lists as fit.
      const doc = textDoc(last);
      for (let k = doc.content.length - 1; k >= 1; k--) {
        const head = {
          ...last,
          text: { ...doc, content: doc.content.slice(0, k) },
        };
        if (
          usedHeight([...blocks.slice(0, -1), head], ctx.images) <= TEXT_AREA_H
        ) {
          blocks[blocks.length - 1] = head;
          moved.unshift({
            ...last,
            id: createId(),
            text: { ...doc, content: doc.content.slice(k) },
          });
          break;
        }
      }
      if (blocks[blocks.length - 1] !== last) break;
    }
    moved.unshift(blocks.pop()!);
  }
  // Don't strand a heading at the foot of the page.
  while (blocks.length > 1 && blocks[blocks.length - 1]!.type === "heading")
    moved.unshift(blocks.pop()!);
  if (!moved.length)
    refuse(
      `page ${pageIdx + 1}'s first block is taller than a page on its own; shorten it or move it`,
    );
  ctx.content.pages[pageIdx] = { ...page, blocks };
  ctx.content.pages.splice(pageIdx + 1, 0, { id: createId(), blocks: moved });
  return `Moved ${moved.length} block${moved.length > 1 ? "s" : ""} onto a new page ${pageIdx + 2}; later pages renumbered. ${fillLine(ctx, pageIdx)}; ${fillLine(ctx, pageIdx + 1)}`;
}

function apply(ctx: IssueContext, name: ToolName, args: unknown): string {
  const pages = ctx.content.pages;
  switch (name) {
    case "read_page":
      return pageView(ctx, toolSchemas.read_page.parse(args).page);
    case "set_text": {
      const a = toolSchemas.set_text.parse(args);
      const at = find(ctx, a.blockId);
      editable(ctx, at.pageIdx);
      if (at.block.type !== "text")
        refuse(`block ${a.blockId} is a ${at.block.type}, not text`);
      const md = markdownToDoc(a.markdown);
      at.page.blocks[at.blockIdx] = { ...at.block, text: md.doc } as Block;
      const notes = md.notes.length ? ` Note: ${md.notes.join("; ")}.` : "";
      return `Updated the text.${notes} ${fillLine(ctx, at.pageIdx)}`;
    }
    case "set_heading": {
      const a = toolSchemas.set_heading.parse(args);
      const at = find(ctx, a.blockId);
      editable(ctx, at.pageIdx);
      if (at.block.type !== "heading")
        refuse(`block ${a.blockId} is a ${at.block.type}, not a heading`);
      at.page.blocks[at.blockIdx] = {
        ...at.block,
        title: a.title,
        level: a.level,
        kicker: a.kicker ?? (at.block as { kicker: string }).kicker,
      } as Block;
      return `Updated the heading. ${fillLine(ctx, at.pageIdx)}`;
    }
    case "insert_blocks": {
      const a = toolSchemas.insert_blocks.parse(args);
      const [pageIdx, index] = resolveAnchor(ctx, a.after);
      const built = a.blocks.map((item) => buildBlock(ctx, item));
      pages[pageIdx]!.blocks.splice(index, 0, ...built.map((b) => b.block));
      const notes = built.flatMap((b) => b.notes);
      const ids = built
        .map((b) => `${b.block.type} [${b.block.id}]`)
        .join(", ");
      return `Inserted ${ids} on page ${pageIdx + 1}.${notes.length ? ` Note: ${notes.join("; ")}.` : ""} ${fillLine(ctx, pageIdx)}`;
    }
    case "delete_block": {
      const a = toolSchemas.delete_block.parse(args);
      const at = find(ctx, a.blockId);
      editable(ctx, at.pageIdx);
      at.page.blocks.splice(at.blockIdx, 1);
      return `Deleted the ${at.block.type}. ${fillLine(ctx, at.pageIdx)}`;
    }
    case "move_block": {
      const a = toolSchemas.move_block.parse(args);
      const from = find(ctx, a.blockId);
      editable(ctx, from.pageIdx);
      if (isPageOwning(from.block))
        refuse("a full-page photo can't be moved by the assistant yet");
      resolveAnchor(ctx, a.after, a.blockId); // validate before removing
      from.page.blocks.splice(from.blockIdx, 1);
      const [pageIdx, index] = resolveAnchor(ctx, a.after, a.blockId);
      pages[pageIdx]!.blocks.splice(index, 0, from.block);
      const where =
        pageIdx === from.pageIdx
          ? fillLine(ctx, pageIdx)
          : `${fillLine(ctx, from.pageIdx)}; ${fillLine(ctx, pageIdx)}`;
      return `Moved the ${from.block.type}. ${where}`;
    }
    case "add_page": {
      const a = toolSchemas.add_page.parse(args);
      if (a.after > pages.length)
        refuse(
          `there is no page ${a.after}; the issue has ${pages.length} pages`,
        );
      pages.splice(a.after, 0, { id: createId(), blocks: [] });
      return `Added an empty page ${a.after + 1}; later pages renumbered.`;
    }
    case "split_page":
      return splitPage(ctx, toolSchemas.split_page.parse(args).page - 1);
    case "set_image_text": {
      const a = toolSchemas.set_image_text.parse(args);
      const at = find(ctx, a.blockId);
      editable(ctx, at.pageIdx);
      if (at.block.type !== "image")
        refuse(`block ${a.blockId} is a ${at.block.type}, not a photo`);
      at.page.blocks[at.blockIdx] = {
        ...at.block,
        ...(a.alt !== undefined ? { alt: a.alt } : {}),
        ...(a.caption !== undefined ? { caption: a.caption } : {}),
      } as Block;
      return `Updated the photo's ${[a.alt !== undefined && "alt text", a.caption !== undefined && "caption"].filter(Boolean).join(" and ")}. ${fillLine(ctx, at.pageIdx)}`;
    }
    case "set_image_layout": {
      const a = toolSchemas.set_image_layout.parse(args);
      const at = find(ctx, a.blockId);
      editable(ctx, at.pageIdx);
      const b = at.block;
      if (b.type !== "image" && b.type !== "montage" && b.type !== "video")
        refuse(`block ${a.blockId} is a ${b.type}, not a photo`);
      if (isPageOwning(b))
        refuse("full-page photos can't be re-laid out by the assistant yet");
      const w =
        a.width ?? floatDefault(a.align, (b as { width: number }).width);
      at.page.blocks[at.blockIdx] = { ...b, align: a.align, width: w } as Block;
      return `Set the photo to ${a.align} ${w}%. ${fillLine(ctx, at.pageIdx)}`;
    }
  }
}

/** Run one tool call. Invalid input or a refused edit leaves the issue untouched. */
export function executeTool(
  ctx: IssueContext,
  name: string,
  args: unknown,
): ToolResult {
  if (!(name in toolSchemas))
    return {
      ok: false,
      text: `Error: there is no tool "${name}".`,
      mutated: false,
    };
  const before = structuredClone(ctx.content);
  try {
    const text = apply(ctx, name as ToolName, args);
    const valid = issueContentSchema.safeParse(ctx.content);
    if (!valid.success) {
      ctx.content = before;
      return {
        ok: false,
        text: `Error: that edit would make the issue invalid (${valid.error.issues[0]?.message}); nothing changed.`,
        mutated: false,
      };
    }
    return { ok: true, text, mutated: name !== "read_page" };
  } catch (e) {
    ctx.content = before;
    if (e instanceof Refusal)
      return {
        ok: false,
        text: `Error: ${e.message}. Nothing changed.`,
        mutated: false,
      };
    if (e && typeof e === "object" && "issues" in e) {
      const issue = (
        e as { issues: { path: (string | number)[]; message: string }[] }
      ).issues[0];
      return {
        ok: false,
        text: `Error: invalid arguments for ${name}${issue ? ` — ${issue.path.join(".") || "input"}: ${issue.message}` : ""}. Nothing changed.`,
        mutated: false,
      };
    }
    return {
      ok: false,
      text: `Error: ${String(e)}. Nothing changed.`,
      mutated: false,
    };
  }
}
