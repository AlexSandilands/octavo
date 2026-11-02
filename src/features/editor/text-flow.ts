import { MAX_PAGES, type Block, type Page } from "@/lib/blocks";
import { bandOf, textColumn, type Column } from "@/lib/page-bands";
import { richDocBlocks, sliceRichDoc } from "@/lib/rich-text-split";
import { createId } from "@/lib/id";

// The edits that resolve an overflowing page (issue #93), kept pure and separate
// from the measurement that feeds them. Two shapes, one landing rule:
//
//   - body text is *split* — `planTextFlow` turns measured node offsets into cut
//     points and `flowTextBlock` applies them, cascading over as many pages as
//     the remainder needs;
//   - everything else (an image, a heading, a sponsor panel) *moves whole* via
//     `moveBlockToNextPage`, since there is nothing sensible to cut.
//
// The design stance the whole magazine rests on is that content never reflows at
// read time — so this happens once, in the editor, with the author watching, and
// its output is ordinary fixed blocks on ordinary pages. Nothing downstream
// (reader, mobile reader, PDF) learns anything new.

/** What the editor measured about one overflowing text block, in canvas px. */
export type TextFlowMetrics = {
  /** Each top-level node's top and bottom edge, in one shared coordinate space. */
  nodes: { top: number; bottom: number }[];
  /** Height the block may occupy on the page it sits on now. */
  firstAvail: number;
  /** Height a continuation block may occupy alone on a fresh page. */
  restAvail: number;
  /**
   * A left-column block (aboard #23): the room a continuation would have at the
   * top of its band's right column, pushing what is there down.
   */
  rightAvail?: number;
};

/** Where a split's continuations land (aboard #23). */
export type FlowLanding = {
  /** The first continuation tops the band's right column on the same page. */
  right: boolean;
  /** Continuations on fresh pages pair up as a left and a right column. */
  columns: boolean;
};

export type FlowPlan = { cuts: number[]; landing: FlowLanding };

// Body text carries bottom margins but no top margin, so a run of nodes laid out
// from a container's top edge spans exactly `bottom(last) - top(first)`.
function spanOf(
  nodes: TextFlowMetrics["nodes"],
  first: number,
  last: number,
): number {
  return nodes[last]!.bottom - nodes[first]!.top;
}

/**
 * Where to cut the node list so every chunk fits its page: greedily keep the
 * last top-level node (paragraph, list) that still fits, then start the next
 * chunk. A single node taller than a whole page is placed alone and left
 * overflowing — v1 never splits inside a paragraph.
 *
 * Returns the node index each chunk after the first starts at, so `[]` means the
 * block already fits and there is nothing to flow.
 */
export function planTextFlow(metrics: TextFlowMetrics): number[] {
  return planFlow(metrics, false).cuts;
}

/**
 * `planTextFlow` with the landing a column block's continuations take: a left
 * column block's first continuation tops the right column when its first node
 * fits there, and a column block continues in columns on fresh pages.
 */
export function planFlow(
  { nodes, firstAvail, restAvail, rightAvail }: TextFlowMetrics,
  columns: boolean,
): FlowPlan {
  const cuts: number[] = [];
  let right = false;
  let start = 0;
  let avail = firstAvail;
  while (start < nodes.length) {
    // A chunk always keeps at least one node, so an oversized one can't stall
    // the loop forever.
    let last = start;
    while (last + 1 < nodes.length && spanOf(nodes, start, last + 1) <= avail) {
      last++;
    }
    if (last + 1 >= nodes.length) break;
    start = last + 1;
    cuts.push(start);
    avail = restAvail;
    if (cuts.length === 1 && rightAvail !== undefined) {
      right = spanOf(nodes, start, start) <= rightAvail;
      if (right) avail = rightAvail;
    }
  }
  return { cuts, landing: { right, columns } };
}

/**
 * Shrink `blockId` to its first chunk and carry the rest onto the pages that
 * follow, creating them as needed. One new state value, so the whole edit —
 * block shrink, continuation blocks, new pages — autosaves as one document.
 * A column block's continuations follow `landing` (aboard #23).
 *
 * Returns null when there is nothing to do, so the caller leaves state untouched.
 */
export function flowTextBlock(
  pages: Page[],
  pageIndex: number,
  blockId: string,
  cuts: number[],
  landing: FlowLanding = { right: false, columns: false },
): Page[] | null {
  const source = pages[pageIndex];
  if (!source || source.cover) return null;
  const at = source.blocks.findIndex((b) => b.id === blockId);
  const block = source.blocks[at];
  if (!block || block.type !== "text") return null;

  // Worst case every chunk needs a page of its own; keep the document inside the
  // bound the content schema enforces. Dropped cuts simply stay in the last
  // continuation block, which flags itself as overflowing for another pass.
  const plan = cuts.slice(0, Math.max(0, MAX_PAGES - pages.length));
  if (plan.length === 0) return null;

  const nodes = richDocBlocks(block.text);
  const bounds = [0, ...plan, nodes.length];
  // Same styling as the block it came from — only the body and the id differ.
  const chunk = (c: number, column?: Column): Block => ({
    ...block,
    id: createId(),
    text: sliceRichDoc(nodes, bounds[c]!, bounds[c + 1]!),
    column,
  });

  const shrunk = source.blocks.map((b, i) =>
    i === at ? { ...block, text: sliceRichDoc(nodes, 0, plan[0]!) } : b,
  );
  const right = landing.right && textColumn(block) === "left";
  const next = [...pages];
  next[pageIndex] = {
    ...source,
    blocks: right ? topOfRight(shrunk, blockId, chunk(1, "right")) : shrunk,
  };

  let target = pageIndex;
  let side: Column = "left";
  for (let c = right ? 2 : 1; c < bounds.length - 1; c++) {
    if (!landing.columns) {
      land(next, ++target, chunk(c, textColumn(block) ?? undefined));
    } else if (side === "left") {
      land(next, ++target, chunk(c, "left"));
      side = "right";
    } else {
      next[target] = {
        ...next[target]!,
        blocks: [...next[target]!.blocks, chunk(c, "right")],
      };
      side = "left";
    }
  }
  return next;
}

/** Put `block` at the top of the right column of the band holding `id`. */
function topOfRight(blocks: Block[], id: string, block: Block): Block[] {
  const first = bandOf(blocks, id)?.right[0];
  const at = first
    ? blocks.findIndex((b) => b.id === first.id)
    : blocks.findIndex((b) => b.id === id) + 1;
  return [...blocks.slice(0, at), block, ...blocks.slice(at)];
}

/**
 * Move a whole block onto the page after its own — the fix for the blocks that
 * can't be cut (an image, a heading, a sponsor panel, a lone paragraph).
 *
 * Only the crossing block moves. Anything above it on the page is what made it
 * cross and stays put; anything below it moves up into the space it leaves, and
 * if that leaves the page still overflowing the next offender flags itself for
 * another pass.
 *
 * Returns null when there is nothing to do or no room to do it in.
 */
export function moveBlockToNextPage(
  pages: Page[],
  pageIndex: number,
  blockId: string,
): Page[] | null {
  const source = pages[pageIndex];
  if (!source || source.cover) return null;
  const at = source.blocks.findIndex((b) => b.id === blockId);
  const block = source.blocks[at];
  if (!block) return null;

  const target = pageIndex + 1;
  // Landing on an occupied page means inserting one, which the schema bounds.
  if (!isEmptyLanding(pages[target]) && pages.length >= MAX_PAGES) return null;

  const next = [...pages];
  next[pageIndex] = {
    ...source,
    blocks: source.blocks.filter((_, i) => i !== at),
  };
  land(next, target, block);
  return next;
}

/** An existing page a block may be dropped onto without displacing anything. */
function isEmptyLanding(page: Page | undefined): boolean {
  return Boolean(page && !page.cover && page.blocks.length === 0);
}

/**
 * Put `block` on the page at `index`, reusing that page only when it is empty
 * and not a cover — anything already laid out there would be pushed off its own
 * page by the arrival — and otherwise inserting a fresh page in its place.
 * Mutates the caller's own copy of the page list.
 */
function land(pages: Page[], index: number, block: Block): void {
  const existing = pages[index];
  if (isEmptyLanding(existing)) {
    pages[index] = { ...existing!, blocks: [block] };
  } else {
    pages.splice(index, 0, { id: createId(), blocks: [block] });
  }
}
