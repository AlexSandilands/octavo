"use client";

import { useEffect, useState, type RefObject } from "react";

/** How a stage's floating bar lays itself out for the room it has. */
export type BarLayout = "labels" | "icons" | "vertical";
export type BarPosition = "bottom" | "left";

// A manual choice owns only the bar's position. Width can still remove labels,
// and choosing the bottom at a standing-bar width produces the compact row.
export function barLayoutAtPosition(
  responsive: BarLayout,
  position: BarPosition | null,
): BarLayout {
  if (position === "left") return "vertical";
  if (position === "bottom")
    return responsive === "labels" ? "labels" : "icons";
  return responsive;
}

// A stage's tool bar answers to the stage's own width, not the window's: with
// the PDF panel out, the canvas can be narrow on a wide screen. Labels while
// there is room, icons only as it narrows, and standing on end at the stage's
// outer edge when even those would not fit across.
export function useBarLayout(
  stage: RefObject<HTMLElement | null>,
  thresholds: { labels: number; vertical: number },
): BarLayout {
  const [layout, setLayout] = useState<BarLayout>("labels");
  const { labels, vertical } = thresholds;
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      setLayout(
        width >= labels ? "labels" : width >= vertical ? "icons" : "vertical",
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage, labels, vertical]);
  return layout;
}
