import type { ReactNode } from "react";
import type { Block, Page } from "@/lib/blocks";
import type { CoverElement } from "@/lib/cover-elements";
import { coverItems, itemAppearance, placementOf } from "@/lib/cover-order";
import type { CoverEntry } from "./cover-grid";

export function coverEntries(
  page: Page,
  renderBlock: (block: Block) => ReactNode,
  renderElement?: (element: CoverElement) => ReactNode,
): CoverEntry[] {
  return coverItems(page).map((item) => ({
    id: item.id,
    placement: placementOf(item, page),
    paint: itemAppearance(item, page),
    logoSize: item.type === "logo" ? item.size : undefined,
    // A photo's frame takes the photo's width, so its box hugs the picture.
    imageWidth: item.type === "image" ? (item.width ?? 100) : undefined,
    content: "placement" in item ? renderElement?.(item) : renderBlock(item),
  }));
}
