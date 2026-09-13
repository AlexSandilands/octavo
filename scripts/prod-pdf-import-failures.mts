import assert from "node:assert/strict";
import sharp from "sharp";
import {
  base,
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
  // Cancel and close while a selected image upload is in flight.
  await openFile(page);
  await region(page, "Image").click();
  let uploaded!: () => void, release!: () => void;
  const responseReady = new Promise<void>((resolve) => {
    uploaded = resolve;
  });
  const responseHeld = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Hold the response until cancellation and panel teardown complete.
  await page.route("**/api/admin/images", async (route) => {
    const response = await route.fetch();
    uploaded();
    await responseHeld;
    await route.fulfill({ response });
  });
  await addButton(page).click();
  await responseReady;
  // The rail is inert during Add; the panel's Cancel unlocks it.
  await panel(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await closeTool(page);
  await panel(page).waitFor({ state: "detached" });
  await page.waitForFunction(
    () => document.querySelector('[data-import-pending="true"]') === null,
  );
  const responseDone = page.waitForResponse("**/api/admin/images");
  release();
  await responseDone;
  assert.deepEqual(
    (await readDocument()).pages,
    saved.pages,
    "Cancelling and closing mid-upload leaves the issue unchanged.",
  );
  await page.unroute("**/api/admin/images");
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
  await closeTool(page);
  await page.waitForTimeout(500);
  assert.equal(closed, 1, "Closing the panel terminates the real worker.");
  // Storage succeeds while the issue is deleted under the image record insert.
  const { deleteIssue } = await import("../src/server/issues.ts");
  await fetch(harness + "?delayPutsMs=5000", { method: "POST" });
  const beforeRecord = await state();
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const request = context.request.post(`${base}/api/admin/images`, {
    multipart: {
      issueId: iid,
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
  await deleteIssue(iid);
  const afterDelete = await state();
  assert.equal((await request).status(), 409);
  const afterRecord = await state();
  assert.deepEqual(afterRecord.keys.sort(), afterDelete.keys.sort());
  assert(
    afterRecord.counts.delete > afterDelete.counts.delete,
    "Failed DB record compensates successful storage write.",
  );
  console.log(
    "PDF failure gate passed: retry reuse, cancel/close mid-upload, locked/signature/page limits, worker termination, concurrent deletion and compensating cleanup.",
  );
} finally {
  await fetch(harness + "?delayPutsMs=0&failPuts=0", { method: "POST" });
  await cleanup();
}
process.exit(0);
