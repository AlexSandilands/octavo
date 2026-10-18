import type { Page } from "@/lib/blocks";
import { pageFillsCanvas } from "@/features/blocks/layout";

// Moving a block between existing pages (issue #406): the arrows crossing a
// page edge and the "Move to page…" menu. Unlike the overflow fix in
// text-flow.ts, nothing is inserted or deleted — the block lands on the page as
// it stands and the overflow marker says if it doesn't fit there.
//
// Covers and page-owning photos take no part, either way: a cover orders its
// items on its own grid, and a full-page photo moves with the page it owns.

/** A page a moved block may leave or land on. */
export function acceptsMovedBlock(page: Page | undefined): page is Page {
  return Boolean(page && !page.cover && !pageFillsCanvas(page));
}

/**
 * Move `blockId` from `pages[from]` to the start or end of `pages[to]`. Null
 * when the move can't be made, so the caller leaves state and history alone.
 */
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
