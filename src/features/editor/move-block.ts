import type { Page } from "@/lib/blocks";
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
