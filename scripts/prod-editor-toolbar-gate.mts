// Browser coverage for the magazine toolbar's automatic and manual positions.
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import {
  base,
  browser,
  cleanup,
  closeTool,
  iid,
  magazinePage,
  openFile,
  openTool,
  setup,
  settle,
  token,
} from "./pdf-import-gate-support.mts";
import {
  CHOICE,
  PANEL,
  PANEL_BUTTON,
  PLUS,
  tab,
} from "./editor-panel-gate-support.mts";

const editorBar = (page: Page) =>
  page.getByRole("group", { name: "Editor tools" });
const pdfBar = (page: Page) => page.getByRole("group", { name: "PDF tools" });
const PDF_COVER =
  "PDF import is available on interior pages. Move to another page to use it.";

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  assert(bounds, "Expected the element to have visible bounds.");
  return bounds;
}

async function assertCoverTextToolIconOnly(
  page: Page,
  placement: "bottom" | "left",
) {
  await page.waitForTimeout(350);
  const bar = editorBar(page);
  assert.equal(await bar.getAttribute("data-bar-placement"), placement);
  const textTool = bar.getByRole("button", { name: "Text", exact: true });
  const [dimensions, peer] = await Promise.all([
    textTool.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return {
        text: button.textContent?.trim(),
        width: rect.width,
        height: rect.height,
      };
    }),
    box(bar.getByRole("button", { name: "Undo", exact: true })),
  ]);
  assert.equal(
    dimensions.text,
    "",
    "The compact Text tool shows only its icon.",
  );
  assert(
    Math.abs(dimensions.width - peer.width) < 1 &&
      Math.abs(dimensions.height - peer.height) < 1,
    "The compact Text tool matches the other toolbar buttons.",
  );
}

// Set once, from the bar's first render — main's toolbar grows tools over
// time (a Logo tool, cover tools), so a literal count would go stale.
let expectedToolCount: number | null = null;

async function assertMagazineBarClear(
  page: Page,
  placement: "bottom" | "left",
) {
  await page.waitForTimeout(350);
  const bar = editorBar(page);
  assert.equal(await bar.getAttribute("data-bar-placement"), placement);
  const [barBox, pageBox] = await Promise.all([
    box(bar),
    box(page.locator("[data-page-frame]")),
  ]);
  if (placement === "bottom") {
    assert(
      barBox.y >= pageBox.y + pageBox.height - 1,
      "The bottom toolbar must stay below the magazine page.",
    );
  } else {
    assert(
      barBox.x + barBox.width <= pageBox.x + 1,
      "The left toolbar must stay left of the magazine page.",
    );
  }

  const containment = await bar.locator("button").evaluateAll((buttons) => {
    const group = buttons[0]?.parentElement?.getBoundingClientRect();
    if (!group) return { count: 0, outside: buttons.length };
    const outside = buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      return (
        rect.left < group.left - 1 ||
        rect.right > group.right + 1 ||
        rect.top < group.top - 1 ||
        rect.bottom > group.bottom + 1
      );
    }).length;
    return { count: buttons.length, outside };
  });
  expectedToolCount ??= containment.count;
  assert.equal(
    containment.count,
    expectedToolCount,
    "Every editor tool remains rendered.",
  );
  assert.equal(containment.outside, 0, "No editor tool is clipped by its bar.");
}

async function moveToolbar(page: Page, destination: "left" | "bottom") {
  const button = editorBar(page).getByRole("button", {
    name: `Move toolbar to ${destination}`,
    exact: true,
  });
  assert.equal(
    await button.getAttribute("title"),
    `Move toolbar to ${destination}`,
  );
  await button.focus();
  await page.keyboard.press("Enter");
  await editorBar(page)
    .getByRole("button", {
      name: `Move toolbar to ${destination === "left" ? "bottom" : "left"}`,
      exact: true,
    })
    .waitFor();
  await assertMagazineBarClear(page, destination);
}

await setup();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await context.newPage();
  await page.goto(`${base}/admin/issues/${iid}/edit`);
  await editorBar(page).waitFor();
  // The cover's Text menu follows the same responsive contract as ordinary
  // tool buttons: its label is removed in both compact row and standing modes.
  await page.setViewportSize({ width: 900, height: 1000 });
  await assertCoverTextToolIconOnly(page, "bottom");
  await editorBar(page)
    .getByRole("button", { name: "Move toolbar to left", exact: true })
    .press("Enter");
  await assertCoverTextToolIconOnly(page, "left");
  await editorBar(page)
    .getByRole("button", { name: "Move toolbar to bottom", exact: true })
    .press("Enter");
  await assertCoverTextToolIconOnly(page, "bottom");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(350);
  assert.equal(
    await editorBar(page)
      .getByRole("button", { name: "Text", exact: true })
      .textContent(),
    "Text",
    "The Text tool restores its label when the toolbar has room.",
  );
  // Reset the session's manual position before checking automatic placement.
  await page.reload();
  await editorBar(page).waitFor();

  // PDF content belongs on interior pages (#353). On the cover the panel's
  // choice keeps Import PDF readable, explains the restriction, and won't
  // open it; the + menu says the same.
  await page.click(PANEL_BUTTON);
  const coverImport = page.locator(`${CHOICE} button`, {
    hasText: "Import PDF",
  });
  await coverImport.waitFor();
  assert.equal(await coverImport.getAttribute("aria-disabled"), "true");
  const descriptionId = await coverImport.getAttribute("aria-describedby");
  assert(
    descriptionId,
    "The unavailable choice has an accessible description.",
  );
  assert.equal(
    await page.locator(`#${descriptionId}`).textContent(),
    PDF_COVER,
  );
  await coverImport.click({ force: true });
  assert.equal(await tab(page, "Import PDF").count(), 0, "No tab opens.");
  await page.click(PLUS);
  const item = page.locator('[role="menu"] [role="menuitem"]', {
    hasText: "Import PDF",
  });
  assert.equal(await item.getAttribute("aria-disabled"), "true");
  assert((await item.textContent())?.includes(PDF_COVER));
  await page.keyboard.press("Escape");
  await page.locator('[role="menu"]').waitFor({ state: "detached" });
  await closeTool(page);

  // Off the cover (page 1): its mandatory overlay inspector reserves its own
  // canvas width, a separate concern from the toolbar placement under test.
  await magazinePage(page, 2).click();
  await page.click(PANEL_BUTTON);
  await coverImport.waitFor();
  assert.equal(await coverImport.getAttribute("aria-disabled"), null);
  await closeTool(page);

  // An open importer keeps its tab when the author moves back onto the cover
  // — its body says why — and is back as soon as they return to an interior
  // page.
  await openTool(page);
  assert.equal(await page.locator(PANEL).getAttribute("aria-hidden"), null);
  await magazinePage(page, 1).click();
  assert.equal(await page.locator(PANEL).getAttribute("aria-hidden"), null);
  assert.equal(
    await tab(page, "Import PDF").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    (await page.locator("[data-pdf-cover-note]").textContent())?.trim(),
    PDF_COVER,
  );
  assert(!(await page.locator("[data-pdf-private]").isVisible()));
  await magazinePage(page, 2).click();
  await page.locator("[data-pdf-private]").waitFor({ state: "visible" });
  assert.equal(await page.locator("[data-pdf-cover-note]").count(), 0);
  await closeTool(page);

  // Without a manual choice, resizing the panel still drives the existing
  // automatic bottom/left behavior in both directions.
  await assertMagazineBarClear(page, "bottom");
  await openTool(page);
  const handle = page.getByRole("separator", { name: "Resize panel" });
  await handle.focus();
  await page.keyboard.press("End");
  await assertMagazineBarClear(page, "left");
  await closeTool(page);
  await assertMagazineBarClear(page, "bottom");

  // Both manual directions work with the panel closed. Navigation, editing and
  // the resulting autosave leave the mounted-session choice alone.
  await moveToolbar(page, "left");
  await magazinePage(page, 2).click();
  await assertMagazineBarClear(page, "left");
  await editorBar(page)
    .getByRole("button", { name: "Text", exact: true })
    .click();
  await settle(page);
  await assertMagazineBarClear(page, "left");
  await moveToolbar(page, "bottom");

  // The PDF panel neither resets nor owns the magazine choice. At its minimum
  // width its own automatic bar stands on the mirrored right edge.
  await openTool(page);
  await openFile(page);
  await handle.focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(400);
  assert.equal(await pdfBar(page).getAttribute("data-bar-placement"), "right");
  const [pdfBarBox, pdfPageBox] = await Promise.all([
    box(pdfBar(page)),
    box(page.locator("[data-pdf-private] canvas")),
  ]);
  assert(
    pdfBarBox.x >= pdfPageBox.x + pdfPageBox.width - 1,
    "The standing PDF toolbar stays right of its page.",
  );
  await moveToolbar(page, "left");
  assert.equal(await pdfBar(page).getAttribute("data-bar-placement"), "right");
  await moveToolbar(page, "bottom");

  // Maximising the panel leaves the magazine a deliberately narrow canvas.
  // Its manual bottom choice wraps, grows the reserve, and remains fully usable.
  await handle.focus();
  await page.keyboard.press("End");
  await assertMagazineBarClear(page, "bottom");
  assert(
    (await box(editorBar(page))).height > 60,
    "The narrow bottom toolbar wraps instead of clipping tools.",
  );
  await moveToolbar(page, "left");
  await moveToolbar(page, "bottom");
  await closeTool(page);
  await assertMagazineBarClear(page, "bottom");

  console.log(
    JSON.stringify({
      result: "passed",
      editorPositions: ["bottom", "left"],
      pdfPositions: ["bottom", "right"],
      narrowBottom: "wrapped and clear",
    }),
  );
  await context.close();
} finally {
  await cleanup();
}
process.exit(0);
