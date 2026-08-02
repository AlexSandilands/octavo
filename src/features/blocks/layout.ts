import type { CSSProperties } from "react";
import type { Block } from "@/lib/blocks";

// Blocks render in normal flow (not flex) so a floated image wraps the text that
// follows it. This computes the per-block flow style: vertical rhythm for every
// block, float + width for inline (left/right) pictures, and clears so a heading
// or a full-width picture always starts on a fresh line. Shared by the desktop
// reader and the admin editor so both wrap identically.

const GAP = 14; // px — matches the old flex gap-3.5
const FLOAT_GUTTER = 18; // px between a floated image and the wrapping text

// The picture-shaped blocks: a single image and a montage of them. They share
// the align/width fields and therefore the identical flow rules, so a montage
// drops into a layout wherever a photo would (issue #95).
type PictureBlock = Extract<Block, { type: "image" | "montage" }>;

export function isPictureBlock(block: Block): block is PictureBlock {
  return block.type === "image" || block.type === "montage";
}

// A picture block that floats, so the text after it wraps alongside. The editor
// needs this too (a floated picture must paint above the wrapping text to stay
// clickable — see EditorBlock).
export function isFloatedPicture(block: Block): boolean {
  return (
    isPictureBlock(block) && (block.align === "left" || block.align === "right")
  );
}

export function blockFlowStyle(block: Block, cover = false): CSSProperties {
  // Cover pages never wrap text around floats: every block is centred and
  // stacked, images sized by their width and centred. The page itself is
  // vertically centred by the cover container (see the readers / editor).
  if (cover) {
    const base: CSSProperties = { marginBottom: 24 };
    if (isPictureBlock(block)) {
      const width = block.width ?? 100;
      return { ...base, width: `${width}%`, marginInline: "auto" };
    }
    return base;
  }

  const base: CSSProperties = { marginBottom: GAP };

  if (block.type === "heading") return { ...base, clear: "both" };

  if (isPictureBlock(block)) {
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
