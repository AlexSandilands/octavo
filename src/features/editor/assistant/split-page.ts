import { MAX_PAGES, type Block } from "@/lib/blocks";
import { createId } from "@/lib/id";
import { textColumn } from "@/lib/page-bands";
import { richDocBlocks, sliceRichDoc } from "@/lib/rich-text-split";
import { flowTextBlock, planFlow, planTextFlow } from "../text-flow";
import type { EditContext } from "./edit-tools";
import { editable, ownedByPhoto } from "./page-guards";
import { describeFill } from "./page-fill";
import { refuse } from "./refusal";

// split_page (#310): the editor's overflow fix, on the page the model names.

/**
 * The editor's overflow fix, run on the page the model names: the first block
 * past the text area is split between top-level nodes (`planTextFlow`, from
 * the measured layout) or, when it can't be, carried whole. Everything after it
 * goes with it, so the reading order holds; a heading left at the foot of the
 * page goes too.
 */
export async function splitPage(ctx: EditContext, pageIdx: number) {
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
  const columns = await splitColumn(ctx, pageIdx, cross);
  if (columns) return columns;
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

/**
 * A column block crossing the page (aboard #23) flows as the editor's own fix
 * does: left column, then the top of the right one, then fresh pages in
 * columns, with the rest of the page left where it is. Null when it can't be
 * split, so the caller carries the page's end instead.
 */
async function splitColumn(ctx: EditContext, pageIdx: number, cross: Block) {
  const page = ctx.pages[pageIdx]!;
  if (textColumn(cross) === null || cross.type !== "text") return null;
  if (richDocBlocks(cross.text).length < 2) return null;
  const metrics = await ctx.measure.textFlow(page.blocks, cross.id);
  const plan = metrics && planFlow(metrics, true);
  const next =
    plan &&
    flowTextBlock(ctx.pages, pageIdx, cross.id, plan.cuts, plan.landing);
  if (!plan || !next) return null;
  const added = next.length - ctx.pages.length;
  const into = plan.landing.right ? "the right column" : "";
  const onto = added
    ? `${added === 1 ? `a new page ${pageIdx + 2}` : `new pages ${pageIdx + 2}–${pageIdx + 1 + added}`}; later pages renumbered`
    : "";
  return {
    pages: next,
    text: `Flowed the column's text into ${[into, onto].filter(Boolean).join(", then onto ")}.`,
    report: next.slice(pageIdx, pageIdx + 1 + added).map((p) => p.id),
  };
}
