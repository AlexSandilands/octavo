// #256: a populated legacy destination at the upload-rounding boundary.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { Page as BrowserPage } from "playwright";
import { printToken } from "../src/lib/pdf-token.ts";
import { type Block, issueContentSchema } from "../src/lib/blocks.ts";
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
  region,
  addButton,
  status,
  addedRegions,
} from "./pdf-import-gate-support.mts";

async function assertRenderedFits(page: BrowserPage) {
  await page.locator("[data-page-frame]").first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => {
        img.loading = "eager";
        return img.decode();
      }),
    );
  });
  const overflow = await page
    .locator("[data-page-frame]")
    .evaluateAll((frames) =>
      frames.flatMap((frame) => {
        const footer = frame.querySelector("[data-page-footer]");
        if (!footer) return [];
        const scale =
          frame.getBoundingClientRect().height /
          (frame as HTMLElement).offsetHeight;
        return [...frame.querySelectorAll("[data-reader-block]")]
          .filter(
            (block) =>
              block.getBoundingClientRect().bottom >
              footer.getBoundingClientRect().top - 5 * scale,
          )
          .map((block) => block.textContent);
      }),
    );
  assert.deepEqual(
    overflow,
    [],
    "Persisted reader/print pages fit the real footer.",
  );
}

try {
  const number = await setup();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const legacyPng = await sharp({
    create: { width: 800, height: 800, channels: 3, background: "#8b6942" },
  })
    .png()
    .toBuffer();
  const upload = await context.request.post(`${base}/api/admin/images`, {
    multipart: {
      issueId: iid,
      file: { name: "legacy.png", mimeType: "image/png", buffer: legacyPng },
    },
  });
  assert.equal(upload.status(), 200);
  const legacyImage = (await upload.json()) as { imageId: string };
  await sql`update images set width=null,height=null,created_at='2024-01-01' where id=${legacyImage.imageId}`;
  const prefix: Block = {
    id: prefixId,
    type: "image",
    imageId: legacyImage.imageId,
    caption: "",
    align: "full",
    width: 50,
  };
  const occupied = issueContentSchema.parse({
    ...initial,
    version: 1,
    pages: initial.pages.map((page, index) =>
      index === 1
        ? {
            ...page,
            blocks: [
              prefix,
              {
                ...page.blocks[1],
                text: "SUFFIX legacy authored text stays after the selection.",
              },
            ],
          }
        : page,
    ),
  });
  const reset = async () => {
    await sql`update issues set content=${sql.json(occupied)},created_at='2024-01-01',revision=revision+1 where id=${iid}`;
  };
  await reset();
  const page = await context.newPage();
  await page.goto(`${base}/admin/issues/${iid}/edit`);
  await magazinePage(page, 2).click();
  await settle(page);
  // Calibrate using real editor markup. Only the stored legacy photo's width
  // changes; no CSS or layout mocks are active during the import itself.
  const sourcePng = await sharp({
    create: { width: 2401, height: 1200, channels: 3, background: "#246544" },
  })
    .png()
    .toBuffer();
  prefix.width = await page.evaluate(
    async ({ id, source }) => {
      await document.fonts.ready;
      const block = document.querySelector<HTMLElement>(
        `[data-block-id="${id}"]`,
      )!;
      await block.querySelector("img")!.decode();
      const frame = block.closest<HTMLElement>("[data-page-frame]")!;
      const scale = frame.getBoundingClientRect().height / frame.offsetHeight;
      const limit =
        frame.querySelector<HTMLElement>("[data-page-footer]")!.offsetTop - 6;
      const clone = block.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-block-id");
      clone.style.width = "100%";
      const photo = clone.querySelector("img")!;
      photo.src = source;
      block.after(clone);
      await photo.decode();
      const bottom =
        (clone.getBoundingClientRect().bottom -
          frame.getBoundingClientRect().top) /
        scale;
      const columnWidth =
        block.parentElement!.getBoundingClientRect().width / scale;
      // Source fits at +0.45px (the measurer allows +0.5px); resized WebP gains
      // about 0.12px, crossing that boundary without any exaggerated response.
      const width = 50 + ((limit + 0.45 - bottom) / columnWidth) * 100;
      block.style.width = `${width}%`;
      const measured =
        (clone.getBoundingClientRect().bottom -
          frame.getBoundingClientRect().top) /
        scale;
      if (measured > limit + 0.5 || measured < limit + 0.4)
        throw new Error(`Boundary calibration failed: ${measured} vs ${limit}`);
      clone.remove();
      return width;
    },
    {
      id: prefixId,
      source: `data:image/png;base64,${sourcePng.toString("base64")}`,
    },
  );
  Object.assign(occupied.pages[1]!.blocks[0]!, prefix);
  await reset();
  await page.reload();
  await magazinePage(page, 2).click();
  await page.locator(`[data-block-id="${prefixId}"]`).click();
  await openTool(page);
  await openFile(page, "scripts/fixtures/pdf-import/resize-boundary.pdf");
  await region(page, "Image").click();
  let uploads = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/admin/images"))
      uploads++;
  });
  await addButton(page).click();
  await page.waitForFunction(
    () => !document.querySelector('[data-import-pending="true"]'),
    undefined,
    { timeout: 60000 },
  );
  assert.match(
    await status(page).innerText(),
    /Added \d+ blocks? to the magazine\./,
  );
  await waitAdded(page);
  assert.equal(
    await addedRegions(page).count(),
    1,
    "The final source mapping marks the imported region.",
  );
  const saved = await readDocument();
  assert.equal(uploads, 1);
  assert.deepEqual(
    saved.pages.at(-1),
    occupied.pages.at(-1),
    "Later authored page stays intact.",
  );
  assert.deepEqual(
    saved.pages[1]!.blocks,
    [prefix],
    "The final image reflows off the full legacy destination.",
  );
  const blocks = saved.pages.flatMap((p) => p.blocks);
  assert.equal(blocks[0]!.id, prefixId);
  assert.equal(blocks[1]!.type, "image");
  assert.equal(blocks[2]!.id, occupied.pages[1]!.blocks[1]!.id);
  const imported = blocks[1]!;
  assert(imported.type === "image");
  const [record] =
    await sql`select width,height from images where id=${imported.imageId!}`;
  assert.deepEqual(record, { width: 2000, height: 1000 });
  await closeTool(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await settle(page);
  assert.deepEqual((await readDocument()).pages, occupied.pages);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await settle(page);
  await page.reload();
  assert.deepEqual((await readDocument()).pages, saved.pages);
  for (let n = 2; n < saved.pages.length; n++) {
    await magazinePage(page, n).click();
    await page.locator("[data-page-frame] img").evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
    });
    await assertFits(page);
  }
  await page.screenshot({ path: "/tmp/pdf-import-legacy-editor.png" });
  await sql`update issues set status='published' where id=${iid}`;
  await page.goto(`${base}/read/${number}`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByText(`2–3 / ${saved.pages.length}`, { exact: true })
    .waitFor();
  await page.locator("[data-reader-block] img").first().waitFor();
  await assertRenderedFits(page);
  await page.screenshot({ path: "/tmp/pdf-import-legacy-reader.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page
    .getByText("SUFFIX legacy authored text stays after the selection.", {
      exact: true,
    })
    .waitFor();
  const mobileImages = page.locator("img");
  assert.equal(await mobileImages.count(), 2);
  for (const img of await mobileImages.all()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((element) => (element as HTMLImageElement).decode());
  }
  await page.screenshot({ path: "/tmp/pdf-import-legacy-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/read/${number}/print?token=${printToken()}`);
  await assertRenderedFits(page);
  const pdf = await context.request.get(`${base}/api/issues/${number}/pdf`, {
    timeout: 120000,
  });
  assert.equal(pdf.status(), 200);
  await writeFile("/tmp/pdf-import-legacy-output.pdf", await pdf.body());
  // A final-fit failure after a successful upload must leave the document and
  // history untouched, and retry must reuse that exact stored image record.
  await reset();
  await page.goto(`${base}/admin/issues/${iid}/edit`);
  await magazinePage(page, 2).click();
  await page.locator(`[data-block-id="${prefixId}"]`).click();
  await openTool(page);
  await openFile(page, "scripts/fixtures/pdf-import/resize-boundary.pdf");
  await region(page, "Image").click();
  let failedUrl = "",
    failedId = "";
  await page.route("**/api/admin/images", async (route) => {
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    const uploaded = (await response.json()) as {
      url: string;
      imageId: string;
    };
    failedUrl = uploaded.url;
    failedId = uploaded.imageId;
    await context.route(failedUrl, (imageRoute) => imageRoute.abort("failed"));
    await route.fulfill({ response });
  });
  await addButton(page).click();
  await status(page)
    .getByText(/Could not load an image|image could not be loaded/)
    .waitFor({ timeout: 45000 });
  assert.deepEqual((await readDocument()).pages, occupied.pages);
  assert.equal(await addedRegions(page).count(), 0);
  assert(
    await page.getByRole("button", { name: "Undo", exact: true }).isDisabled(),
  );
  const recordsAfterFailure =
    await sql`select id from images where issue_id=${iid} order by id`;
  assert.equal(
    recordsAfterFailure.length,
    3,
    "Legacy photo and two successful imported uploads.",
  );
  await context.unroute(failedUrl);
  await page.unroute("**/api/admin/images");
  await addButton(page).click();
  await waitAdded(page);
  assert.equal(uploads, 2, "Retry sends no duplicate upload.");
  assert.deepEqual(
    await sql`select id from images where issue_id=${iid} order by id`,
    recordsAfterFailure,
  );
  const retried = await readDocument();
  assert(
    retried.pages
      .flatMap((p) => p.blocks)
      .some((b) => b.type === "image" && b.imageId === failedId),
  );
  assert.deepEqual(retried.pages.at(-1), occupied.pages.at(-1));
  console.log(
    JSON.stringify({
      result: "passed",
      pages: saved.pages.length,
      uploads,
      legacyWidth: prefix.width,
      resized: record,
    }),
  );
} finally {
  await cleanup();
}
process.exit(0);
