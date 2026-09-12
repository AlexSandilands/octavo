import {
  arrayMove,
  verticalListSortingStrategy,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import type { Page } from "@/lib/blocks";
import { coverItems, placementOf } from "@/lib/cover-order";

/** Use normal list displacement within an anchor, and make room in both stacks when crossing anchors. */
export function coverSortingStrategy(
  page: Page,
  scale: number,
): SortingStrategy {
  const items = coverItems(page),
    placements = items.map((item) => placementOf(item, page));
  const anchor = (index: number) =>
    `${placements[index]?.row}:${placements[index]?.column}`;
  return (args) => {
    const { activeIndex, overIndex, index, rects } = args;
    if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex)
      return null;
    const source = anchor(activeIndex),
      target = anchor(overIndex),
      group = anchor(index);
    if (group !== source && group !== target) return null;
    const indices = items.map((_, i) => i).filter((i) => anchor(i) === group);
    if (
      source === target &&
      indices.every((i) => placements[i]?.offset === placements[index]?.offset)
    ) {
      return verticalListSortingStrategy({
        ...args,
        rects: indices.map((i) => rects[i]!),
        activeIndex: indices.indexOf(activeIndex),
        overIndex: indices.indexOf(overIndex),
        index: indices.indexOf(index),
      });
    }
    const current = rects[index];
    if (!current || index === activeIndex) return null;
    const oldRects = indices.flatMap((i) =>
      rects[i]
        ? [{ rect: rects[i]!, offset: (placements[i]?.offset ?? 0) * scale }]
        : [],
    );
    if (!oldRects.length) return null;
    const top = Math.min(
      ...oldRects.map(({ rect, offset }) => rect.top - offset),
    );
    const bottom = Math.max(
      ...oldRects.map(({ rect, offset }) => rect.bottom - offset),
    );
    const factor =
      placements[index]?.row === "top"
        ? 0
        : placements[index]?.row === "bottom"
          ? 1
          : 0.5;
    const next = arrayMove(
      items.map((_, i) => i),
      activeIndex,
      overIndex,
    ).filter((i) => (i === activeIndex ? target : anchor(i)) === group);
    if (next.some((i) => !rects[i])) return null;
    const height =
      next.reduce((sum, i) => sum + rects[i]!.height, 0) +
      Math.max(0, next.length - 1) * 22 * scale;
    let y = top + (bottom - top) * factor - height * factor;
    for (const i of next) {
      if (i === index)
        return {
          x: 0,
          y: y + (placements[i]?.offset ?? 0) * scale - current.top,
          scaleX: 1,
          scaleY: 1,
        };
      y += rects[i]!.height + 22 * scale;
    }
    return null;
  };
}
