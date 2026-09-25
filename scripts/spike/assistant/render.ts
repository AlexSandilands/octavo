// Pictures of pages for `view_page`, rendered with the app's own print
// component. The print route (`/read/[n]/print`) only serves *published* issues
// by number, so a draft can't go through it. Instead this server-renders the
// same `PrintDocument` in-process and loads it into headless Chromium with the
// running dev server's compiled CSS and fonts (read from its /signin page).
// Images go in as data URIs, so nothing has to exist in the database.
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser, type Page } from "playwright";
import {
  EMPTY_SETTINGS,
  resolveSettings,
  type SiteSettings,
} from "../../../src/lib/branding.ts";
import { collectImageIds, type ImageMap } from "../../../src/lib/images.ts";
import { siteDefaults } from "../../../src/lib/site-defaults.ts";
import type { IssueContext } from "./seed.ts";

// next/image is CommonJS with its component on `exports.default`; imported from
// ESM outside Next's bundler, the default import is the module object and React
// refuses it. A resolve hook swaps in a shim that exports the component.
const shim = pathToFileURL(
  join(import.meta.dirname, "next-image-shim.mts"),
).href;
registerHooks({
  resolve: (specifier, context, next) =>
    next(specifier === "next/image" ? shim : specifier, context),
});
const { PrintDocument } =
  await import("../../../src/features/reader/print-document.tsx");

export const DEV_SERVER =
  process.env.SPIKE_DEV_SERVER ?? "http://localhost:3000";
const SCALE = 1.5;

/** The dev server's <html> tag (brand + font variables) and stylesheets. */
async function appShell(): Promise<{ htmlTag: string; head: string }> {
  let body: string;
  try {
    const res = await fetch(`${DEV_SERVER}/signin`);
    body = await res.text();
  } catch {
    throw new Error(`the dev server at ${DEV_SERVER} isn't answering`);
  }
  const htmlTag = body.match(/<html[^>]*>/)?.[0];
  const links = body.match(/<link rel="stylesheet"[^>]*>/g) ?? [];
  if (!htmlTag || !links.length)
    throw new Error(`${DEV_SERVER}/signin didn't look like the app`);
  return {
    htmlTag,
    head: links.map((l) => l.replace(/ nonce="[^"]*"/, "")).join(""),
  };
}

function imageMap(ctx: IssueContext): ImageMap {
  const map: ImageMap = {};
  for (const id of collectImageIds(ctx.content)) {
    const info = ctx.images.get(id);
    if (!info?.file) continue;
    const mime = info.file.endsWith(".png")
      ? "image/png"
      : info.file.endsWith(".jpg") || info.file.endsWith(".jpeg")
        ? "image/jpeg"
        : "image/webp";
    // Null dimensions take BlockImage's plain-<img> branch: identical classes
    // and pixels, and it doesn't need next/image, which only works inside Next.
    map[id] = {
      url: `data:${mime};base64,${readFileSync(info.file).toString("base64")}`,
      width: null,
      height: null,
    };
  }
  return map;
}

export type Measured = { overflowPx: number; percent: number };

export class Renderer {
  private browser?: Browser;
  private page?: Page;
  private shell?: { htmlTag: string; head: string };
  private settings: SiteSettings;
  private loadedFor = "";

  constructor(overrides: Partial<SiteSettings> = {}) {
    this.settings = {
      ...resolveSettings(EMPTY_SETTINGS, siteDefaults),
      ...overrides,
    };
  }

  /** Load the issue as it stands (skipped when unchanged since the last load). */
  private async load(ctx: IssueContext): Promise<Page> {
    this.shell ??= await appShell();
    this.browser ??= await chromium.launch();
    if (!this.page) {
      this.page = await this.browser.newPage({
        viewport: { width: 700, height: 1000 },
        deviceScaleFactor: SCALE,
      });
      // Next's dev server refuses /_next requests from a foreign origin, so the
      // document is swapped in on the server's own origin.
      await this.page.goto(`${DEV_SERVER}/signin`);
    }
    const key = JSON.stringify(ctx.content);
    if (key === this.loadedFor) return this.page;
    const doc = renderToStaticMarkup(
      createElement(PrintDocument, {
        content: ctx.content,
        issueNo: 1,
        theme: ctx.theme,
        logo: null,
        settings: { ...this.settings, ...ctx.settings },
        images: imageMap(ctx),
        sponsors: {},
      }),
    );
    await this.page.setContent(
      `<!doctype html>${this.shell.htmlTag}<head><base href="${DEV_SERVER}/">${this.shell.head}</head><body>${doc}</body></html>`,
      { waitUntil: "networkidle" },
    );
    await this.page.evaluate(() => document.fonts.ready);
    this.loadedFor = key;
    return this.page;
  }

  /** A PNG of one page (1-based), plus the page's measured overflow. */
  async shot(
    ctx: IssueContext,
    pageNo: number,
  ): Promise<{ png: Buffer; measured: Measured | null }> {
    const page = await this.load(ctx);
    const el = page.locator(".pdf-page").nth(pageNo - 1);
    const png = await el.screenshot({ type: "png" });
    const measured = await el.evaluate((box) => {
      const footer = box.querySelector<HTMLElement>("[data-page-footer]");
      if (!footer) return null;
      const top = box.getBoundingClientRect().top;
      const limit = footer.getBoundingClientRect().top - top - 6; // page-metrics' FOOTER_GUTTER
      const content =
        box.querySelector<HTMLElement>("[data-page-frame]")?.children;
      let bottom = 0;
      for (const child of Array.from(content ?? [])) {
        if (
          child.hasAttribute("data-page-footer") ||
          child.hasAttribute("data-page-decoration")
        )
          continue;
        for (const d of Array.from(
          child.querySelectorAll<HTMLElement>("*"),
        ).concat(child as HTMLElement))
          bottom = Math.max(bottom, d.getBoundingClientRect().bottom - top);
      }
      return {
        overflowPx: Math.max(0, Math.round(bottom - limit)),
        percent: Math.round(((bottom - 40) / (limit - 40)) * 100),
      };
    });
    return { png, measured };
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}
