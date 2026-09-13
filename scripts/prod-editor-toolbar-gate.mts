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

const editorBar = (page: Page) =>
  page.getByRole("group", { name: "Editor tools" });
const pdfBar = (page: Page) => page.getByRole("group", { name: "PDF tools" });

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  assert(bounds, "Expected the element to have visible bounds.");
  return bounds;
}

// Set once per page kind, from the bar's first render there — main's toolbar
// grows tools over time (a Logo tool, cover tools), so a literal count would go
// stale, and a cover offers a different set from an interior page.
let expectedToolCount: number | null = null;

const inspectorPanel = (page: Page) =>
  page.getByRole("complementary", { name: "Cover element settings" });
const inspectorTab = (page: Page) => page.locator("[data-inspector-tab]");

// The cover inspector holds a column while the stage has room, and otherwise
// collapses to a tab that opens it over the page; the page never leaves the stage.
async function assertCoverInspector(
  page: Page,
  mode: "reserved" | "overlay",
): Promise<void> {
  await page.waitForTimeout(350);
  const tab = inspectorTab(page);
  assert.equal(await tab.count(), mode === "overlay" ? 1 : 0);
  const [stage, frame] = await Promise.all([
    box(page.locator("[data-editor-stage]")),
    box(page.locator("[data-page-frame]")),
  ]);
  const within = (b: { x: number; width: number }) =>
    b.x >= stage.x - 1 && b.x + b.width <= stage.x + stage.width + 1;
  assert(within(frame), "The magazine page stays inside its stage.");
  if (mode === "reserved") {
    const panel = await box(inspectorPanel(page));
    assert(
      panel.x >= frame.x + frame.width - 1,
      "The reserved inspector never covers the page.",
    );
    return;
  }
  const tabBox = await box(tab);
  assert(
    tabBox.width >= 44 && tabBox.height >= 44,
    "The tab is a large enough target.",
  );
  assert(within(tabBox), "The tab stays inside the stage.");
  assert.equal((await tab.innerText()).trim(), "Cover");
  assert.equal(await tab.getAttribute("aria-expanded"), "false");
  await tab.click();
  await page.waitForTimeout(300);
  assert.equal(await tab.getAttribute("aria-expanded"), "true");
  assert(
    within(await box(inspectorPanel(page))),
    "The overlay inspector opens inside the stage.",
  );
  await tab.click();
  await page.waitForTimeout(300);
  assert.equal(await tab.getAttribute("aria-expanded"), "false");

  // A selection opens it too, and its Done closes it again.
  await editorBar(page)
    .getByRole("button", { name: "Heading", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.equal(await tab.getAttribute("aria-expanded"), "true");
  assert.equal((await tab.innerText()).trim(), "Heading");
  await inspectorPanel(page)
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.equal(await tab.getAttribute("aria-expanded"), "false");
  await editorBar(page)
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await settle(page);
}

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

  // Without a manual choice, resizing the panel still drives the existing
  // automatic bottom/left behavior in both directions, on the cover.
  await assertMagazineBarClear(page, "bottom");
  await assertCoverInspector(page, "reserved");
  await openTool(page);
  const handle = page.getByRole("separator", { name: "Resize panel" });
  await handle.focus();
  await page.keyboard.press("End");
  await assertMagazineBarClear(page, "left");
  await assertCoverInspector(page, "overlay");
  await closeTool(page);
  await assertMagazineBarClear(page, "bottom");
  await assertCoverInspector(page, "reserved");
  // An interior page offers a different insert set from a cover's.
  await magazinePage(page, 2).click();
  expectedToolCount = null;

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
