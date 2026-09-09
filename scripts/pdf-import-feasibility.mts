import {
  base,
  browser,
  token,
  iid,
  setup,
  cleanup,
} from "./pdf-import-gate-support.mts";
await setup();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("console", m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  page.on("worker", (w) => console.log("worker", w.url()));
  await page.goto(`${base}/admin/issues/${iid}/edit`);
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  for (const file of [
    "scripts/fixtures/pdf-import/single-column.pdf",
    "scripts/fixtures/pdf-import/two-column.pdf",
    "scripts/fixtures/pdf-import/rotated.pdf",
    ...process.argv.slice(3),
  ]) {
    const start = Date.now();
    await page.getByLabel("Choose local PDF").setInputFiles(file);
    await page
      .getByText("PDF opened on this device. Select regions to review.")
      .waitFor({ timeout: 45000 });
    console.log(file, {
      ms: Date.now() - start,
      text: await page.getByRole("button", { name: /^Text region/ }).count(),
      images: await page.getByRole("button", { name: /^Image region/ }).count(),
      warnings: await page
        .locator("[data-pdf-private] .text-warn")
        .allTextContents(),
    });
    await page.screenshot({ path: `/tmp/pdf223-${file.split("/").pop()}.png` });
  }
} finally {
  await cleanup();
}
process.exit(0);
