"use client";

import { useEffect, useState, type RefObject } from "react";
import type { EditorTool } from "./tool-rail";

export const PANEL_MIN = 340;
/** Space kept for the page rail, the tool rail and a usable canvas. */
const CANVAS_RESERVE = 150 + 48 + 260;
/** A chat reads best narrow; on a narrow row it opens at its minimum, so the
 *  canvas beside it keeps as much of the page as it can (#309). */
const ASSISTANT = { min: 300, preferred: 400, canvasFloor: 520 };

// The side panel's width: by default half the editor row for Import PDF (the
// page and the panel share the space evenly) and a column for the assistant,
// dragged or keyed within bounds that keep the canvas usable, and re-clamped
// whenever the window changes size. Each tool remembers its own width.
export function usePanelWidth(
  row: RefObject<HTMLElement | null>,
  tool: EditorTool | null,
) {
  const [widths, setWidths] = useState<Partial<Record<EditorTool, number>>>({});
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
  // A closing panel keeps its tool's width while it slides out.
  const [shown, setShown] = useState<EditorTool>(tool ?? "pdf");
  if (tool && tool !== shown) setShown(tool);
  const key = tool ?? shown;
  const assistant = key === "assistant";
  const min = assistant ? ASSISTANT.min : PANEL_MIN;
  const max = Math.max(min, rowWidth - CANVAS_RESERVE);
  const fallback = assistant
    ? Math.min(ASSISTANT.preferred, rowWidth - 150 - 48 - ASSISTANT.canvasFloor)
    : Math.round((rowWidth - 150 - 48) / 2);
  const clamp = (w: number) => Math.min(max, Math.max(min, w));
  return {
    width: clamp(widths[key] ?? fallback),
    min,
    max,
    setWidth: (w: number) => setWidths((old) => ({ ...old, [key]: clamp(w) })),
  };
}
