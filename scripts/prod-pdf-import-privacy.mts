import assert from "node:assert/strict";
import {
  base,
  browser,
  iid,
  token,
  setup,
  cleanup,
  openFile,
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
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  await openFile(page);
  await page.getByRole("button", { name: /^Text region 2/ }).click();
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
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("PDF 2 / 2", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Text region/ }).click();
  await page
    .getByRole("button", { name: "Move selection 2 up", exact: true })
    .click();
  const previews = page.getByRole("textbox", {
    name: "Editable text preview",
    exact: true,
  });
  assert(
    (await previews.first().textContent())?.startsWith("Article continued"),
  );
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByRole("button", { name: /^Text region 4/ }).click();
  assert(
    (await previews.first().textContent())?.startsWith("Article continued"),
    "Selecting later regions keeps deliberate tray order.",
  );
  await page
    .getByRole("button", { name: "Close importer", exact: true })
    .click();
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
  await deadline
    .getByRole("button", { name: "Import PDF", exact: true })
    .click();
  await deadline.clock.install();
  let release: () => void = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await deadline.route("**/pdf.worker.min.mjs", async (route) => {
    await blocked;
    await route.abort().catch(() => {});
  });
  await deadline
    .getByLabel("Choose local PDF")
    .setInputFiles("scripts/fixtures/pdf-import/single-column.pdf");
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
