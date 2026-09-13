import type { Block, BlockPatch } from "@/lib/blocks";

// Typing folds within one field. Montage list changes need their own step;
// captions and descriptions fold only within the image being edited.
export function blockEditHistoryGroup(block: Block, patch: BlockPatch) {
  const fields = Object.keys(patch).sort();
  if (block.type !== "montage" || !("items" in patch) || !patch.items) {
    return `${block.id}:${fields.join(",")}`;
  }
  const next = patch.items;
  if (fields.length !== 1 || next.length !== block.items.length) return;
  let group: string | undefined;
  for (let i = 0; i < next.length; i++) {
    const before = block.items[i]!;
    const after = next[i]!;
    if (before.imageId !== after.imageId) return;
    const changed = (["alt", "caption"] as const).filter(
      (field) => before[field] !== after[field],
    );
    if (changed.length > 1 || (changed.length > 0 && group)) return;
    if (changed.length === 1) group = `${block.id}:items:${i}:${changed[0]}`;
  }
  return group;
}
