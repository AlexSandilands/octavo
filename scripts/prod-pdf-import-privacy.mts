import assert from "node:assert/strict";
import {
  base,
  browser,
  iid,
  token,
  setup,
  cleanup,
  openFile,
  openTool,
  magazinePage,
  closeTool,
  fileInput,
  region,
  nextPage,
  panel,
} from "./pdf-import-gate-support.mts";
await setup();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const envelopes: string[] = [];
  await context.route(/\/api\/\d+\/envelope/, async (route) => {
    envelopes.push(route.request().postData() ?? "");
    await route.fulfill({ status: 200, body: "{}" });
  });
  const page = await context.newPage();
  await page.goto(`${base}/admin/issues/${iid}/edit`);
  // Import PDF steps aside on the cover the editor opens on (#287).
  await magazinePage(page, 2).click();
  await openTool(page);
  await openFile(page);
  await region(page, "Text").nth(1).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "PRIVATE-PDF-CANARY-223",
        error: new Error("PRIVATE-PDF-CANARY-223"),
      }),
    ),
  );
  await page.waitForTimeout(300);
  assert.equal(
    envelopes.some((body) => body.includes("PRIVATE-PDF-CANARY-223")),
    false,
  );
  // The selection keeps a deliberate order across source pages.
  await nextPage(page);
  await panel(page).getByText("2 / 2", { exact: true }).waitFor();
  await region(page, "Text").first().click();
  await page.getByRole("button", { name: /^\d+ selected$/ }).click();
  const rows = page.locator("#pdf-import-selection li");
  await page
    .getByRole("button", { name: "Move up", exact: true })
    .nth(1)
    .click();
  assert.match(await rows.first().innerText(), /Article continued/);
  await page
    .getByRole("button", { name: "Previous PDF page", exact: true })
    .click();
  await panel(page).getByText("1 / 2", { exact: true }).waitFor();
  await region(page, "Text").nth(2).click();
  assert.match(
    await rows.first().innerText(),
    /Article continued/,
    "Selecting later regions keeps deliberate order.",
  );
  await closeTool(page);
  await page.waitForTimeout(500);
  await page.evaluate(() =>
    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "PUBLIC-CONTROL-CANARY-223",
        error: new Error("PUBLIC-CONTROL-CANARY-223"),
      }),
    ),
  );
  for (
    let tries = 0;
    tries < 100 &&
    !envelopes.some((body) => body.includes("PUBLIC-CONTROL-CANARY-223"));
    tries++
  )
    await page.waitForTimeout(50);
  assert(
    envelopes.some((body) => body.includes("PUBLIC-CONTROL-CANARY-223")),
    "Telemetry must be enabled for the privacy test.",
  );
  assert.equal(
    envelopes.some(
      (body) =>
        body.includes("PRIVATE-PDF-CANARY-223") ||
        body.includes("This paragraph has readable ordinary text") ||
        body.includes("single-column.pdf"),
    ),
    false,
    "Private source content cannot reappear in post-close telemetry.",
  );
  // Hold worker script loading, then advance the real browser clock past deadline.
  const deadline = await context.newPage();
  await deadline.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args) {
        const worker: Worker = Reflect.construct(target, args);
        document.documentElement.dataset.pdfGateWorker = "created";
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          document.documentElement.dataset.pdfGateWorker = "terminated";
          terminate();
        };
        return worker;
      },
    });
  });
  await deadline.goto(`${base}/admin/issues/${iid}/edit`);
  // Import PDF steps aside on the cover the editor opens on (#287).
  await magazinePage(deadline, 2).click();
  await openTool(deadline);
  await deadline.clock.install();
  let release: () => void = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await deadline.route("**/pdf.worker.min.mjs", async (route) => {
    await blocked;
    await route.abort().catch(() => {});
  });
  await fileInput(deadline).setInputFiles(
    "scripts/fixtures/pdf-import/single-column.pdf",
  );
  await deadline.waitForFunction(
    () => document.documentElement.dataset.pdfGateWorker === "created",
  );
  await deadline.clock.fastForward(31000);
  await deadline.getByText(/PDF operation exceeded 30 seconds/).waitFor();
  assert.equal(
    await deadline.evaluate(
      () => document.documentElement.dataset.pdfGateWorker,
    ),
    "terminated",
  );
  release();
  console.log(
    "PDF privacy/lifecycle gate passed: live telemetry canaries, cross-page reorder, and deadline termination of an actual browser worker.",
  );
} finally {
  await cleanup();
}
process.exit(0);
