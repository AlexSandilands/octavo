"use client";

import { useState, type ReactNode, type RefObject } from "react";
import {
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Page } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import {
  PAGE_DROP_ID,
  dragPointer,
  isPdfDrag,
  snapGhostToPointer,
  type DropTarget,
} from "./pdf-import/drag-out";
import type { ReviewItem } from "./pdf-import/model";
import { RegionGhost } from "./pdf-import/region-ghost";

/** The panel's Add, aimed at a place on a page: set by the panel, called by the editor. */
export type DropHandler = (item: ReviewItem, target: DropTarget) => void;

// The editor's side of dragging a region out of the PDF panel: what is in hand,
// the index on the current page it would take (shown in place as a preview),
// and the drop — which the panel runs through its ordinary Add, so fitting,
// uploads, undo and the "Added" marks behave as if the bar's button were pressed.
export function usePdfDragOut({
  page,
  curPage,
  images,
  previewable,
  drop,
}: {
  page: Page | undefined;
  curPage: number;
  images: ImageMap;
  /** A cover or a page-owning photo sends the block to a new page: no in-place preview. */
  previewable: boolean;
  drop: RefObject<DropHandler | null>;
}) {
  const [held, setHeld] = useState<{
    item: ReviewItem;
    imageUrl: string | null;
  } | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const clear = () => {
    if (held?.imageUrl) URL.revokeObjectURL(held.imageUrl);
    setHeld(null);
    setIndex(null);
  };
  const onDragStart = (e: DragStartEvent) => {
    if (!isPdfDrag(e.active.id)) return;
    const item = (e.active.data.current as { item?: ReviewItem } | undefined)
      ?.item;
    if (!item) return;
    const blob = item.region.image?.blob;
    setHeld({ item, imageUrl: blob ? URL.createObjectURL(blob) : null });
  };
  const onDragMove = (e: DragMoveEvent) => {
    if (!held || !page) return;
    const pointer = dragPointer(e);
    if (!e.over || !pointer) return setIndex(null);
    if (e.over.id === PAGE_DROP_ID) return setIndex(page.blocks.length);
    const at = page.blocks.findIndex((b) => b.id === e.over?.id);
    if (at < 0) return setIndex(null);
    const { top, height } = e.over.rect;
    setIndex(pointer.y > top + height / 2 ? at + 1 : at);
  };
  /** True when the event was a region's: handled here, not the block sort. */
  const onDragEnd = (e: DragEndEvent) => {
    if (!isPdfDrag(e.active.id)) return false;
    if (held && index !== null)
      drop.current?.(held.item, { page: curPage, position: index });
    clear();
    return true;
  };

  const image = held?.item.region.image;
  const preview =
    held && index !== null && previewable
      ? {
          index,
          block: held.item.block,
          images:
            held.imageUrl && image
              ? {
                  ...images,
                  [held.item.block.type === "image"
                    ? (held.item.block.imageId ?? held.item.id)
                    : held.item.id]: {
                    url: held.imageUrl,
                    width: image.width,
                    height: image.height,
                  },
                }
              : images,
        }
      : null;

  return {
    held,
    /** Over the page (whatever the page): the drop has somewhere to land. */
    over: index !== null,
    preview,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel: clear,
  };
}

// The ghost under the pointer while a region is in hand, in dnd-kit's overlay
// (a portal, so it rides above both stages). Quiet once the page previews the
// block; a cover or page-owning photo says where the block will go instead.
export function DragOutGhost({
  dragOut,
  page,
  curPage,
  filled,
}: {
  dragOut: ReturnType<typeof usePdfDragOut>;
  page: Page | undefined;
  curPage: number;
  filled: boolean;
}) {
  return (
    <DragOverlay
      dropAnimation={null}
      modifiers={[snapGhostToPointer]}
      style={{ width: "auto", height: "auto" }}
    >
      {dragOut.held && (
        <RegionGhost
          item={dragOut.held.item}
          imageUrl={dragOut.held.imageUrl}
          placed={Boolean(dragOut.preview)}
          note={
            dragOut.over && (page?.cover || filled)
              ? `Lands on a new page after page ${curPage + 1}`
              : undefined
          }
        />
      )}
    </DragOverlay>
  );
}

// The page's own droppable, wrapping the scaled page: the region's collision
// detection answers only while the pointer is inside it. Also the node the
// pan/zoom engine translates, hence the second ref.
export function PageDropZone({
  panRef,
  className,
  children,
}: {
  panRef: RefObject<HTMLDivElement | null>;
  className: string;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: PAGE_DROP_ID });
  return (
    <div
      ref={(el) => {
        panRef.current = el;
        setNodeRef(el);
      }}
      className={className}
    >
      {children}
    </div>
  );
}
