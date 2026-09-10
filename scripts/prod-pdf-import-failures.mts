import assert from "node:assert/strict";
import sharp from "sharp";
import {
  base,
  sql,
  browser,
  iid,
  token,
  initial,
  setup,
  cleanup,
  readDocument,
  openFile,
  waitAdded,
  openTool,
  closeTool,
  fileInput,
  region,
  addButton,
  nextPage,
  status,
  panel,
} from "./pdf-import-gate-support.mts";
await setup();
const harness = "http://127.0.0.1:19923/_gate";
const state = async () =>
  (await (await fetch(harness)).json()) as {
    counts: { put: number; delete: number };
    keys: string[];
  };
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await context.newPage();
  await page.goto(`${base}/admin/issues/${iid}/edit`);
  await openTool(page);
  await openFile(page);
  await region(page, "Image").click();
  await nextPage(page);
  await panel(page).getByText("2 / 2", { exact: true }).waitFor();
  await region(page, "Image").click();
  let count = 0;
  await page.route("**/api/admin/images", async (route) => {
    count++;
    if (count === 2)
      await route.fulfill({
        status: 503,
        json: { error: "Second upload failed" },
      });
    else await route.continue();
  });
  await addButton(page).click();
  await status(page)
    .getByText(/Image upload failed/)
    .waitFor({ timeout: 45000 });
  assert.deepEqual((await readDocument()).pages, initial.pages);
  await addButton(page).click();
  await waitAdded(page);
  assert.equal(count, 3, "Retry reuses the first successful upload.");
  await page.unroute("**/api/admin/images");
  const saved = await readDocument();
  // Navigation and closing while a selected image upload is in flight.
  await openFile(page);
  await region(page, "Image").click();
  await fetch(harness + "?delayPutsMs=800", { method: "POST" });
  const beforeCancel = await state();
  await addButton(page).click();
  for (
    let tries = 0;
    tries < 100 && (await state()).counts.put === beforeCancel.counts.put;
    tries++
  )
    await new Promise((r) => setTimeout(r, 20));
  assert((await state()).counts.put > beforeCancel.counts.put);
  await closeTool(page);
  await page.waitForFunction(
    () => document.querySelector('[data-import-pending="true"]') === null,
  );
  await page.waitForTimeout(1100);
  assert.deepEqual(
    (await readDocument()).pages,
    saved.pages,
    "Closing the panel mid-upload cancels the Add.",
  );
  await fetch(harness + "?delayPutsMs=0", { method: "POST" });
  await openTool(page);
  await fileInput(page).setInputFiles("scripts/fixtures/pdf-import/locked.pdf");
  await panel(page)
    .getByText(/password protected/)
    .waitFor();
  await fileInput(page).setInputFiles(
    "scripts/fixtures/pdf-import/too-many-pages.pdf",
  );
  await panel(page)
    .getByText(/100 source-page limit/)
    .waitFor();
  await fileInput(page).setInputFiles({
    name: "fake.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await panel(page)
    .getByText(/PDF signature/)
    .waitFor();
  let closed = 0;
  page.on("worker", (worker) => worker.on("close", () => closed++));
  await openFile(page);
  await page.getByRole("button", { name: "Close PDF", exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(closed, 1, "Close PDF terminates the real worker.");
  await openFile(page);
  await closeTool(page);
  await page.waitForTimeout(500);
  assert.equal(closed, 2, "Closing the panel releases the PDF too.");
  // Storage succeeds while publication races with image record insertion.
  await fetch(harness + "?delayPutsMs=600", { method: "POST" });
  const beforeRecord = await state();
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const request = context.request.post(`${base}/api/admin/images`, {
    multipart: {
      issueId: iid,
      importDraft: "true",
      file: { name: "selected-image.png", mimeType: "image/png", buffer: png },
    },
  });
  for (
    let tries = 0;
    tries < 100 && (await state()).counts.put === beforeRecord.counts.put;
    tries++
  )
    await new Promise((r) => setTimeout(r, 20));
  assert((await state()).counts.put > beforeRecord.counts.put);
  await sql`update issues set status='published' where id=${iid}`;
  assert.equal((await request).status(), 409);
  const afterRecord = await state();
  assert.deepEqual(afterRecord.keys.sort(), beforeRecord.keys.sort());
  assert(
    afterRecord.counts.delete > beforeRecord.counts.delete,
    "Failed DB record compensates successful storage write.",
  );
  const rejected = await context.request.post(`${base}/api/admin/images`, {
    multipart: {
      issueId: iid,
      importDraft: "true",
      file: { name: "selected-image.png", mimeType: "image/png", buffer: png },
    },
  });
  assert.equal(rejected.status(), 409);
  assert.equal(
    (await state()).counts.put,
    afterRecord.counts.put,
    "Published destination rejected before storing.",
  );
  console.log(
    "PDF failure gate passed: retry reuse, close-mid-upload cancel, locked/signature/page limits, worker termination, concurrent publication and compensating cleanup.",
  );
} finally {
  await fetch(harness + "?delayPutsMs=0&failPuts=0", { method: "POST" });
  await cleanup();
}
process.exit(0);
