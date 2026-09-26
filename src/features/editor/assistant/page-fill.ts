import { textSizePx } from "@/lib/blocks";
import type { PageFillMeasure } from "../page-metrics";

// How full a page is, as the assistant reads it (#309). The figure comes from the
// editor's own measurement (`measurePageFill`, the geometry the overflow marker
// uses), so "fits" here and "overflows" on the canvas can't disagree.

export type PageFill =
  | { kind: "cover" }
  /** A full-page photo owns the page (#227): nothing else goes on it. */
  | { kind: "photo-page" }
  /** Percent of the text area used; lines of body text past the footer. */
  | { kind: "flow"; percent: number; overflowLines: number };

/** One line of body text (size M at the `.rich-text` line height). */
export const BODY_LINE_PX = textSizePx("m") * 1.62;

export function fillFromMeasure({ used, avail }: PageFillMeasure): PageFill {
  const over = used - avail;
  return {
    kind: "flow",
    percent: avail > 0 ? Math.round((Math.max(0, used) / avail) * 100) : 100,
    // A sub-pixel spill isn't a line; the overflow marker allows the same slack.
    overflowLines: over > 1 ? Math.max(1, Math.round(over / BODY_LINE_PX)) : 0,
  };
}

/** "fits, ~80% full" / "overflows by ~6 lines": the wording the prompt expects. */
export function describeFill(fill: PageFill | undefined): string {
  if (!fill) return "fill not measured";
  if (fill.kind === "cover") return "cover";
  if (fill.kind === "photo-page") return "a full-page photo";
  if (fill.overflowLines > 0)
    return `overflows by ~${fill.overflowLines} line${fill.overflowLines === 1 ? "" : "s"}`;
  return `fits, ~${Math.min(100, Math.round(fill.percent / 5) * 5)}% full`;
}
