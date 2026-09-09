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
} from "./pdf-import-gate-support.mts";
const number = await setup();
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
  const overlay = await page
    .getByRole("button", { name: /^Image region/ })
    .boundingBox();
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
  await page
    .getByRole("button", { name: "Magazine page 2", exact: true })
    .click();
  await page.locator(`[data-block-id="${prefixId}"]`).click();
  assert.equal(
    requests.some((r) => r.url.includes("pdfjs")),
    false,
    "Parser is lazy.",
  );
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  const beforeOpen = requests.length;
  await openFile(page);
  assert.equal(
    await page.getByRole("button", { name: /^Image region/ }).count(),
    1,
  );
  assert.equal(workers.length, 1);
  assert(workers[0]?.startsWith(base + "/pdfjs/"));
  await assertPhotoOverlay(page);
  await page
    .getByRole("button", { name: "Select text on this page", exact: true })
    .click();
  await page.getByRole("button", { name: /^Image region/ }).click();
  // Correct one body paragraph into a genuinely oversized paragraph.
  const longText = "Measured words preserve marks and order. ".repeat(180);
  await page
    .getByRole("textbox", { name: "Editable text preview", exact: true })
    .first()
    .fill(longText);
  await page
    .getByRole("button", { name: "Bold preview text", exact: true })
    .first()
    .click();
  const sourceButtons = page.getByRole("button", {
    name: /^Text region|^Image region/,
  });
  const beforeZoom = await sourceButtons.first().boundingBox();
  await page.getByRole("button", { name: "+", exact: true }).click();
  const afterZoom = await sourceButtons.first().boundingBox();
  assert(beforeZoom && afterZoom && afterZoom.width > beforeZoom.width);
  await assertPhotoOverlay(page);
  const forbidden = requests
    .slice(beforeOpen)
    .filter(
      (r) =>
        r.body.includes("A day by the river") ||
        r.body.includes("%PDF-") ||
        r.body.includes(longText) ||
        r.url.includes("single-column.pdf"),
    );
  assert.deepEqual(
    forbidden,
    [],
    "Opening/selecting/editing review sends no source content, including telemetry.",
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
  await page
    .getByRole("button", { name: "Add to magazine", exact: true })
    .click();
  await page.getByText(/Image upload failed/).waitFor({ timeout: 60000 });
  assert.deepEqual((await readDocument()).pages, initial.pages);
  fail = false;
  await page
    .getByRole("button", { name: "Add to magazine", exact: true })
    .dblclick();
  await waitAdded(page);
  assert.equal(
    uploads,
    2,
    "A duplicate Add gesture produces one successful upload.",
  );
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
  assert.equal(all.at(-1)?.type, "text");
  const contentText = all
    .filter((b) => b.type === "text")
    .map((b) => richTextToPlain(b.text))
    .join("");
  assert(contentText.includes(longText));
  assert(contentText.indexOf("PREFIX") < contentText.indexOf(longText));
  assert(contentText.indexOf(longText) < contentText.indexOf("SUFFIX"));
  for (let i = 1; i < added.pages.length - 1; i++) {
    await page
      .getByRole("button", { name: `Magazine page ${i + 1}`, exact: true })
      .click();
    await assertFits(page);
  }
  await page.screenshot({ path: "/tmp/pdf-import-desktop.png" });
  assert((await page.getByRole("button", { name: /, imported/ }).count()) > 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await settle(page);
  assert.deepEqual((await readDocument()).pages, initial.pages);
  assert.equal(
    await page.getByRole("button", { name: /, imported/ }).count(),
    0,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await settle(page);
  assert.deepEqual((await readDocument()).pages, added.pages);
  await page
    .getByRole("button", { name: "Close importer", exact: true })
    .click();
  await page.reload();
  await settle(page);
  assert.deepEqual((await readDocument()).pages, added.pages);
  await page
    .getByRole("button", { name: "Magazine page 2", exact: true })
    .click();
  await assertFits(page);
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  await openFile(page, "scripts/fixtures/pdf-import/two-column.pdf");
  assert.equal(
    await page.getByRole("button", { name: /^Image region/ }).count(),
    2,
  );
  await page.getByRole("button", { name: /^Text region 2/ }).focus();
  await page.keyboard.press("Space");
  assert.equal(
    await page
      .getByRole("textbox", { name: "Editable text preview", exact: true })
      .count(),
    1,
  );
  await page.getByRole("button", { name: "Split text", exact: true }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Editable text preview", exact: true })
      .count(),
    2,
  );
  await page
    .getByRole("button", { name: "Combine with next", exact: true })
    .first()
    .click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Editable text preview", exact: true })
      .count(),
    1,
  );
  await openFile(page, "scripts/fixtures/pdf-import/rotated.pdf");
  assert.equal(
    await page.getByRole("button", { name: /^Image region/ }).count(),
    1,
  );
  await assertPhotoOverlay(page);
  await page.getByRole("button", { name: "+", exact: true }).click();
  await assertPhotoOverlay(page);
  await openFile(page, "scripts/fixtures/pdf-import/scan-only.pdf");
  await page.getByText(/No extractable text/).waitFor();
  await page
    .getByLabel("Choose local PDF")
    .setInputFiles("scripts/fixtures/pdf-import/malformed.pdf");
  await page.getByText(/Could not read this PDF/).waitFor();
  await page.getByLabel("Choose local PDF").setInputFiles({
    name: "empty.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(0),
  });
  await page.getByText(/This file is empty/).waitFor();
  await page.getByLabel("Choose local PDF").setInputFiles({
    name: "large.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(41 * 1024 * 1024),
  });
  await page.getByText(/PDF is too large/).waitFor();
  await openFile(page);
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.screenshot({ path: "/tmp/pdf-import-min-width.png" });
  assert(
    await page
      .getByRole("button", { name: "Publish", exact: true })
      .isVisible(),
  );
  await page
    .getByRole("button", { name: "Select text on this page", exact: true })
    .click();
  // Concurrent publication cannot accept an import or a late draft save.
  await sql`update issues set status='published' where id=${iid}`;
  await page
    .getByRole("button", { name: "Add to magazine", exact: true })
    .click();
  await page
    .getByText(/Save the existing draft successfully/)
    .waitFor({ timeout: 45000 });
  assert.deepEqual((await readDocument()).pages, added.pages);
  await page
    .getByRole("button", { name: "Close importer", exact: true })
    .click();
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
