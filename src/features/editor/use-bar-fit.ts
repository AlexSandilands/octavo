"use client";

import { useLayoutEffect, useRef } from "react";

/** Screen px kept clear between a bar and the canvas edge. */
const EDGE = 8;

/**
 * Keeps a selected block's tool bar inside the canvas, so its last controls
 * (Alt, Ask) are always in reach: a bar that would run past the canvas's right
 * edge slides left, and one wider than the whole canvas wraps onto a second
 * row. Bars keep one screen size at every zoom (a transform ResizeObserver
 * doesn't see), so this measures on every render as well as on resize, and
 * writes the two styles itself rather than round-trip through state.
 */
export function useBarFit<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    const block = bar?.closest<HTMLElement>("[data-editor-block]");
    const stage = bar?.closest<HTMLElement>("[data-editor-canvas-stage]");
    if (!bar || !block || !stage) return;
    const fit = () => {
      bar.style.translate = "";
      bar.style.maxWidth = "";
      const room = stage.getBoundingClientRect();
      let own = bar.getBoundingClientRect();
      const avail = room.width - 2 * EDGE;
      if (own.width > avail) {
        bar.style.maxWidth = `${avail / (own.width / bar.offsetWidth)}px`;
        own = bar.getBoundingClientRect();
      }
      const over = own.right - (room.right - EDGE);
      const shift = Math.min(over, own.left - (room.left + EDGE));
      if (shift <= 0) return;
      // `translate` sits outside the bar's own scale: page px, not screen px.
      const page = block.getBoundingClientRect().width / block.offsetWidth;
      bar.style.translate = `${-shift / (page || 1)}px 0`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  });
  return ref;
}
