// Bundled by esbuild (measure.mts) and run in headless Chromium: the editor's
// own measurers (#310, #309), exactly as the canvas runs them, reachable from
// Node through page.evaluate. Nothing here measures on its own.
import type { Block, Page } from "@/lib/blocks";
import type { MeasurementOptions } from "@/features/editor/pdf-import/measure";
import { createPageMeasurer } from "@/features/editor/assistant/measure-page";
import { createFillMeasurer } from "@/features/editor/assistant/measure-fills";
import { resolveTheme } from "@/features/blocks/themes/registry";

/** MeasurementOptions as JSON: the theme travels by id (it holds components). */
export type HarnessOptions = Omit<MeasurementOptions, "theme"> & {
  themeId: string;
};

let options: MeasurementOptions | null = null;
let page: ReturnType<typeof createPageMeasurer> | null = null;
let fills: ReturnType<typeof createFillMeasurer> | null = null;

const need = () => {
  if (!page || !fills) throw new Error("configure() first");
  return { page, fills };
};

const api = {
  /** Page chrome and images for what follows; replaces the measurers. */
  configure({ themeId, ...rest }: HarnessOptions) {
    page?.dispose();
    fills?.dispose();
    options = { ...rest, theme: resolveTheme(themeId) };
    page = createPageMeasurer(options);
    fills = createFillMeasurer(options);
  },
  report: (p: Page) => need().page.report(p),
  textFlow: (blocks: Block[], id: string) => need().page.textFlow(blocks, id),
  fills: (pages: Page[]) => need().fills.measure(pages),
};

(window as unknown as { __assistant: typeof api }).__assistant = api;
export type HarnessApi = typeof api;
