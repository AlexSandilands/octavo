import "server-only";
import sharp from "sharp";
import { PAGE_W, PAGE_H } from "@/features/blocks/page-frame";
import { AI_MAX_IMAGE_BASE64 } from "@/lib/ai-tools";
import type { AiRenderedPage } from "@/lib/ai-vision-contract";
import {
  ChromiumUnavailableError,
  launchPrintBrowser,
  selfOrigin,
} from "@/lib/pdf";
import { printToken } from "@/lib/pdf-token";

export { ChromiumUnavailableError };

// Pictures of draft pages for the assistant (#342), the way the PDF generator
// prints published ones (src/lib/pdf.ts): headless Chromium loads the print
// page over localhost with the internal token and screenshots each requested
// `.pdf-page` at 1.5× — 960×1350, about 1.7k tokens to the model. Each page
// also reports its fill, measured on the print layout with the overflow
// marker's geometry (features/editor/page-metrics.ts).

const SCALE = 1.5;
/** page-metrics' FOOTER_GUTTER: the text area ends this far above the footer. */
const FOOTER_GUTTER = 6;

/** Each requested page (1-based) that exists; `cover` comes from the content. */
export async function renderDraftPages(
  nonce: string,
  pages: { page: number; cover: boolean }[],
): Promise<AiRenderedPage[]> {
  const browser = await launchPrintBrowser();
  try {
    const tab = await browser.newPage({
      viewport: { width: PAGE_W, height: PAGE_H },
      deviceScaleFactor: SCALE,
    });
    const url = `${selfOrigin()}/read/draft/${nonce}/print?token=${printToken()}`;
    const res = await tab.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (!res?.ok())
      throw new Error(
        `draft print page returned ${res?.status() ?? "nothing"}`,
      );
    const count = await tab.locator(".pdf-page").count();

    const out: AiRenderedPage[] = [];
    for (const { page, cover } of pages) {
      if (page > count) continue;
      const box = tab.locator(".pdf-page").nth(page - 1);
      await box.scrollIntoViewIfNeeded();
      // Photos below the fold load lazily: fetch and decode this page's first.
      await box.evaluate(async (el) => {
        await Promise.all(
          Array.from(el.querySelectorAll("img")).map((img) => {
            img.loading = "eager";
            return img.decode().catch(() => undefined);
          }),
        );
        await document.fonts.ready;
      });
      const fill = await box.evaluate(measure, FOOTER_GUTTER);
      const png = await box.screenshot({ type: "png" });
      out.push({ page, cover, fill, ...(await fitForModel(png)) });
    }
    return out;
  } finally {
    await browser.close();
  }
}

/** A PNG unless that is over the tool result's cap; a photo-heavy page goes as JPEG. */
async function fitForModel(
  png: Buffer,
): Promise<Pick<AiRenderedPage, "mediaType" | "data">> {
  const data = png.toString("base64");
  if (data.length <= AI_MAX_IMAGE_BASE64)
    return { mediaType: "image/png", data };
  const jpeg = await sharp(png).jpeg({ quality: 82 }).toBuffer();
  return { mediaType: "image/jpeg", data: jpeg.toString("base64") };
}

/**
 * Runs in the page: the same geometry `measurePageFill` reads in the editor —
 * from the top of the text area to the lowest block, against the room above
 * the running footer. A cover or a full-page photo has no footer and no fill.
 */
function measure(el: Element, gutter: number) {
  const frame = el.querySelector<HTMLElement>("[data-page-frame]");
  const footer = frame?.querySelector<HTMLElement>("[data-page-footer]");
  const blocks = frame
    ? Array.from(frame.querySelectorAll<HTMLElement>("[data-reader-block]"))
    : [];
  if (!frame || !footer) return null;
  const within = (node: HTMLElement) => {
    let top = 0;
    let at: HTMLElement | null = node;
    while (at && at !== frame) {
      top += at.offsetTop;
      at = at.offsetParent as HTMLElement | null;
    }
    return at === frame ? top : null;
  };
  const limit = footer.offsetTop - gutter;
  const container = blocks[0]?.parentElement;
  const contentTop = container ? (within(container) ?? 0) : limit;
  let bottom = contentTop;
  for (const block of blocks) {
    const top = within(block);
    if (top !== null) bottom = Math.max(bottom, top + block.offsetHeight);
  }
  return { used: bottom - contentTop, avail: limit - contentTop };
}
