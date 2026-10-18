// Cropped photos (#404): a photo under a rectangular clip, and one bleeding off
// the page, import as what the page shows. Run like prod-pdf-import-gate.mts;
// extra PDF paths after the URL are opened, their image regions reported and
// each page shot to /tmp/pdf-import-crop-<k>-p<n>.png (the k-th extra PDF).
import assert from "node:assert/strict";
import sharp from "sharp";
import type { Page as BrowserPage } from "playwright";
import {
  base,
  browser,
  token,
  iid,
  setup,
  cleanup,
  openTool,
  openFile,
  region,
  addButton,
  waitAdded,
  nextPage,
  panel,
} from "./pdf-import-gate-support.mts";
await setup();
// The source canvas's bounds of pixels close to `rgb` in its top or bottom
// half, in page coordinates.
async function rasterBounds(
  page: BrowserPage,
  rgb: number[],
  half: "top" | "bottom",
) {
  return page.locator("[data-pdf-private] canvas").evaluate(
    (element, [colour, half]) => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width,
        top = canvas.height,
        right = -1,
        bottom = -1;
      const middle = Math.round(canvas.height / 2);
      const [from, to] = half === "top" ? [0, middle] : [middle, canvas.height];
      for (let y = from; y < to; y++)
        for (let x = 0; x < canvas.width; x++) {
          const at = (y * canvas.width + x) * 4;
          if (
            (colour as number[]).every(
              (c, i) => Math.abs(pixels[at + i]! - c) < 40,
            )
          ) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.x + (left / canvas.width) * rect.width,
        y: rect.y + (top / canvas.height) * rect.height,
        width: ((right - left + 1) / canvas.width) * rect.width,
        height: ((bottom - top + 1) / canvas.height) * rect.height,
      };
    },
    [rgb, half] as const,
  );
}
function near(a: { [k: string]: number }, b: { [k: string]: number }) {
  for (const axis of ["x", "y", "width", "height"])
    assert(
      Math.abs(a[axis]! - b[axis]!) < 2,
      `Region and raster agree for ${axis}: ${JSON.stringify({ a, b })}`,
    );
}
const blue = [0x21, 0x56, 0xa5],
  yellow = [0xe0, 0xb0, 0x20];
// The mean colour of a horizontal band of an uploaded image.
async function band(png: Buffer, top: number, height: number) {
  const { width } = await sharp(png).metadata();
  // stats() reads its input, so the band is cut out first.
  const cut = await sharp(png)
    .extract({ left: 0, top, width: width!, height })
    .toBuffer();
  const { channels } = await sharp(cut).stats();
  return channels.slice(0, 3).map((c) => c.mean);
}
const close = (a: number[], b: number[]) =>
  a.every((v, i) => Math.abs(v - b[i]!) < 30);
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route(/\/api\/\d+\/envelope/, (route) =>
    route.fulfill({ status: 200, body: "{}" }),
  );
  const uploads: Buffer[] = [];
  await page.route("**/api/admin/images", async (route) => {
    const body = route.request().postDataBuffer()!;
    // The multipart body's PNG, from its signature to the end of IEND.
    const start = body.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const end = body.indexOf("IEND", start) + 8;
    if (start >= 0 && end > start) uploads.push(body.subarray(start, end));
    await route.continue();
  });
  await page.goto(`${base}/admin/issues/${iid}/edit`);
  await openTool(page);
  await openFile(page, "scripts/fixtures/pdf-import/cropped.pdf");
  const images = region(page, "Image");
  assert.equal(await images.count(), 2, "Both cropped photos are selectable.");
  assert.equal(
    await panel(page)
      .getByText(/cannot be faithfully extracted/)
      .count(),
    0,
  );
  // The clipped photo's region is exactly its visible blue quadrant.
  near(
    (await images.nth(0).boundingBox())!,
    await rasterBounds(page, blue, "top"),
  );
  // The bleeding photo's region starts at the page's left edge.
  const canvas = (await page
    .locator("[data-pdf-private] canvas")
    .boundingBox())!;
  const bleed = (await images.nth(1).boundingBox())!;
  assert(Math.abs(bleed.x - canvas.x) < 2, "The bleed is cut at the page.");
  const yellowBounds = await rasterBounds(page, yellow, "bottom");
  assert(
    Math.abs(bleed.x + bleed.width - (yellowBounds.x + yellowBounds.width)) < 2,
  );
  await images.nth(0).click();
  await images.nth(1).click();
  await addButton(page).click();
  await waitAdded(page);
  assert.equal(uploads.length, 2);
  const [quadrant, half] = await Promise.all(
    uploads.map(async (png) => ({ png, meta: await sharp(png).metadata() })),
  );
  // 160 × 80 points of a 320 × 160 placement of a 400 × 200 photo.
  assert.deepEqual([quadrant!.meta.width, quadrant!.meta.height], [200, 100]);
  assert(close(await band(quadrant!.png, 0, 100), blue), "Only blue.");
  // The right half on the page: blue over yellow.
  assert.deepEqual([half!.meta.width, half!.meta.height], [200, 200]);
  assert(close(await band(half!.png, 0, 100), blue), "Top is blue.");
  assert(close(await band(half!.png, 100, 100), yellow), "Bottom is yellow.");
  // Any extra PDFs: report each page's selectable photos and notes.
  for (const [f, file] of process.argv.slice(3).entries()) {
    await openFile(page, file);
    const counter = await panel(page)
      .getByText(/^\d+ \/ \d+$/)
      .textContent();
    const pages = Number(counter!.split(" / ")[1]);
    for (let n = 1; n <= pages; n++) {
      if (n > 1) {
        await nextPage(page);
        await panel(page).getByText(`${n} / ${pages}`).waitFor();
        // Paging is busy until the page's regions are in.
        await page
          .locator(
            'button[aria-label="Previous PDF page"]:not([aria-disabled])',
          )
          .waitFor();
      }
      const notes = await panel(page)
        .getByText(/cannot|unsupported|exceeds/)
        .allTextContents();
      // Each photo's detected size (pressed in its pill) and its share of the
      // page's content span, from the overlays.
      const sizes: string[] = [];
      for (let i = 0; i < (await images.count()); i++) {
        const photo = images.nth(i);
        await photo.click();
        await photo.hover();
        const pressed = await panel(page)
          .getByRole("group", { name: "Selected region" })
          .getByRole("group", { name: "Size" })
          .locator("button[aria-pressed='true']")
          .textContent();
        const share = await photo.evaluate((el) => {
          const rects = [
            ...document.querySelectorAll(
              "[data-pdf-private] [data-region-overlay]",
            ),
          ].map((o) => o.getBoundingClientRect());
          const left = Math.min(...rects.map((r) => r.left));
          const right = Math.max(...rects.map((r) => r.right));
          return Math.round(
            (el.getBoundingClientRect().width / (right - left)) * 100,
          );
        });
        sizes.push(`${pressed} (${share}% of the content)`);
        await photo.click();
      }
      console.log(`${file} p${n}: ${sizes.length} photos`, sizes, notes);
      await panel(page).screenshot({
        path: `/tmp/pdf-import-crop-${f + 1}-p${n}.png`,
      });
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "passed", uploads: uploads.length }));
} finally {
  await cleanup();
}
process.exit(0);
