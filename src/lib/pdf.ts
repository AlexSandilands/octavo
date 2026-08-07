import "server-only";
import { chromium } from "playwright";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import type { LayoutThemeId } from "@/features/blocks/themes/registry";
import { printToken } from "./pdf-token";

// Server-only PDF generation. Headless Chromium loads the issue's print route
// (a localhost self-fetch, authorised by the internal print token) and prints
// the fixed PAGE_W×PAGE_H canvas to a paginated PDF — one PDF page per magazine
// page. This is the ONLY place Playwright is imported; it stays out of every
// client bundle and off the normal request path (design-principles §8). The
// download endpoint calls this once per (issue, revision) and caches the bytes.

// Chromium isn't installed on the build machine or in a bare container. Surface
// that as its own error so the caller can report it clearly (and the operator
// knows to run `npx playwright install --with-deps chromium`) rather than
// bury it in a generic failure.
export class ChromiumUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      "Headless Chromium is not available. Install it with: " +
        "npx playwright install --with-deps chromium",
    );
    this.name = "ChromiumUnavailableError";
    this.cause = cause;
  }
}

function isMissingBrowser(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Executable doesn't exist") ||
    msg.includes("playwright install") ||
    msg.includes("Failed to launch")
  );
}

// The origin the generator self-fetches. Localhost by design: it avoids the
// public CDN/edge, incurs no egress, and never leaves the box. Railway injects
// PORT; default to Next's dev port.
function selfOrigin(): string {
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}

// The PDF renders in a layout theme, keyed by its registry id, so a new layout
// theme flows to the PDF path with no change here (issue #40).
export type PdfTheme = LayoutThemeId;

// `chrome` is the magazine-chrome fingerprint the caller keyed its cache entry
// under. The print page resolves settings in a *separate* request, so the two
// can disagree (a settings edit landing in between, or a database blip degrading
// that read to the deployment defaults) — and the caller would store branding
// its key doesn't describe. So the page stamps what it actually rendered and we
// refuse to hand back bytes that don't match it (issue #127).
export async function generateIssuePdf(
  issueNumber: number,
  theme: PdfTheme,
  chrome: string,
): Promise<Buffer> {
  const url = `${selfOrigin()}/read/${issueNumber}/print?token=${printToken()}&theme=${theme}`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    if (isMissingBrowser(err)) throw new ChromiumUnavailableError(err);
    throw err;
  }

  try {
    const page = await browser.newPage();
    // networkidle so images (R2/local) and web fonts have finished loading; then
    // wait on document.fonts so text is measured/painted with the real faces,
    // not a fallback, before we snapshot to PDF.
    const res = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (!res || !res.ok()) {
      throw new Error(
        `print route returned ${res ? res.status() : "no response"} for issue ${issueNumber}`,
      );
    }
    // The stamp, not the status, is what proves we are looking at the print
    // document rendered from the expected settings: a refused or errored page
    // does not carry one (and doesn't reliably carry a non-OK status either —
    // Next serves the dev error overlay with a 200), and a mismatch means the
    // settings moved under the cache key. Either way the caller must not store
    // these bytes, so fail before the PDF exists to store.
    const stamped = await page.evaluate(() =>
      document
        .querySelector('meta[name="print-chrome"]')
        ?.getAttribute("content"),
    );
    if (stamped !== chrome) {
      throw new Error(
        `print route rendered chrome ${stamped ?? "none"} for issue ${issueNumber}, ` +
          `expected ${chrome} — refusing to cache a PDF the key does not describe`,
      );
    }

    // networkidle can't see lazy images: next/image marks offscreen images
    // loading="lazy", and in this tall stacked document Chromium never fetches
    // the ones pages below the viewport — they'd print as gaps. Force every
    // image eager and wait for it to fetch + decode (a broken image resolves
    // rather than failing the whole PDF), then let fonts settle.
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) => {
          img.loading = "eager";
          return img.decode().catch(() => undefined);
        }),
      );
      await document.fonts.ready;
    });

    // The print page sizes each sheet to exactly PAGE_W×PAGE_H, so matching the
    // PDF page box to the same dimensions yields one PDF page per magazine page,
    // pixel-for-pixel with the flipbook. printBackground keeps the paper wash,
    // borders and sponsor tints; links (sponsors, rich-text) become PDF link
    // annotations automatically.
    const pdf = await page.pdf({
      width: `${PAGE_W}px`,
      height: `${PAGE_H}px`,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
