// Pictures of a case's pages as members see them, for the human look covers
// and layout still need (#315). Behind PageRenderer so #342's draft-capable
// render can replace it; until then this is the spike's approach: the app's
// PrintDocument server-rendered in-process and loaded into the harness's
// Chromium with the dev server's CSS and fonts. Load next-image-hook.mts first.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Browser, Page as Tab } from "playwright";
import { PrintDocument } from "../../src/features/reader/print-document.tsx";
import { CONTENT_VERSION, type Page } from "../../src/lib/blocks.ts";
import type { FixtureIssue } from "../fixtures/assistant/cases.mts";
import { settingsFor } from "./issue.mts";
import { appShell, IMAGE_PATH, serveImages } from "./measure.mts";

export interface PageRenderer {
  /** One PNG per page into `dir` (p01.png, …); returns the file names. */
  shoot(issue: FixtureIssue, pages: Page[], dir: string): Promise<string[]>;
  close(): Promise<void>;
}

const SCALE = 1.5;

export class PrintRenderer implements PageRenderer {
  private tab?: Tab;
  private readonly files = new Map<string, string>();

  constructor(
    private readonly browser: Browser,
    private readonly app: string,
  ) {}

  private async open(): Promise<Tab> {
    if (this.tab) return this.tab;
    const context = await this.browser.newContext({
      viewport: { width: 700, height: 1000 },
      deviceScaleFactor: SCALE,
      bypassCSP: true,
    });
    const tab = await context.newPage();
    await serveImages(tab, this.files);
    await tab.goto(`${this.app}/signin`);
    this.tab = tab;
    return tab;
  }

  async shoot(issue: FixtureIssue, pages: Page[], dir: string) {
    const tab = await this.open();
    const shell = await appShell(this.app);
    this.files.clear();
    for (const [id, img] of issue.images) this.files.set(id, img.file);
    // Null dimensions take BlockImage's plain-<img> branch: the same classes
    // and pixels, without next/image's optimiser, which only runs inside Next.
    const images = Object.fromEntries(
      [...issue.images.keys()].map((id) => [
        id,
        { url: `${IMAGE_PATH}${id}`, width: null, height: null },
      ]),
    );
    const doc = renderToStaticMarkup(
      createElement(PrintDocument, {
        content: { version: CONTENT_VERSION, pages },
        issueNo: 1,
        theme: issue.theme,
        logo: null,
        settings: settingsFor(issue),
        images,
        sponsors: {},
      }),
    );
    await tab.setContent(
      `<!doctype html>${shell.htmlTag}<head><base href="${this.app}/">${shell.head}</head><body>${doc}</body></html>`,
      { waitUntil: "networkidle" },
    );
    await tab.evaluate(() => document.fonts.ready);
    mkdirSync(dir, { recursive: true });
    const names: string[] = [];
    for (let n = 1; n <= pages.length; n++) {
      const name = `p${String(n).padStart(2, "0")}.png`;
      writeFileSync(
        join(dir, name),
        await tab
          .locator(".pdf-page")
          .nth(n - 1)
          .screenshot({ type: "png" }),
      );
      names.push(name);
    }
    return names;
  }

  async close() {
    await this.tab?.context().close();
  }
}
