// The editor's own measurers in headless Chromium (#315): browser-entry.tsx is
// bundled with esbuild and loaded into a page carrying the app's compiled CSS
// and fonts, taken from a running dev server (the spike's appShell trick), so
// fills and overflow are the canvas's geometry, not an estimate. Node reaches
// them through page.evaluate; EditMeasurer is the executor's interface.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser, type Page as Tab } from "playwright";
import type { Block, Page } from "../../src/lib/blocks.ts";
import type { HarnessOptions } from "./browser-entry.tsx";
import type { PageFill } from "../../src/features/editor/assistant/page-fill.ts";
import type {
  EditMeasurer,
  PageReport,
} from "../../src/features/editor/assistant/page-report.ts";
import type { TextFlowMetrics } from "../../src/features/editor/text-flow.ts";

const ROOT = join(import.meta.dirname, "../..");

async function bundle(): Promise<string> {
  const out = await build({
    entryPoints: [join(import.meta.dirname, "browser-entry.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    tsconfig: join(ROOT, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    // Other process.env reads (next/image's options, NEXT_PUBLIC_*) find
    // nothing and take their defaults, as an unconfigured build would.
    banner: { js: "var process = { env: {} };" },
    plugins: [
      {
        name: "next-image",
        setup: (b) =>
          b.onResolve({ filter: /^next\/image$/ }, () => ({
            path: join(import.meta.dirname, "next-image-shim.mts"),
          })),
      },
    ],
    logLevel: "error",
  });
  return out.outputFiles[0]!.text;
}

/** The dev server's <html> tag (brand + font variables) and stylesheets. */
export async function appShell(
  app: string,
): Promise<{ htmlTag: string; head: string }> {
  let body: string;
  try {
    body = await (await fetch(`${app}/signin`)).text();
  } catch {
    throw new Error(
      `the app at ${app} isn't answering; start one (npm run dev) and pass --app`,
    );
  }
  const htmlTag = body.match(/<html[^>]*>/)?.[0];
  const links = body.match(/<link rel="stylesheet"[^>]*>/g) ?? [];
  if (!htmlTag || !links.length)
    throw new Error(`${app}/signin didn't look like the app`);
  return {
    htmlTag,
    head: links.map((l) => l.replace(/ nonce="[^"]*"/, "")).join(""),
  };
}

/** Where the fixture's images are served from, on the app's own origin. */
export const IMAGE_PATH = "/__fixture/img/";

/** A route that answers IMAGE_PATH from files on disk, by id. */
export async function serveImages(
  tab: Tab,
  files: Map<string, string>,
): Promise<void> {
  await tab.route(`**${IMAGE_PATH}**`, (route) => {
    const id = decodeURIComponent(route.request().url().split(IMAGE_PATH)[1]!);
    const file = files.get(id);
    return file
      ? route.fulfill({ body: readFileSync(file), contentType: "image/webp" })
      : route.fulfill({ status: 404 });
  });
}

export class MeasureBrowser {
  private constructor(
    readonly browser: Browser,
    private readonly tab: Tab,
    /** Image id → file, served at IMAGE_PATH; filled per case. */
    readonly files: Map<string, string>,
  ) {}

  static async open(app: string): Promise<MeasureBrowser> {
    const [code, shell] = await Promise.all([bundle(), appShell(app)]);
    const browser = await chromium.launch();
    // The app's nonce CSP would refuse the injected bundle.
    const context = await browser.newContext({
      viewport: { width: 1200, height: 1000 },
      bypassCSP: true,
    });
    const tab = await context.newPage();
    tab.on("pageerror", (e) => console.warn(`  (measurer page: ${e.message})`));
    const files = new Map<string, string>();
    await serveImages(tab, files);
    // Next's dev server refuses /_next requests from a foreign origin, so the
    // document is swapped in on the server's own origin.
    await tab.goto(`${app}/signin`);
    await tab.setContent(
      `<!doctype html>${shell.htmlTag}<head><base href="${app}/">${shell.head}</head><body></body></html>`,
      { waitUntil: "networkidle" },
    );
    await tab.addScriptTag({ content: code });
    await tab.evaluate(() => document.fonts.ready);
    return new MeasureBrowser(browser, tab, files);
  }

  private reports = new Map<string, PageReport>();
  private filled = new Map<string, PageFill>();

  /** Page chrome and images for the pages measured next. */
  async configure(options: HarnessOptions): Promise<void> {
    this.reports.clear();
    this.filled.clear();
    await this.tab.evaluate((o) => window.__assistant.configure(o), options);
  }

  /** The executor's measurer, answered in the browser. */
  measurer(): EditMeasurer {
    return {
      report: async (page: Page) => {
        const key = JSON.stringify(page);
        const hit = this.reports.get(key);
        if (hit) return hit;
        const report = await this.tab.evaluate(
          (p) => window.__assistant.report(p),
          page,
        );
        if (report.fill) this.reports.set(key, report);
        return report;
      },
      textFlow: (blocks: Block[], id: string) =>
        this.tab.evaluate(([b, i]) => window.__assistant.textFlow(b, i), [
          blocks,
          id,
        ] as const) as Promise<TextFlowMetrics | null>,
    };
  }

  /** Every page's fill, as the panel's snapshot measures it. */
  async fills(pages: Page[]): Promise<Record<string, PageFill>> {
    const out: Record<string, PageFill> = {};
    const todo = pages.filter((p) => {
      const hit = this.filled.get(JSON.stringify(p));
      if (hit) out[p.id] = hit;
      return !hit;
    });
    if (todo.length) {
      const measured = await this.tab.evaluate(
        (ps) => window.__assistant.fills(ps),
        todo,
      );
      for (const p of todo) {
        const fill = measured[p.id];
        if (!fill) continue;
        out[p.id] = fill;
        this.filled.set(JSON.stringify(p), fill);
      }
    }
    return out;
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

declare global {
  interface Window {
    __assistant: import("./browser-entry.tsx").HarnessApi;
  }
}
