"use client";

import { useLayoutEffect, useRef } from "react";

/** Screen px kept clear between a bar and the canvas edge. */
const EDGE = 8;

/**
 * Keeps a selected block's tool bar (or the Ask box under it) inside the
 * canvas and clear of the canvas's standing tools and a cover's inspector, so
 * its last controls (Alt, Ask, Send) are always in reach: one that would run
 * past either side slides back in, and one wider than the room wraps onto a
 * second row. Bars keep one screen size at every zoom (a transform
 * ResizeObserver doesn't see), so this measures on every render as well as on
 * resize, and writes the two styles itself rather than round-trip through
 * state. `active: false` stands it down for a bar another hook places (a
 * cover's, `useCoverToolbarBounds`).
 */
export function useBarFit<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const bar = ref.current;
    const parent = bar?.parentElement;
    const stage = bar?.closest<HTMLElement>("[data-editor-canvas-stage]");
    if (!bar || !parent || !stage) return;
    const fit = () => {
      bar.style.translate = "";
      bar.style.maxWidth = "";
      const room = stage.getBoundingClientRect();
      let [lo, hi] = [room.left + EDGE, room.right - EDGE];
      // The canvas's tools, standing on end at a narrow canvas's edge.
      const tools = stage.parentElement
        ?.querySelector(
          '[data-bar-placement="left"], [data-bar-placement="right"]',
        )
        ?.getBoundingClientRect();
      if (tools?.width && tools.left < room.left + room.width / 2)
        lo = Math.max(lo, tools.right + EDGE);
      else if (tools?.width) hi = Math.min(hi, tools.left - EDGE);
      // A cover's inspector floats over the canvas: keep to its roomier side.
      const panel = stage
        .querySelector("[data-cover-inspector]")
        ?.getBoundingClientRect();
      if (panel?.width && panel.right > lo && panel.left < hi) {
        if (panel.left - lo >= hi - panel.right)
          hi = Math.max(lo, panel.left - EDGE);
        else lo = Math.min(hi, panel.right + EDGE);
      }
      let own = bar.getBoundingClientRect();
      const avail = hi - lo;
      if (own.width > avail) {
        bar.style.maxWidth = `${avail / (own.width / bar.offsetWidth)}px`;
        own = bar.getBoundingClientRect();
      }
      const shift =
        own.right > hi
          ? -Math.min(own.right - hi, Math.max(0, own.left - lo))
          : own.left < lo
            ? Math.min(lo - own.left, Math.max(0, hi - own.right))
            : 0;
      if (!shift) return;
      // `translate` sits outside the element's own scale: its parent's px.
      const scale = parent.getBoundingClientRect().width / parent.offsetWidth;
      bar.style.translate = `${shift / (scale || 1)}px 0`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  });
  return ref;
}
