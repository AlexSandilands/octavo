import type { CSSProperties } from "react";
import type { Block } from "@/lib/blocks";

// Blocks render in normal flow (not flex) so a floated image wraps the text that
// follows it. This computes the per-block flow style: vertical rhythm for every
// block, float + width for inline (left/right) images, and clears so a heading
// or a full-width image always starts on a fresh line. Shared by the desktop
// reader and the admin editor so both wrap identically.

const GAP = 14; // px — matches the old flex gap-3.5
const FLOAT_GUTTER = 18; // px between a floated image and the wrapping text

export function blockFlowStyle(block: Block): CSSProperties {
  const base: CSSProperties = { marginBottom: GAP };

  if (block.type === "heading") return { ...base, clear: "both" };

  if (block.type === "image") {
    const align = block.align ?? "full";
    const width = block.width ?? 100;
    if (align === "left" || align === "right") {
      return {
        ...base,
        float: align,
        width: `${width}%`,
        ...(align === "left"
          ? { marginRight: FLOAT_GUTTER }
          : { marginLeft: FLOAT_GUTTER }),
      };
    }
    // full / break — never sits beside a float, optionally narrowed + centred
    return {
      ...base,
      clear: "both",
      ...(width < 100 ? { width: `${width}%`, marginInline: "auto" } : {}),
    };
  }

  return base;
}
