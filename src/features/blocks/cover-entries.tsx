import type { ReactNode } from "react";
import type { Block, Page } from "@/lib/blocks";
import type { CoverElement } from "@/lib/cover-elements";
import { coverItems, placementOf } from "@/lib/cover-order";
import type { CoverEntry } from "./cover-grid";

export function coverEntries(
  page: Page,
  renderBlock: (block: Block) => ReactNode,
  renderElement?: (element: CoverElement) => ReactNode,
): CoverEntry[] {
  return coverItems(page).map((item) => ({
    id: item.id,
    placement: placementOf(item, page),
    logoSize: item.type === "logo" ? item.size : undefined,
    content: "placement" in item ? renderElement?.(item) : renderBlock(item),
  }));
}
