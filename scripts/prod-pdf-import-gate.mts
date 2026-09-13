// Run against next start with the local S3 test harness; see docs/pdf-import.md.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import type { Page as BrowserPage } from "playwright";
import { richTextToPlain } from "../src/lib/rich-text-doc.ts";
import {
  base,
  sql,
  browser,
  iid,
  token,
  prefixId,
  initial,
  setup,
  cleanup,
  readDocument,
  settle,
  openFile,
  waitAdded,
  assertFits,
  magazinePage,
  openTool,
  closeTool,
  fileInput,
  region,
  selectAll,
  addButton,
  status,
  panel,
  selectedRegions,
  addedRegions,
} from "./pdf-import-gate-support.mts";
const number = await setup();
async function zoomSource(page: BrowserPage) {
  const canvas = page.locator("[data-pdf-private] canvas");
  const before = (await canvas.boundingBox())!.width;
  await canvas.hover();
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(
    (width) =>
      document
        .querySelector("[data-pdf-private] canvas")!
        .getBoundingClientRect().width > width,
    before,
  );
}
async function assertPhotoOverlay(page: BrowserPage) {
  const bounds = await page
    .locator("[data-pdf-private] canvas")
    .evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width,
        top = canvas.height,
        right = -1,
        bottom = -1;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          const at = (y * canvas.width + x) * 4;
          if (
            pixels[at]! < 70 &&
            pixels[at + 1]! > 70 &&
            pixels[at + 1]! < 140 &&
            pixels[at + 2]! < 100
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
    });
  const overlay = await region(page, "Image").first().boundingBox();
  assert(overlay);
  for (const axis of ["x", "y", "width", "height"] as const)
    assert(
      Math.abs(bounds[axis] - overlay[axis]) < 2,
      `Raster and image hit target agree for ${axis}: ${JSON.stringify({ bounds, overlay })}`,
    );
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await context.newPage();
  const requests: { url: string; body: string }[] = [];
  const workers: string[] = [];
  const violations: string[] = [];
  page.on("worker", (w) => workers.push(w.url()));
  page.on("request", (r) =>
    requests.push({ url: r.url(), body: r.postData() ?? "" }),
  );
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) => {
      if (
        e.violatedDirective.includes("worker") ||
        e.blockedURI.includes("pdfjs")
      )
        throw new Error(`PDF CSP violation: ${e.violatedDirective}`);
    }),
  );
  page.on("pageerror", (e) => violations.push(e.message));
  await context.route(/\/api\/\d+\/envelope/, (route) =>
    route.fulfill({ status: 200, body: "{}" }),
  );
  const response = await page.goto(`${base}/admin/issues/${iid}/edit`);
  assert(
    response
      ?.headers()
      ["content-security-policy"]?.includes("worker-src 'self'"),
  );
  await magazinePage(page, 2).click();
  await page.locator(`[data-block-id="${prefixId}"]`).click();
  assert.equal(
    requests.some((r) => r.url.includes("pdfjs")),
    false,
    "Parser is lazy.",
  );
  // The panel slides in beside the canvas and the handle resizes it.
  await openTool(page);
  const handle = page.getByRole("separator", { name: "Resize panel" });
  await handle.waitFor();
  const canvas = page.locator("[data-page-frame]").first();
  const widthBefore = Number(await handle.getAttribute("aria-valuenow"));
  const canvasBefore = (await canvas.boundingBox())!.width;
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  assert(Number(await handle.getAttribute("aria-valuenow")) > widthBefore);
  await page.waitForTimeout(400);
  assert((await canvas.boundingBox())!.width < canvasBefore, "Canvas re-fits.");
  const beforeOpen = requests.length;
  await openFile(page);
  assert.equal(await region(page, "Image").count(), 1);
  assert.equal(workers.length, 1);
  assert(workers[0]?.startsWith(base + "/pdfjs/"));
  await assertPhotoOverlay(page);
  // A press selects with the detector's suggestion; the pill retypes it.
  const heading = region(page, "Heading").first();
  await heading.click();
  assert.equal(await heading.getAttribute("aria-pressed"), "true");
  await heading.hover();
  await panel(page)
    .getByRole("group", { name: "Selected region" })
    .getByRole("button", { name: "Text", exact: true })
    .click();
  assert.equal(await region(page, "Heading").count(), 0);
  await region(page, "Text").first().hover();
  await panel(page)
    .getByRole("group", { name: "Selected region" })
    .getByRole("button", { name: "Heading", exact: true })
    .click();
  assert.equal(await region(page, "Heading").count(), 1);
  await selectAll(page);
  await page.getByRole("button", { name: /^\d+ selected$/ }).click();
  const rows = page.locator("#pdf-import-selection li");
  assert.equal(await rows.count(), await selectedRegions(page).count());
  await page.getByRole("button", { name: /^\d+ selected$/ }).click();
  const sourceButtons = panel(page).locator("button[data-region]");
  const beforeZoom = await sourceButtons.first().boundingBox();
  await zoomSource(page);
  const afterZoom = await sourceButtons.first().boundingBox();
  assert(beforeZoom && afterZoom && afterZoom.width > beforeZoom.width);
  await assertPhotoOverlay(page);
  const forbidden = requests
    .slice(beforeOpen)
    .filter(
      (r) =>
        r.body.includes("A day by the river") ||
        r.body.includes("%PDF-") ||
        r.url.includes("single-column.pdf"),
    );
  assert.deepEqual(
    forbidden,
    [],
    "Opening and selecting sends no source content, including telemetry.",
  );
  // Upload failure leaves no inserted text or pages; completed images survive retry.
  let uploads = 0,
    fail = true;
  await page.route("**/api/admin/images", async (route) => {
    uploads++;
    if (fail) {
      await route.fulfill({
        status: 503,
        json: { error: "Injected upload outage" },
      });
      return;
    }
    await route.continue();
  });
  await addButton(page).click();
  await status(page)
    .getByText(/Image upload failed/)
    .waitFor({ timeout: 60000 });
  assert.deepEqual((await readDocument()).pages, initial.pages);
  assert(
    (await selectedRegions(page).count()) > 0,
    "The selection survives a failed batch.",
  );
  fail = false;
  await addButton(page).dblclick();
  await waitAdded(page);
  assert.equal(
    uploads,
    2,
    "A duplicate Add gesture produces one successful upload.",
  );
  assert((await region(page, "Text").count()) > 0);
  assert((await addedRegions(page).count()) > 0, "Added regions say so.");
  // A paragraph taller than a page is split by measurement, in order.
  await openFile(page, "scripts/fixtures/pdf-import/long-paragraph.pdf");
  await selectAll(page);
  await addButton(page).click();
  await waitAdded(page);
  const added = await readDocument();
  assert(
    added.pages.length > initial.pages.length,
    "Oversized paragraph creates continuation pages.",
  );
  assert.deepEqual(
    added.pages.at(-1),
    initial.pages.at(-1),
    "Later authored page untouched.",
  );
  const all = added.pages.flatMap((p) => p.blocks);
  assert.equal(all[0]?.id, prefixId);
  const contentText = all
    .filter((b) => b.type === "text")
    .map((b) => richTextToPlain(b.text))
    .join(" ");
  for (let i = 1; i <= 60; i++)
    assert(
      contentText.includes(`Line ${String(i).padStart(2, "0")} measured`),
      `Line ${i} survives the split.`,
    );
  assert(contentText.indexOf("PREFIX") < contentText.indexOf("Line 01"));
  assert(contentText.indexOf("Line 60") < contentText.indexOf("SUFFIX"));
  assert(contentText.indexOf("Line 01") < contentText.indexOf("Line 60"));
  for (let i = 1; i < added.pages.length - 1; i++) {
    await magazinePage(page, i + 1).click();
    await assertFits(page);
  }
  await page.screenshot({ path: "/tmp/pdf-import-desktop.png" });
  assert((await addedRegions(page).count()) > 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await settle(page);
  assert.equal(
    await addedRegions(page).count(),
    0,
    "Undo clears the added marks.",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await settle(page);
  assert.deepEqual((await readDocument()).pages, added.pages);
  await closeTool(page);
  await page.reload();
  await settle(page);
  assert.deepEqual((await readDocument()).pages, added.pages);
  await magazinePage(page, 2).click();
  await assertFits(page);
  // Keyboard: a region toggles from the keyboard and its pill can split it.
  await openTool(page);
  await openFile(page, "scripts/fixtures/pdf-import/two-column.pdf");
  assert.equal(await region(page, "Image").count(), 2);
  const textRegions = await region(page, "Text").count();
  await region(page, "Text").nth(1).focus();
  await page.keyboard.press("Space");
  assert.equal(
    await region(page, "Text").nth(1).getAttribute("aria-pressed"),
    "true",
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "Split",
  );
  await page.keyboard.press("Enter");
  assert.equal(await region(page, "Text").count(), textRegions + 1);
  assert.equal(
    await selectedRegions(page).count(),
    0,
    "A split region leaves the selection.",
  );
  await openFile(page, "scripts/fixtures/pdf-import/rotated.pdf");
  assert.equal(await region(page, "Image").count(), 1);
  await assertPhotoOverlay(page);
  await zoomSource(page);
  await assertPhotoOverlay(page);
  await openFile(page, "scripts/fixtures/pdf-import/scan-only.pdf");
  await panel(page)
    .getByText(/No text can be picked up/)
    .waitFor();
  await fileInput(page).setInputFiles(
    "scripts/fixtures/pdf-import/malformed.pdf",
  );
  await panel(page)
    .getByText(/Could not read this PDF/)
    .waitFor();
  await fileInput(page).setInputFiles({
    name: "empty.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(0),
  });
  await panel(page)
    .getByText(/This file is empty/)
    .waitFor();
  await fileInput(page).setInputFiles({
    name: "large.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(41 * 1024 * 1024),
  });
  await panel(page)
    .getByText(/PDF is too large/)
    .waitFor();
  await openFile(page);
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/pdf-import-min-width.png" });
  const rail = await page
    .getByRole("button", { name: "Import PDF", exact: true })
    .boundingBox();
  assert(rail && rail.x + rail.width <= 768, "Tool rail stays on screen.");
  assert(
    await page
      .getByRole("button", { name: "Publish", exact: true })
      .isVisible(),
  );
  await selectAll(page);
  // Import is an ordinary edit: publishing mid-session doesn't block it, only
  // a stale revision would (the same check any other save is subject to).
  await sql`update issues set status='published' where id=${iid}`;
  await addButton(page).click();
  await waitAdded(page);
  const publishedDoc = await readDocument();
  assert(
    publishedDoc.pages.flatMap((p) => p.blocks).length >
      added.pages.flatMap((p) => p.blocks).length,
    "Import lands on a published issue.",
  );
  await closeTool(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/read/${number}`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .locator("[data-reader-block]")
    .filter({ hasText: "A day by the river" })
    .first()
    .waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "/tmp/pdf-import-reader-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByText("A day by the river", { exact: true }).first().waitFor();
  const mobilePhoto = page.locator("img").first();
  await mobilePhoto.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const image = document.querySelector("img");
    return image?.complete && image.naturalWidth > 0;
  });
  await mobilePhoto.evaluate(async (element) => {
    const image = element as HTMLImageElement;
    await image.decode();
    if (!image.naturalWidth)
      throw new Error("Imported photo did not load in the mobile reader.");
  });
  await page.screenshot({ path: "/tmp/pdf-import-reader-mobile-photo.png" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/pdf-import-reader-mobile.png",
    fullPage: true,
  });
  const pdf = await context.request.get(`${base}/api/issues/${number}/pdf`, {
    timeout: 120000,
  });
  assert.equal(pdf.status(), 200);
  await writeFile("/tmp/pdf-import-output.pdf", await pdf.body());
  assert.deepEqual(violations, []);
  console.log(
    JSON.stringify({
      result: "passed",
      browser: browser.version(),
      pages: added.pages.length,
      uploads,
      realWorkers: workers.length,
      telemetryEnabled:
        requests.some((r) => r.url.includes("sentry")) ||
        Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      artifacts: "/tmp/pdf-import-*.png and /tmp/pdf-import-output.pdf",
    }),
  );
} finally {
  await cleanup();
}
process.exit(0);
