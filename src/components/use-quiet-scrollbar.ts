import { useEffect, type RefObject } from "react";

// Pairs with the `.scrollbar-soft-quiet` class: marks the scroll region with
// `data-scrolling` for a moment after each scroll, so its hidden-at-rest
// scrollbar shows while the content is moving.
export function useQuietScrollbar(
  ref: RefObject<HTMLElement | null>,
  holdMs = 1000,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      el.dataset.scrolling = "";
      clearTimeout(timer);
      timer = setTimeout(() => delete el.dataset.scrolling, holdMs);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
    };
  }, [ref, holdMs]);
}
