import { MAX_PAGES, type Block, type Page } from "@/lib/blocks";
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
};

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
export function planTextFlow({
  nodes,
  firstAvail,
  restAvail,
}: TextFlowMetrics): number[] {
  const cuts: number[] = [];
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
    cuts.push(last + 1);
    start = last + 1;
    avail = restAvail;
  }
  return cuts;
}

/**
 * Shrink `blockId` to its first chunk and carry the rest onto the pages that
 * follow, creating them as needed. One new state value, so the whole edit —
 * block shrink, continuation blocks, new pages — autosaves as one document.
 *
 * Returns null when there is nothing to do, so the caller leaves state untouched.
 */
export function flowTextBlock(
  pages: Page[],
  pageIndex: number,
  blockId: string,
  cuts: number[],
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

  const next = [...pages];
  next[pageIndex] = {
    ...source,
    blocks: source.blocks.map((b, i) =>
      i === at ? { ...block, text: sliceRichDoc(nodes, 0, plan[0]!) } : b,
    ),
  };

  for (let chunk = 1; chunk < bounds.length - 1; chunk++) {
    // Same styling as the block it came from — only the body and the id differ.
    const continuation: Block = {
      ...block,
      id: createId(),
      text: sliceRichDoc(nodes, bounds[chunk]!, bounds[chunk + 1]!),
    };
    land(next, pageIndex + chunk, continuation);
  }
  return next;
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
