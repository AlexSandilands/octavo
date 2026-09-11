"use client";

import {
  PointerSensor,
  closestCenter,
  type CollisionDetection,
  type DragMoveEvent,
  type Modifier,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";

// Dragging a region out of the PDF panel onto the magazine page. One DndContext
// wraps the whole editor row, so the page's own block sorting and this share
// its sensors and collision detection; everything here tells the two apart.

const PREFIX = "pdf-region:";
export const pdfDragId = (regionId: string) => `${PREFIX}${regionId}`;
export const isPdfDrag = (id: UniqueIdentifier) =>
  String(id).startsWith(PREFIX);
/** The droppable that stands for the page itself: its blank end, or all of an empty one. */
export const PAGE_DROP_ID = "magazine-page";

/** Where a dropped region lands: a page, and the block index it takes there. */
export type DropTarget = { page: number; position: number };

const base = PointerSensor.activators[0]!;
type Args = Parameters<typeof base.handler>;
const onRegion = (args: Args) =>
  Boolean((args[0].target as Element | null)?.closest?.("[data-region]"));

// Magazine blocks lift after a short travel, as they always have. A region
// lifts only after a short hold, so a quick drag across one still pans the
// PDF stage (see `panOverBlocks`); the hold is what says "pick this up".
export class BlockPointerSensor extends PointerSensor {
  static activators: typeof PointerSensor.activators = [
    {
      eventName: "onPointerDown",
      handler: (...args: Args) => !onRegion(args) && base.handler(...args),
    },
  ];
}
export class RegionPointerSensor extends PointerSensor {
  static activators: typeof PointerSensor.activators = [
    {
      eventName: "onPointerDown",
      handler: (...args: Args) => onRegion(args) && base.handler(...args),
    },
  ];
}

/** The pointer's place on screen during a drag: where it went down, plus the travel. */
export function dragPointer(event: DragMoveEvent) {
  const start = event.activatorEvent
    ? getEventCoordinates(event.activatorEvent)
    : null;
  return start
    ? { x: start.x + event.delta.x, y: start.y + event.delta.y }
    : null;
}

// For a region: the block whose middle is nearest the pointer, or the page
// itself, and nothing while the pointer is off the page. Blocks keep their
// closest-centre sorting.
export const dragOutCollision: CollisionDetection = (args) => {
  if (!isPdfDrag(args.active.id)) return closestCenter(args);
  const { pointerCoordinates: p, droppableRects, droppableContainers } = args;
  const page = droppableRects.get(PAGE_DROP_ID);
  if (
    !p ||
    !page ||
    p.x < page.left ||
    p.x > page.right ||
    p.y < page.top ||
    p.y > page.bottom
  )
    return [];
  let best: { id: UniqueIdentifier; distance: number } | null = null;
  for (const container of droppableContainers) {
    if (container.id === PAGE_DROP_ID) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const distance = Math.abs(rect.top + rect.height / 2 - p.y);
    if (!best || distance < best.distance)
      best = { id: container.id, distance };
  }
  return [{ id: best?.id ?? PAGE_DROP_ID }];
};

// The ghost rides centred under the pointer, not where the region's box was.
export const snapGhostToPointer: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (!draggingNodeRect || !activatorEvent) return transform;
  const start = getEventCoordinates(activatorEvent);
  if (!start) return transform;
  return {
    ...transform,
    x:
      transform.x +
      start.x -
      draggingNodeRect.left -
      draggingNodeRect.width / 2,
    y:
      transform.y +
      start.y -
      draggingNodeRect.top -
      draggingNodeRect.height / 2,
  };
};
