import { useCallback, useLayoutEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { coverDragTransform } from "./cover-drag";

/** Move the whole cover frame, including its panel, rather than just the words inside it. */
export function useCoverSortable(id: string, cover: boolean, disabled = false) {
  const sortable = useSortable({
    id,
    disabled: { draggable: disabled, droppable: disabled },
  });
  const nodeRef = useRef<HTMLElement | null>(null);
  const setSortableNode = sortable.setNodeRef;
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      if (nodeRef.current && cover) {
        nodeRef.current.style.transform = "";
        nodeRef.current.style.transition = "";
      }
      const frame = cover
        ? (node?.closest<HTMLElement>("[data-cover-entry]") ?? node)
        : node;
      nodeRef.current = frame;
      setSortableNode(frame);
    },
    [cover, setSortableNode],
  );
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!cover || !node) return;
    node.style.transform = coverDragTransform(sortable.transform) ?? "";
    node.style.transition = sortable.transition ?? "";
    node.style.zIndex = sortable.isDragging ? "30" : "";
  }, [cover, sortable.transform, sortable.transition, sortable.isDragging]);
  return { ...sortable, setNodeRef };
}
