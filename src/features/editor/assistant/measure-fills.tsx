import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { PageFrame, PAGE_H, PAGE_W } from "@/features/blocks/page-frame";
import { isPageOwning, type Page } from "@/lib/blocks";
import type { MeasurementOptions } from "../pdf-import/measure";
import { MeasurementBlocks } from "../pdf-import/measurement-blocks";
import { measurePageFill } from "../page-metrics";
import { fillFromMeasure, type PageFill } from "./page-fill";

const IMAGE_WAIT_MS = 3000;

const settle = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);

// Every page's fill for the assistant (#309). The canvas lays out only the page
// being edited, so the others are laid out off screen in the editor's own
// presentation (the Import PDF measurer's) and measured with the same geometry
// as the overflow marker. Pages are immutable in the editor's state, so a page
// already measured under the same options is answered from the cache.
export function createFillMeasurer(options: MeasurementOptions) {
  const cache = new WeakMap<Page, PageFill>();
  let host: HTMLDivElement | null = null;
  let root: Root | null = null;

  const mount = () => {
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
    return { host, root };
  };

  const measureOne = async (page: Page): Promise<PageFill | undefined> => {
    const { host: el, root: r } = host && root ? { host, root } : mount();
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
          <MeasurementBlocks blocks={page.blocks} options={options} ids />
        </PageFrame>,
      ),
    );
    // A photo without a stored size has no box until it decodes.
    await Promise.all(
      [...el.querySelectorAll("img")]
        .filter((img) => !img.complete && !img.getAttribute("height"))
        .map((img) => {
          img.loading = "eager";
          return settle(img.decode(), IMAGE_WAIT_MS);
        }),
    );
    // Body text is measured as Tiptap sets it (see pdf-import/measure.tsx).
    for (const body of el.querySelectorAll(".rich-text"))
      body.classList.add("ProseMirror");
    const container = el.querySelector<HTMLElement>(
      "[data-page-frame] > .flow-root",
    );
    const measured = container && measurePageFill(container);
    return measured ? fillFromMeasure(measured) : undefined;
  };

  return {
    /** Page id → fill, for every page that could be laid out. */
    measure: async (pages: Page[]): Promise<Record<string, PageFill>> => {
      await document.fonts.ready;
      const fills: Record<string, PageFill> = {};
      for (const page of pages) {
        let fill = cache.get(page);
        if (!fill) {
          fill = page.cover
            ? { kind: "cover" }
            : page.blocks.some(isPageOwning)
              ? { kind: "photo-page" }
              : await measureOne(page);
          // Unmeasurable (no layout yet) reads "fill not measured", and retries next time.
          if (fill) cache.set(page, fill);
        }
        if (fill) fills[page.id] = fill;
      }
      // Nothing stays laid out between runs: its block ids would shadow the canvas's.
      if (root) flushSync(() => root!.render(null));
      return fills;
    },
    dispose: () => {
      root?.unmount();
      host?.remove();
      root = null;
      host = null;
    },
  };
}
