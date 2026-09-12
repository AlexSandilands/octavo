import {
  base,
  browser,
  token,
  iid,
  setup,
  cleanup,
  openTool,
  fileInput,
  region,
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
  await openTool(page);
  for (const file of [
    "scripts/fixtures/pdf-import/single-column.pdf",
    "scripts/fixtures/pdf-import/two-column.pdf",
    "scripts/fixtures/pdf-import/rotated.pdf",
    ...process.argv.slice(3),
  ]) {
    const start = Date.now();
    await fileInput(page).setInputFiles(file);
    await page
      .getByRole("group", { name: "PDF tools" })
      .waitFor({ timeout: 45000 });
    await page.locator("[data-pdf-private] canvas").waitFor({ timeout: 45000 });
    console.log(file, {
      ms: Date.now() - start,
      text: await region(page, "Text").count(),
      headings: await region(page, "Heading").count(),
      images: await region(page, "Image").count(),
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
