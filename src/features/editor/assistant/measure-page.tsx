import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { PageFrame, PAGE_H, PAGE_W } from "@/features/blocks/page-frame";
import { isPageOwning, type Block, type Page } from "@/lib/blocks";
import type { MeasurementOptions } from "../pdf-import/measure";
import { MeasurementBlocks } from "../pdf-import/measurement-blocks";
import {
  measurePageFill,
  measurePageOverflow,
  measureTextFlow,
} from "../page-metrics";
import { fillFromMeasure } from "./page-fill";
import type { EditMeasurer, PageReport, TextLines } from "./page-report";

// The executor's measurer (#310): a page laid out off screen in the editor's
// own presentation, as the fill measurer does (measure-fills.tsx), and read
// with the canvas's geometry — the fill, the block the overflow marker would
// sit on, block heights, and for an overflowing page each text block's lines.

const IMAGE_WAIT_MS = 3000;

const settle = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);

/** A paragraph's line count and the words on its last line. */
function paragraphLines(p: HTMLElement): { lines: number; last: number } {
  const lineHeight = parseFloat(getComputedStyle(p).lineHeight) || 20;
  const range = document.createRange();
  const tops: number[] = [];
  const ends: number[] = [];
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const word of (node.textContent ?? "").matchAll(/\S+/g)) {
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      if (!rects.length) continue;
      tops.push(...rects.map((r) => r.top));
      // A word hyphenated across lines belongs to the line it ends on.
      ends.push(rects.at(-1)!.top);
    }
  }
  if (!ends.length) return { lines: 1, last: 0 };
  const lines: number[] = [];
  for (const top of tops.sort((a, b) => a - b))
    if (!lines.length || top - lines.at(-1)! > lineHeight / 2) lines.push(top);
  const lastTop = lines.at(-1)!;
  return {
    lines: lines.length,
    last: ends.filter((top) => Math.abs(top - lastTop) <= lineHeight / 2)
      .length,
  };
}

function textLines(block: HTMLElement, id: string): TextLines | null {
  const body = block.querySelector<HTMLElement>(".rich-text");
  if (!body) return null;
  // List items without their own paragraph count as one.
  const paragraphs = body.querySelectorAll<HTMLElement>("p, li:not(:has(p))");
  let lines = 0;
  const lastLines: number[] = [];
  for (const p of paragraphs) {
    const measured = paragraphLines(p);
    lines += measured.lines;
    lastLines.push(measured.last);
  }
  return { id, lines, lastLines };
}

export function createPageMeasurer(options: MeasurementOptions): Omit<
  EditMeasurer,
  "fitter"
> & {
  dispose(): void;
} {
  const cache = new WeakMap<Page, PageReport>();
  let host: HTMLDivElement | null = null;
  let root: Root | null = null;

  /** Lays `blocks` out as one page; returns the block container. */
  const layout = async (blocks: Block[]): Promise<HTMLElement | null> => {
    if (!host || !root) {
      host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.inert = true;
      Object.assign(host.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        width: `${PAGE_W}px`,
        visibility: "hidden",
        pointerEvents: "none",
      });
      document.body.append(host);
      root = createRoot(host);
    }
    const r = root;
    await document.fonts.ready;
    flushSync(() =>
      r.render(
        <PageFrame
          theme={options.theme}
          w={PAGE_W}
          h={PAGE_H}
          issueNo={options.issueNo}
          pageNo={1}
          logo={options.logo}
          settings={options.settings}
          clip={false}
        >
          <MeasurementBlocks blocks={blocks} options={options} ids />
        </PageFrame>,
      ),
    );
    await Promise.all(
      [...host.querySelectorAll("img")]
        .filter((img) => !img.complete && !img.getAttribute("height"))
        .map((img) => {
          img.loading = "eager";
          return settle(img.decode(), IMAGE_WAIT_MS);
        }),
    );
    // Body text is measured as Tiptap sets it (see pdf-import/measure.tsx).
    for (const body of host.querySelectorAll(".rich-text"))
      body.classList.add("ProseMirror");
    return host.querySelector<HTMLElement>("[data-page-frame] > .flow-root");
  };

  // Nothing stays laid out: its block ids would shadow the canvas's.
  const clear = () => {
    const r = root;
    if (r) flushSync(() => r.render(null));
  };

  const measureReport = async (page: Page): Promise<PageReport> => {
    const empty: PageReport = {
      fill: undefined,
      overflowAt: null,
      overflowPx: 0,
      heights: {},
      text: [],
    };
    if (page.cover) return { ...empty, fill: { kind: "cover" } };
    if (page.blocks.some(isPageOwning))
      return { ...empty, fill: { kind: "photo-page" } };
    const container = await layout(page.blocks);
    const fill = container && measurePageFill(container);
    if (!container || !fill) return empty;
    const over = measurePageOverflow(container);
    const heights: Record<string, number> = {};
    const text: TextLines[] = [];
    for (const el of container.querySelectorAll<HTMLElement>(
      "[data-block-id]",
    )) {
      const id = el.dataset.blockId!;
      heights[id] = el.offsetHeight;
      const block = page.blocks.find((b) => b.id === id);
      if (over && block?.type === "text") {
        const lines = textLines(el, id);
        if (lines) text.push(lines);
      }
    }
    return {
      fill: fillFromMeasure(fill),
      overflowAt: over ? { blockId: over.id, fitsAlone: over.fitsAlone } : null,
      overflowPx: Math.max(0, fill.used - fill.avail),
      heights,
      text,
    };
  };

  return {
    async report(page) {
      const cached = cache.get(page);
      if (cached) return cached;
      try {
        const report = await measureReport(page);
        if (report.fill) cache.set(page, report);
        return report;
      } finally {
        clear();
      }
    },
    async textFlow(blocks, blockId) {
      try {
        const container = await layout(blocks);
        const block = blocks.find((b) => b.id === blockId);
        if (!container || block?.type !== "text") return null;
        const body = container.querySelector(
          `[data-block-id="${CSS.escape(blockId)}"] .rich-text`,
        );
        return measureTextFlow(container, blockId, body?.children.length ?? 0);
      } finally {
        clear();
      }
    },
    dispose() {
      root?.unmount();
      host?.remove();
      root = null;
      host = null;
    },
  };
}
