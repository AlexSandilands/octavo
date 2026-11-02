import { rebaseTextSize, type TextSize } from "@/lib/blocks";
import type { ReviewItem } from "./model";

// Kept apart from synthesis.ts so the editor's drag-out preview can use it
// without pulling the import pipeline into the main bundle.

/** The item as it will be added: a text block's detected size re-based on the
 *  magazine's default, so a drop preview matches what lands. Others unchanged. */
export function rebaseItem(
  item: ReviewItem,
  defaultTextSize: TextSize = "m",
): ReviewItem {
  return item.block.type === "text" && defaultTextSize !== "m"
    ? {
        ...item,
        block: {
          ...item.block,
          size: rebaseTextSize(item.block.size, defaultTextSize),
        },
      }
    : item;
}
