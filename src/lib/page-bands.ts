import type { Block } from "./blocks";

// Two-column text (content v12, aboard #23). A run of consecutive column blocks
// forms a *band*: its Left blocks stack down the left column and its Right
// blocks down the right, each in document order; any other block ends the band
// and spans the page. A column block is a text block with a `column`, or a
// left/right picture beside one — a picture with no column text in its run
// keeps today's float-and-wrap, so no earlier issue changes. Interior pages
// only: callers leave covers alone. Shared by every renderer, the editor's
// moves and measurement, the assistant and the PDF import.

export type Column = "left" | "right";
export type TextPlacement = Column | "full";

export type PageSegment =
  | { kind: "block"; block: Block }
  | { kind: "band"; id: string; left: Block[]; right: Block[] };

/** A text block's column, or null when it spans the page. */
export function textColumn(block: Block): Column | null {
  return block.type === "text" ? (block.column ?? null) : null;
}

/** The column a block would take in a band (column text, or a side picture). */
function sideOf(block: Block): Column | null {
  if (block.type === "text") return block.column ?? null;
  if (
    (block.type === "image" ||
      block.type === "montage" ||
      block.type === "video") &&
    (block.align === "left" || block.align === "right")
  )
    return block.align;
  return null;
}

/** The page's blocks as full-width blocks and two-column bands, in order. */
export function pageSegments(blocks: Block[]): PageSegment[] {
  const out: PageSegment[] = [];
  let i = 0;
  while (i < blocks.length) {
    let j = i;
    while (j < blocks.length && sideOf(blocks[j]!)) j++;
    const run = blocks.slice(i, j);
    if (run.some((b) => textColumn(b))) {
      out.push({
        kind: "band",
        id: run[0]!.id,
        left: run.filter((b) => sideOf(b) === "left"),
        right: run.filter((b) => sideOf(b) === "right"),
      });
      i = j;
    } else {
      out.push({ kind: "block", block: blocks[i]! });
      i++;
    }
  }
  return out;
}

/** The column a block sits in on this page, or null outside a band. */
export function bandColumnOf(blocks: Block[], id: string): Column | null {
  for (const s of pageSegments(blocks)) {
    if (s.kind !== "band") continue;
    if (s.left.some((b) => b.id === id)) return "left";
    if (s.right.some((b) => b.id === id)) return "right";
  }
  return null;
}

/** The band holding `id`, or undefined outside one. */
export function bandOf(
  blocks: Block[],
  id: string,
): Extract<PageSegment, { kind: "band" }> | undefined {
  return pageSegments(blocks).find(
    (s): s is Extract<PageSegment, { kind: "band" }> =>
      s.kind === "band" && [...s.left, ...s.right].some((b) => b.id === id),
  );
}

/** Reading order: each band's left column, then its right (the phone reader). */
export function readingOrder(blocks: Block[]): Block[] {
  return pageSegments(blocks).flatMap((s) =>
    s.kind === "band" ? [...s.left, ...s.right] : [s.block],
  );
}

/** Whether any band sits on the page. */
export function hasBands(blocks: Block[]): boolean {
  return blocks.some((b) => textColumn(b) !== null);
}
