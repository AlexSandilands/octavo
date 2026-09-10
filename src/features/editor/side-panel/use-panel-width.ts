"use client";

import { useEffect, useState, type RefObject } from "react";

export const PANEL_MIN = 340;
/** Space kept for the page rail, the tool rail and a usable canvas. */
const CANVAS_RESERVE = 150 + 48 + 260;

// The side panel's width: half the editor row by default (the page and the
// panel share the space evenly), dragged or keyed within bounds that keep the
// canvas usable, and re-clamped whenever the window changes size.
export function usePanelWidth(row: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => setRowWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [row]);
  const max = Math.max(PANEL_MIN, rowWidth - CANVAS_RESERVE);
  const fallback = Math.round((rowWidth - 150 - 48) / 2);
  const clamp = (w: number) => Math.min(max, Math.max(PANEL_MIN, w));
  return {
    width: clamp(width ?? fallback),
    min: PANEL_MIN,
    max,
    setWidth: (w: number) => setWidth(clamp(w)),
  };
}
