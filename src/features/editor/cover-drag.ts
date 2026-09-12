import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";

/** Centre-based navigation works for a tall masthead beside a short text block. */
export const coverKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context },
) => {
  const { collisionRect, droppableRects, droppableContainers, over, active } =
    context;
  if (
    !collisionRect ||
    !active ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)
  )
    return;
  event.preventDefault();
  const origin = droppableRects.get(over?.id ?? active.id) ?? collisionRect;
  const x = origin.left + origin.width / 2,
    y = origin.top + origin.height / 2;
  const candidates = droppableContainers
    .getEnabled()
    .flatMap((item) => {
      const r = droppableRects.get(item.id);
      if (!r || item.id === (over?.id ?? active.id)) return [];
      const dx = r.left + r.width / 2 - x,
        dy = r.top + r.height / 2 - y;
      const matches =
        event.code === "ArrowDown"
          ? dy > 1
          : event.code === "ArrowUp"
            ? dy < -1
            : event.code === "ArrowRight"
              ? dx > 1
              : dx < -1;
      return matches ? [{ rect: r, distance: dx * dx + dy * dy }] : [];
    })
    .sort((a, b) => a.distance - b.distance);
  const target = candidates[0]?.rect;
  return target
    ? {
        x: target.left + (target.width - collisionRect.width) / 2,
        y: target.top + (target.height - collisionRect.height) / 2,
      }
    : undefined;
};

/** A handle can sit outside its item; point at the intended drop target. */
export const coverCollisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (item) => item.id !== args.active.id,
    ),
  });
  return hits.length ? hits : closestCenter(args);
};
export function coverDragTransform(transform: { x: number; y: number } | null) {
  return transform
    ? `translate3d(calc(${transform.x}px / var(--page-scale, 1)), calc(${transform.y}px / var(--page-scale, 1)), 0)`
    : undefined;
}
