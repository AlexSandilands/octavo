import type { Block, Page } from "@/lib/blocks";
import type { TextFlowMetrics } from "../text-flow";
import type { CoverWarning } from "../use-cover-layout-warnings";
import { BODY_LINE_PX, describeFill, type PageFill } from "./page-fill";

// What the executor learns about a page after an edit (#310), and how it's told
// to the model. The figures come from the editor's own measurement, laid out
// off screen (measure-page.tsx); a script can stand in its own measurer.

/** One text block's lines, and the words on each paragraph's last line. */
export type TextLines = { id: string; lines: number; lastLines: number[] };

export type PageReport = {
  fill: PageFill | undefined;
  /** The first block past the text area, as the canvas marks it. */
  overflowAt: { blockId: string; fitsAlone: boolean } | null;
  /** How far past the text area the page runs, in canvas px. */
  overflowPx: number;
  /** Each block's rendered height, px. */
  heights: Record<string, number>;
  /** Text blocks' lines — measured only when the page overflows. */
  text: TextLines[];
};

export interface EditMeasurer {
  report(page: Page): Promise<PageReport>;
  /** The flow split's metrics for `blockId`, laid out after `blocks`' others. */
  textFlow(blocks: Block[], blockId: string): Promise<TextFlowMetrics | null>;
  /** A cover laid out as members see it, and the editor's layout warnings on it (#313). */
  cover(page: Page, pages: Page[]): Promise<CoverWarning[]>;
}

const MAX_LAST_LINES = 12;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const PHOTO_TYPES = new Set(["image", "montage", "video"]);
const isFloat = (b: Block) =>
  "align" in b && (b.align === "left" || b.align === "right");

/**
 * "page 4: fits, ~80% full", or for an overflow the levers that fix it: each
 * text block's lines and its paragraphs' last lines (a line only goes when a
 * paragraph's last line empties), which blocks are tall enough to move off,
 * and split_page. "Cut N words" misled the spike's models; this doesn't.
 */
export function describeReport(
  pageNo: number,
  page: Page,
  report: PageReport,
): string {
  const head = `page ${pageNo}: ${describeFill(report.fill)}`;
  const fill = report.fill;
  if (!fill || fill.kind !== "flow" || fill.overflowLines === 0) return head;
  const parts = [`${head}.`];
  if (report.text.length) {
    const blocks = report.text.map((t) => {
      const shown = t.lastLines.slice(0, MAX_LAST_LINES).join(", ");
      const more = t.lastLines.length > MAX_LAST_LINES ? ", …" : "";
      const last =
        t.lastLines.length === 1
          ? `, its last line holds ${plural(t.lastLines[0]!, "word")}`
          : t.lastLines.length
            ? `, its paragraphs' last lines hold ${shown}${more} words`
            : "";
      return `[${t.id}] ${plural(t.lines, "line")}${last}`;
    });
    parts.push(
      `Text on it: ${blocks.join("; ")}. A line is freed only when a paragraph's last line empties.`,
    );
  }
  const movable = page.blocks
    .filter((b) => b.type !== "text")
    .map((b) => ({ b, h: report.heights[b.id] ?? 0 }))
    .filter(({ h }) => h >= report.overflowPx)
    .map(
      ({ b, h }) =>
        `[${b.id}] (${PHOTO_TYPES.has(b.type) ? "photo" : b.type}, ~${plural(Math.round(h / BODY_LINE_PX), "line")} tall${isFloat(b) ? ", floated, so it frees less" : ""})`,
    );
  if (movable.length)
    parts.push(
      `Moving ${movable.join(" or ")} to another page would free enough room.`,
    );
  parts.push(
    `split_page ${pageNo} carries the end onto a new page without changing any words.`,
  );
  return parts.join(" ");
}
