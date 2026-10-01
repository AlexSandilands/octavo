"use client";

import { useEffect, useState, type RefObject } from "react";
import type { SurfaceKind } from "./surfaces";

export const PANEL_MIN = 340;
/** Space kept for the page rail and a usable canvas. */
const PAGE_RAIL = 150;
const CANVAS_RESERVE = PAGE_RAIL + 260;
/** A chat reads best narrow; on a narrow row it opens at its minimum, so the
 *  canvas beside it keeps as much of the page as it can (#309). */
const ASSISTANT = { min: 300, preferred: 400, canvasFloor: 520 };

/** What the panel is showing: a surface, or the choice of one. */
export type PanelContent = SurfaceKind | "none";

// The side panel's width: by default half the editor row for Import PDF (the
// page and the panel share the space evenly) and a column for the assistant
// (the empty choice takes the same column), dragged or keyed within bounds
// that keep the canvas usable, and re-clamped whenever the window changes
// size. Each kind remembers its own width, so switching tabs animates the
// panel between them. `shown` is null while the panel is closed.
export function usePanelWidth(
  row: RefObject<HTMLElement | null>,
  shown: PanelContent | null,
) {
  const [widths, setWidths] = useState<Partial<Record<PanelContent, number>>>(
    {},
  );
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
  // A closing panel keeps its content's width while it slides out.
  const [last, setLast] = useState<PanelContent>(shown ?? "none");
  if (shown && shown !== last) setLast(shown);
  const key = shown ?? last;
  const column = key !== "pdf";
  const min = column ? ASSISTANT.min : PANEL_MIN;
  const max = Math.max(min, rowWidth - CANVAS_RESERVE);
  const fallback = column
    ? Math.min(
        ASSISTANT.preferred,
        rowWidth - PAGE_RAIL - ASSISTANT.canvasFloor,
      )
    : Math.round((rowWidth - PAGE_RAIL) / 2);
  const clamp = (w: number) => Math.min(max, Math.max(min, w));
  return {
    width: clamp(widths[key] ?? fallback),
    min,
    max,
    setWidth: (w: number) => setWidths((old) => ({ ...old, [key]: clamp(w) })),
  };
}
