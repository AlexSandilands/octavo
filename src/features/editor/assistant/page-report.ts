import type { Block, Page } from "@/lib/blocks";
import { richTextToPlain } from "@/lib/rich-text-doc";
import type { Fits } from "../pdf-import/paginate";
import type { TextFlowMetrics } from "../text-flow";
import type { CoverLayout } from "./cover-map";
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
  /** The paginator's page test (#312), live until `dispose` or `signal` aborts. */
  fitter(signal: AbortSignal): Promise<{ fits: Fits; dispose(): void }>;
  /** A cover laid out as members see it: the editor's layout warnings on it
   *  (#313) and where each item landed. */
  cover(page: Page, pages: Page[]): Promise<CoverLayout>;
}

const MAX_LAST_LINES = 12;
/** How many of the shortest last lines the deficit line names (#355). */
const QUICKEST = 3;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const PHOTO_TYPES = new Set(["image", "montage", "video"]);
const isFloat = (b: Block) =>
  "align" in b && (b.align === "left" || b.align === "right");

/** A text block's words on a full line: its words less its last lines', over
 *  its other lines. Null when every line is a last line. */
function wordsPerLine(block: Block | undefined, t: TextLines): number | null {
  if (block?.type !== "text" || t.lines <= t.lastLines.length) return null;
  const words = richTextToPlain(block.text).split(/\s+/).filter(Boolean);
  const rest = words.length - t.lastLines.reduce((a, b) => a + b, 0);
  return rest > 0 ? Math.round(rest / (t.lines - t.lastLines.length)) : null;
}

/** The deficit up front (#355): the whole cut in lines and words, the quickest
 *  lines, one call a block. Trimming a few words a call took Sonnet 5 14–41
 *  calls. Worded for shortening only: an overflow the author didn't ask to
 *  trim is moved or split. */
function deficitLine(over: number, text: TextLines[], perLine: number[]) {
  const quickest = text
    .filter((t) => t.lastLines.length)
    .map((t) => ({ id: t.id, words: Math.min(...t.lastLines) }))
    .sort((a, b) => a.words - b.words)
    .slice(0, QUICKEST)
    .map((q) => `[${q.id}] (${plural(q.words, "word")})`);
  const sorted = [...perLine].sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)];
  const words = typical
    ? `: at least ${over * typical} words at ~${typical} a line`
    : "";
  return [
    `To fit by trimming, the text must lose ${plural(over, "line")} in all${words}.`,
    quickest.length
      ? `A paragraph whose last line is short frees that line for fewer words: ${quickest.join(", ")}.`
      : "",
    `When shortening, make the whole cut in one round, one set_text per block you shorten, not a few words at a time.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * "page 4: fits, ~80% full", or for an overflow the levers that fix it: how
 * many lines the text must lose (#355), each text block's lines and its
 * paragraphs' last lines (a line only goes when a paragraph's last line
 * empties), which blocks are tall enough to move off, and split_page. The
 * spike's bare "cut N words" misled; the words here follow the measured lines.
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
    const perLine: number[] = [];
    const blocks = report.text.map((t) => {
      const shown = t.lastLines.slice(0, MAX_LAST_LINES).join(", ");
      const more = t.lastLines.length > MAX_LAST_LINES ? ", …" : "";
      const last =
        t.lastLines.length === 1
          ? `, its last line holds ${plural(t.lastLines[0]!, "word")}`
          : t.lastLines.length
            ? `, its paragraphs' last lines hold ${shown}${more} words`
            : "";
      const per = wordsPerLine(
        page.blocks.find((b) => b.id === t.id),
        t,
      );
      if (per) perLine.push(per);
      return `[${t.id}] ${plural(t.lines, "line")}${per ? ` of ~${per} words` : ""}${last}`;
    });
    parts.push(
      `Text on it: ${blocks.join("; ")}. A line is freed only when a paragraph's last line empties.`,
      deficitLine(fill.overflowLines, report.text, perLine),
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
