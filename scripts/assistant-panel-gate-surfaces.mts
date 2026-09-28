// dev-assistant-panel-gate.mts's strip cases (#353): the header's Panel
// button and the empty panel's choice, the + menu (with Import PDF greyed on
// a cover), Assistant and Import PDF open as two tabs and switched by mouse
// and by arrow keys — each at its own width — Replace PDF in the strip,
// closing a tab (focus on the neighbour, then on +), the panel remembering
// its tabs, and the cover hand-offs.
import type { Page } from "playwright";
import {
  CHOICE,
  CLOSE_PANEL,
  PANEL_BUTTON,
  PLUS,
  STRIP,
  closePanel,
  openSurface,
  panelOpen,
  stripOrder,
  tab,
  type SurfaceName,
} from "./editor-panel-gate-support.mts";

const INPUT = "#assistant-input";
const PDF = "[data-pdf-private]";
const MENU = '[role="menu"][aria-label="Open a surface"]';
const ITEM = `${MENU} [role="menuitem"]`;
const PDF_COVER =
  "PDF import is available on interior pages. Move to another page to use it.";
const FULL =
  "Assistant, Close Assistant, Import PDF, Close Import PDF, Open a surface, Close panel";

export async function checkSurfaces(d: {
  page: Page;
  base: string;
  draftId: string;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
}) {
  const { page, ok, heading } = d;
  const focusedTab = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute("role") === "tab" ? el.textContent?.trim() : null;
    });
  const focusedLabel = () =>
    page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  const selected = () =>
    page.$eval(`${STRIP} [role="tab"][aria-selected="true"]`, (el) =>
      el.textContent?.trim(),
    );
  const width = () =>
    page.$eval('[role="separator"][aria-label="Resize panel"]', (el) =>
      Number(el.getAttribute("aria-valuenow")),
    );
  const settled = () => page.waitForTimeout(450);
  const selectTab = async (name: SurfaceName) => {
    await tab(page, name).click();
    await settled();
  };

  heading("The Panel button and the empty panel's choice");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${d.base}/admin/issues/${d.draftId}/edit`);
  await page.waitForSelector(PANEL_BUTTON);
  ok(
    (await page.getAttribute(PANEL_BUTTON, "aria-pressed")) === "false",
    "the header's Panel button is not pressed while the panel is closed",
  );
  await page.click(PANEL_BUTTON);
  await page.waitForSelector(CHOICE);
  await settled();
  ok(
    (await page.getAttribute(PANEL_BUTTON, "aria-pressed")) === "true",
    "pressed while it is out",
  );
  const choice = await page.$$eval(`${CHOICE} button`, (els) =>
    els.map((el) => ({
      text: el.textContent?.trim(),
      height: el.getBoundingClientRect().height,
      disabled: el.getAttribute("aria-disabled"),
      reason: el.getAttribute("aria-describedby")
        ? document.getElementById(el.getAttribute("aria-describedby")!)
            ?.textContent
        : null,
    })),
  );
  ok(
    choice.map((c) => c.text).join() === "Assistant,Import PDF" &&
      choice.every((c) => c.height >= 44),
    "the empty panel offers Assistant and Import PDF as 44px+ buttons",
  );
  ok(
    choice[1]?.disabled === "true" && choice[1].reason === PDF_COVER,
    "Import PDF is greyed on the cover, with the reason",
  );
  ok(
    await page.evaluate(
      (sel) => document.activeElement === document.querySelector(sel),
      `${CHOICE} button`,
    ),
    "focus lands on the first choice",
  );
  const empty = await stripOrder(page);
  ok(
    empty === "Open a surface, Close panel",
    `the strip holds + and Close alone (${empty})`,
  );

  heading("The + menu");
  await page.click(PLUS);
  await page.waitForSelector(MENU);
  const items = await page.$$eval(ITEM, (els) =>
    els.map((el) => ({
      text: el.textContent?.trim(),
      disabled: el.getAttribute("aria-disabled"),
    })),
  );
  ok(
    items.length === 2 &&
      items[0]?.text === "Assistant" &&
      items[1]?.text === `Import PDF${PDF_COVER}` &&
      items[1].disabled === "true",
    "the menu lists Assistant and Import PDF, the latter greyed with its reason",
  );
  ok(
    await page.evaluate(
      (sel) => document.activeElement === document.querySelector(sel),
      ITEM,
    ),
    "opening puts the focus on the first item",
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  ok(
    (await tab(page, "Import PDF").count()) === 0 &&
      (await page.$(MENU)) !== null,
    "Enter on the greyed item opens nothing",
  );
  await page.keyboard.press("Escape");
  ok(
    (await page.$(MENU)) === null &&
      (await focusedLabel()) === "Open a surface",
    "Escape closes the menu and returns the focus to +",
  );
  await page.focus(`${CHOICE} button`);
  await page.keyboard.press("Enter");
  await page.waitForSelector(INPUT);
  await settled();
  ok(
    (await page.evaluate(() => document.activeElement?.id)) ===
      "assistant-input",
    "Enter on the choice opens the Assistant tab with the focus in its composer",
  );
  const labelled = await page.evaluate(() => {
    const panel = document.getElementById("editor-surface");
    const tabEl = document.querySelector('[role="tab"][aria-selected="true"]');
    return (
      panel?.getAttribute("role") === "tabpanel" &&
      panel.getAttribute("aria-labelledby") === tabEl?.id &&
      tabEl?.getAttribute("aria-controls") === "editor-surface"
    );
  });
  ok(labelled, "the surface is a tabpanel labelled by its tab");

  heading("Two tabs, switched by mouse and by arrow keys");
  await page.click('button[aria-label="Page 2"]');
  await page.click(PLUS);
  await page.click(`${ITEM}:has-text("Import PDF")`);
  await page.waitForSelector(PDF);
  await settled();
  const two = await stripOrder(page);
  ok(two === FULL, `two tabs: ${two}`);
  ok(
    (await focusedTab()) === "Import PDF",
    "opening from + puts the focus on the new tab",
  );
  ok(
    (await page.isVisible(PDF)) && !(await page.isVisible(INPUT)),
    "the Import PDF tab shows its surface, the Assistant's is hidden",
  );
  ok(
    (await width()) === 645,
    `Import PDF takes half the row (${await width()}px)`,
  );
  await selectTab("Assistant");
  ok(
    (await page.isVisible(INPUT)) &&
      !(await page.isVisible(PDF)) &&
      (await focusedTab()) === "Assistant",
    "a click on the Assistant tab shows it, the focus staying on the tab",
  );
  ok((await width()) === 400, `the Assistant keeps its 400px column`);
  await page.keyboard.press("ArrowRight");
  await settled();
  ok(
    (await focusedTab()) === "Import PDF" &&
      (await selected()) === "Import PDF",
    "ArrowRight moves to Import PDF and switches to it",
  );
  await page.keyboard.press("ArrowLeft");
  await settled();
  ok((await selected()) === "Assistant", "ArrowLeft comes back");
  await page.keyboard.press("End");
  ok((await selected()) === "Import PDF", "End reaches the last tab");
  await page.keyboard.press("Home");
  ok((await selected()) === "Assistant", "Home the first");
  const stops = await page.$$eval(`${STRIP} [role="tab"]`, (els) =>
    els.map((el) => el.tabIndex).join(),
  );
  ok(stops === "0,-1", `only the active tab is a tab stop (${stops})`);

  heading("Replace PDF in the strip");
  await page.keyboard.press("ArrowRight");
  await settled();
  await page.setInputFiles(
    `${PDF} input[type="file"]`,
    "scripts/fixtures/pdf-import/single-column.pdf",
  );
  const replace = page.locator(`${STRIP} button`, { hasText: "Replace PDF" });
  await replace.waitFor({ timeout: 35_000 });
  ok(
    (await replace.textContent())?.trim() === "Replace PDF",
    "Replace PDF sits in the strip with its word",
  );
  const withReplace = await stripOrder(page);
  ok(
    withReplace ===
      "Assistant, Close Assistant, Import PDF, Close Import PDF, Replace PDF, Open a surface, Close panel",
    `after the tabs, before +: ${withReplace}`,
  );
  await selectTab("Assistant");
  ok(
    (await page
      .locator(`${STRIP} button`, { hasText: "Replace PDF" })
      .count()) === 0,
    "shown for the active tab only",
  );

  heading("Closing tabs");
  await selectTab("Import PDF");
  await page.click(`${STRIP} button[aria-label="Close Import PDF"]`);
  await settled();
  ok(
    (await focusedTab()) === "Assistant" &&
      (await selected()) === "Assistant" &&
      (await page.isVisible(INPUT)),
    "closing the active tab hands over to its neighbour, focus on it",
  );
  await page.click(PLUS);
  await page.click(`${ITEM}:has-text("Import PDF")`);
  await page.waitForSelector(PDF);
  ok(
    await page.locator("[data-pdf-private] canvas").isHidden(),
    "the tab comes back to the drop zone: closing it released the file",
  );
  await page.keyboard.press("Delete");
  await settled();
  ok(
    (await focusedTab()) === "Assistant" &&
      (await tab(page, "Import PDF").count()) === 0,
    "Delete on the focused tab closes it",
  );
  await page.keyboard.press("Delete");
  await settled();
  ok(
    (await focusedLabel()) === "Open a surface" &&
      (await page.isVisible(CHOICE)),
    "closing the last tab puts the focus on + over the choice",
  );

  heading("The panel remembers its tabs");
  await openSurface(page, "Assistant");
  await openSurface(page, "Import PDF");
  await page.waitForSelector(PDF);
  await closePanel(page);
  ok(
    await page.evaluate(
      (sel) => document.activeElement === document.querySelector(sel),
      PANEL_BUTTON,
    ),
    "Close panel hands the focus to the header's button",
  );
  await page.click(PANEL_BUTTON);
  await page.waitForSelector(PDF);
  await settled();
  ok(
    (await stripOrder(page)) === FULL &&
      (await selected()) === "Import PDF" &&
      (await focusedTab()) === "Import PDF",
    "reopened: the same tabs, the same one active, the focus on it",
  );

  heading("The cover hand-off");
  await page.click('button[aria-label="Page 1 (cover)"]');
  await settled();
  ok(
    (await selected()) === "Assistant" &&
      !(await page.isVisible("[data-cover-inspector]")),
    "on a cover the Assistant tab takes over and the inspector steps aside",
  );
  const greyed = tab(page, "Import PDF");
  ok(
    (await greyed.getAttribute("aria-disabled")) === "true" &&
      (await greyed.getAttribute("title")) === PDF_COVER,
    "the Import PDF tab is greyed with the reason",
  );
  await greyed.click({ force: true });
  ok((await selected()) === "Assistant", "and a click on it changes nothing");
  await page.click(`${STRIP} button[aria-label="Close Assistant"]`);
  await settled();
  ok(
    (await selected()) === "Import PDF" &&
      (await page.locator("[data-pdf-cover-note]").textContent())?.trim() ===
        PDF_COVER &&
      !(await page.isVisible(PDF)) &&
      (await page.isVisible("[data-cover-inspector]")),
    "alone, the Import PDF tab says why, and the inspector is back",
  );
  await page.click('button[aria-label="Page 2"]');
  await page.locator(PDF).waitFor({ state: "visible" });
  ok(
    (await page.$("[data-pdf-cover-note]")) === null,
    "back on an interior page the importer is back",
  );
  await page.click(CLOSE_PANEL);
  await page.waitForFunction(
    () => !document.querySelector("aside#editor-side-panel")?.clientWidth,
  );
  ok(!(await panelOpen(page)), "closed again");
}
