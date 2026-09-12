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
  // Off the cover (page 1): its mandatory overlay inspector reserves its own
  // canvas width, a separate concern from the toolbar placement under test.
  await magazinePage(page, 2).click();

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
