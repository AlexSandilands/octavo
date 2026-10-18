import assert from "node:assert/strict";
import type { Page as BrowserPage } from "playwright";
import {
  addButton,
  openFile,
  panel,
  readDocument,
  region,
  selectAll,
  waitAdded,
} from "./pdf-import-gate-support.mts";

// Run by prod-pdf-import-gate.mts, on its signed-in editor page.
export async function checkPhotoSizes(page: BrowserPage) {
  // Photos come in at the size the page gives them; the pill overrides it.
  await openFile(page, "scripts/fixtures/pdf-import/side-by-side.pdf");
  const photos = region(page, "Image");
  assert.equal(await photos.count(), 3);
  const sizes = panel(page)
    .getByRole("group", { name: "Selected region" })
    .getByRole("group", { name: "Size" });
  const pressedSize = () =>
    sizes.locator("button[aria-pressed='true']").getAttribute("aria-label");
  await photos.nth(1).click();
  await photos.nth(1).hover();
  assert.equal(await pressedSize(), "33%", "A photo at 40% is detected as S.");
  // Keyboard: Tab from the region through Image and the sizes; Enter picks L.
  await photos.nth(1).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "66%",
  );
  await page.keyboard.press("Enter");
  assert.equal(await pressedSize(), "66%");
  await selectAll(page);
  await page.getByRole("button", { name: /^\d+ selected$/ }).click();
  const sizeRows = page
    .locator("#pdf-import-selection li")
    .filter({ has: page.getByRole("group", { name: "Size" }) });
  assert.equal(await sizeRows.count(), 3);
  const listed = [];
  for (let i = 0; i < 3; i++)
    listed.push(
      await sizeRows
        .nth(i)
        .locator("button[aria-pressed='true']")
        .last()
        .getAttribute("aria-label"),
    );
  assert.deepEqual(
    listed,
    ["100%", "66%", "33%"],
    "The list shows the detected sizes and keeps the override.",
  );
  await page.getByRole("button", { name: /^\d+ selected$/ }).click();
  await addButton(page).click();
  await waitAdded(page);
  const sizedImages = (await readDocument()).pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "image");
  assert.deepEqual(
    sizedImages.slice(-3).map((b) => b.type === "image" && b.width),
    [100, 66, 33],
    "The paginator keeps the chosen widths.",
  );
  // Drag-out: the drop preview and the dropped block take the detected size.
  const from = (await photos.nth(2).boundingBox())!;
  const frame = (await page
    .locator("[data-page-frame]")
    .first()
    .boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 12,
    from.y + from.height / 2,
    {
      steps: 4,
    },
  );
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2, {
    steps: 12,
  });
  const dropPreview = page.locator("[data-drop-preview]");
  await dropPreview.waitFor();
  assert.equal(
    await dropPreview.evaluate((el) => (el as HTMLElement).style.width),
    "33%",
  );
  await page.mouse.up();
  await waitAdded(page);
  const dropped = (await readDocument()).pages
    .flatMap((p) => p.blocks)
    .filter((b) => b.type === "image");
  assert.equal(dropped.length, sizedImages.length + 1);
  assert.equal(dropped.at(-1)?.type === "image" && dropped.at(-1)?.width, 33);
}
