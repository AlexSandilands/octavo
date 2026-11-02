import type { Block, Page } from "@/lib/blocks";
import { arrayMove } from "@dnd-kit/sortable";
import {
  bandColumnOf,
  bandOf,
  bandSide,
  readingOrder,
  type PageSegment,
} from "@/lib/page-bands";

type Band = Extract<PageSegment, { kind: "band" }>;
import { pageFillsCanvas } from "@/features/blocks/layout";

/** A page a moved block may leave or land on: covers order their own grid, and a full-page photo owns its page. */
export function acceptsMovedBlock(page: Page | undefined): page is Page {
  return Boolean(page && !page.cover && !pageFillsCanvas(page));
}

/** Null when the move can't be made, so the caller leaves state and history alone. */
export function moveBlockAcrossPages(
  pages: Page[],
  from: number,
  blockId: string,
  to: number,
  at: "start" | "end",
): Page[] | null {
  const source = pages[from];
  const target = pages[to];
  if (from === to || !acceptsMovedBlock(source) || !acceptsMovedBlock(target))
    return null;
  const block = source.blocks.find((b) => b.id === blockId);
  if (!block) return null;
  return pages.map((p, i) =>
    i === from
      ? { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) }
      : i === to
        ? {
            ...p,
            blocks: at === "end" ? [...p.blocks, block] : [block, ...p.blocks],
          }
        : p,
  );
}

/**
 * One step up or down within a page (aboard #23). In a two-column band a block
 * steps within its own column; off a column's end it steps over the block
 * beyond the band. Elsewhere it swaps with its neighbour. "across" means it is
 * at the page's edge and leaves for the page beside.
 */
export function stepBlock(
  blocks: Block[],
  id: string,
  dir: -1 | 1,
): Block[] | "across" | null {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return null;
  const band = bandOf(blocks, id);
  if (!band) {
    const next = blocks[i + dir];
    if (!next) return "across";
    // A full-width block steps over a whole band rather than splitting it.
    const over = bandOf(blocks, next.id);
    return over
      ? stepOver(blocks, i, edge(blocks, over, dir), dir)
      : swap(blocks, i, i + dir);
  }
  const column = band.left.some((b) => b.id === id) ? band.left : band.right;
  const neighbour = column[column.findIndex((b) => b.id === id) + dir];
  if (neighbour) return swap(blocks, i, blocks.indexOf(neighbour));
  const beyond = blocks[edge(blocks, band, dir) + dir];
  if (!beyond) return "across";
  return stepOver(blocks, i, blocks.indexOf(beyond), dir);
}

/** The band's first (dir -1) or last (dir 1) index in the page's blocks. */
function edge(blocks: Block[], band: Band, dir: -1 | 1): number {
  const at = [...band.left, ...band.right].map((b) => blocks.indexOf(b));
  return dir < 0 ? Math.min(...at) : Math.max(...at);
}

/** Move block `i` to the far side of block `k`. */
function stepOver(blocks: Block[], i: number, k: number, dir: -1 | 1) {
  const beyond = blocks[k]!;
  const rest = blocks.filter((_, n) => n !== i);
  const at = rest.indexOf(beyond) + (dir < 0 ? 0 : 1);
  return [...rest.slice(0, at), blocks[i]!, ...rest.slice(at)];
}

function swap(blocks: Block[], i: number, j: number): Block[] {
  const arr = [...blocks];
  [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  return arr;
}

/**
 * A drag that drops a column block onto a block of a band takes that block's
 * column, so dragging across the gutter switches side (aboard #23).
 */
export function dropInColumn(blocks: Block[], id: string, overId: string) {
  const column = bandColumnOf(blocks, overId);
  if (!column) return blocks;
  return blocks.map((b) =>
    b.id !== id || !bandSide(b)
      ? b
      : b.type === "text"
        ? { ...b, column }
        : ({ ...b, align: column } as Block),
  );
}

/**
 * A drag's drop, in reading order: a band's left column, then its right — the
 * order the sortable list (and so the keyboard) walks. Reading order lays a
 * page out exactly as its stored order does, so it can be stored as is.
 */
export function dragBlocks(blocks: Block[], id: string, overId: string) {
  const order = readingOrder(blocks);
  const from = order.findIndex((b) => b.id === id);
  const to = order.findIndex((b) => b.id === overId);
  if (from < 0 || to < 0 || from === to) return null;
  return dropInColumn(arrayMove(order, from, to), id, overId);
}
