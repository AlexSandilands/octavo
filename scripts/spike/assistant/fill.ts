// ESTIMATED page fill. The editor measures overflow in the DOM
// (page-metrics.ts); this spike has no DOM, so it simulates the page's flow
// from character counts and the theme's type sizes (page-frame.tsx, the themes,
// globals.css `.rich-text`). Calibrated against the seed issues, which all fit.
// Every figure it produces is an estimate and is labelled as one.
import {
  isPageOwning,
  textSizePx,
  type Block,
  type Page,
  type TextSize,
} from "../../../src/lib/blocks.ts";
import {
  richTextToPlain,
  stringToDoc,
  type RichBlock,
  type RichDoc,
} from "../../../src/lib/rich-text-doc.ts";
import type { ImageInfo } from "./seed.ts";

const COLUMN_W = 560; // PAGE_W 640 − 2 × PAGE_PAD 40
// PAGE_H 900 − PAGE_PAD 40 at the top − the running footer and its gutter.
export const TEXT_AREA_H = 815;
const GAP = 14; // layout.ts block rhythm
const FLOAT_GUTTER = 18;
const BODY_LINE = textSizePx("m") * 1.62; // one "line" in overflow reports
// Average glyph width of Newsreader, as a fraction of its size (calibrate.mts:
// within ~1% of real rendering over the seed's 80 text blocks).
const SERIF_EM = 0.43;

type Images = Map<string, ImageInfo>;

export type PageFill = {
  kind: "cover" | "photo-page" | "flow";
  usedPx: number;
  percent: number;
  overflowLines: number;
};

const cpl = (width: number, px: number, em = SERIF_EM) =>
  Math.max(8, Math.floor(width / (px * em)));
const linesFor = (chars: number, perLine: number) =>
  Math.max(1, Math.ceil(chars / perLine));

export function textDoc(block: Extract<Block, { type: "text" }>): RichDoc {
  return typeof block.text === "string" ? stringToDoc(block.text) : block.text;
}

/** Heights of a text doc's top-level nodes at full column width, margins included. */
export function textNodeHeights(
  doc: RichDoc,
  size: TextSize = "m",
  width = COLUMN_W,
): number[] {
  const px = textSizePx(size);
  const line = px * 1.62;
  const margin = px * 0.55;
  const nodeLines = (node: RichBlock, w: number): number => {
    if (node.type === "paragraph") {
      const segments = (node.content ?? [])
        .map((n) => (n.type === "text" ? n.text : "\n"))
        .join("")
        .split("\n");
      return segments.reduce(
        (sum, s) => sum + linesFor(s.length, cpl(w, px)),
        0,
      );
    }
    return node.content.reduce(
      (sum, item) =>
        sum +
        0.24 +
        item.content.reduce((s, c) => s + nodeLines(c, w - px * 1.5), 0),
      0,
    );
  };
  return doc.content.map((n) => nodeLines(n, width) * line + margin);
}

function textHeight(
  block: Extract<Block, { type: "text" }>,
  width = COLUMN_W,
): number {
  const heights = textNodeHeights(textDoc(block), block.size, width);
  const total = heights.reduce((a, b) => a + b, 0);
  return Math.max(0, total - textSizePx(block.size ?? "m") * 0.55); // last child has no margin
}

function headingHeight(block: Extract<Block, { type: "heading" }>): number {
  const kicker = block.kicker.trim() ? 22 : 0;
  const title = block.title.length;
  switch (block.level ?? "main") {
    case "main":
      return kicker + 6 + linesFor(title, cpl(COLUMN_W, 32, 0.5)) * 40 + 22;
    case "section":
      return 14 + kicker + linesFor(title, cpl(COLUMN_W, 24, 0.5)) * 30;
    case "paragraph":
      return kicker + linesFor(title, cpl(COLUMN_W, 15)) * 21;
  }
}

/** Height of a picture at `width`% of the column, caption included. */
function pictureHeight(block: Block, images: Images): number {
  if (
    block.type !== "image" &&
    block.type !== "montage" &&
    block.type !== "video"
  )
    return 0;
  const w = (COLUMN_W * (block.width ?? 100)) / 100;
  let body = 150; // the empty photo placeholder
  if (block.type === "video") body = (w * 9) / 16;
  else {
    const id = block.type === "image" ? block.imageId : block.items[0]?.imageId;
    const info = id ? images.get(id) : undefined;
    if (info) body = (w * info.height) / info.width;
  }
  const caption = block.caption.trim()
    ? 10 + linesFor(block.caption.length, cpl(w, 13, 0.5)) * 18
    : 0;
  return body + caption;
}

export function blockHeight(block: Block, images: Images): number {
  switch (block.type) {
    case "heading":
      return headingHeight(block);
    case "text":
      return textHeight(block);
    case "sponsor":
      return 90;
    default:
      return pictureHeight(block, images);
  }
}

const isFloat = (b: Block) =>
  (b.type === "image" || b.type === "montage" || b.type === "video") &&
  (b.align === "left" || b.align === "right");

/** Simulate the page's flow: floats narrow the text beside them until cleared. */
export function usedHeight(blocks: Block[], images: Images): number {
  let y = 0;
  let floatBottom = 0;
  let floatW = 0;
  for (const block of blocks) {
    if (isFloat(block)) {
      const h = pictureHeight(block, images);
      floatW =
        (COLUMN_W * ((block as { width?: number }).width ?? 100)) / 100 +
        FLOAT_GUTTER;
      floatBottom = Math.max(floatBottom, y + h + GAP);
      continue;
    }
    if (block.type === "text" && y < floatBottom) {
      // Beside the float at the narrow width, then full width below it.
      const narrow = textHeight(block, COLUMN_W - floatW);
      const room = floatBottom - y;
      if (narrow <= room) y += narrow + GAP;
      else
        y =
          floatBottom +
          (narrow - room) * ((COLUMN_W - floatW) / COLUMN_W) +
          GAP;
      continue;
    }
    y = Math.max(y, floatBottom) + blockHeight(block, images) + GAP;
  }
  return Math.max(y, floatBottom) - GAP;
}

export function estimateFill(page: Page, images: Images): PageFill {
  if (page.cover)
    return { kind: "cover", usedPx: 0, percent: 0, overflowLines: 0 };
  if (page.blocks.some(isPageOwning))
    return {
      kind: "photo-page",
      usedPx: TEXT_AREA_H,
      percent: 100,
      overflowLines: 0,
    };
  const used = Math.max(0, usedHeight(page.blocks, images));
  return {
    kind: "flow",
    usedPx: used,
    percent: Math.round((used / TEXT_AREA_H) * 100),
    overflowLines:
      used > TEXT_AREA_H ? Math.ceil((used - TEXT_AREA_H) / BODY_LINE) : 0,
  };
}

export const fits = (fill: PageFill) => fill.overflowLines === 0;

/** "fits, ~80% full" / "overflows by ~6 lines" — the wording the prompt expects. */
export function describeFill(fill: PageFill): string {
  if (fill.kind === "cover") return "cover";
  if (fill.kind === "photo-page") return "a full-page photo";
  if (fill.overflowLines > 0)
    return `overflows by ~${fill.overflowLines} line${fill.overflowLines === 1 ? "" : "s"}`;
  return `fits, ~${Math.round(fill.percent / 5) * 5}% full`;
}

/** Plain words of a block, for outlines and wording checks. */
export function blockPlain(block: Block): string {
  if (block.type === "heading")
    return [block.kicker, block.title].filter(Boolean).join(" ");
  if (block.type === "text") return richTextToPlain(block.text);
  return "";
}
