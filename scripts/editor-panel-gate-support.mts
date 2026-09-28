// The editor's side panel as the gates drive it (#353): the header's Panel
// button, the strip of tabs along the panel's top, and the two ways a surface
// is opened — the empty panel's choice, or the strip's + menu.
import type { Page } from "playwright";

export const PANEL = "aside#editor-side-panel";
/** The header's one button: pressed while the panel is out, `aria-controls` it. */
export const PANEL_BUTTON = 'button[aria-controls="editor-side-panel"]';
export const STRIP = "[data-surface-strip]";
export const CLOSE_PANEL = `${STRIP} button[aria-label="Close panel"]`;
export const PLUS = `${STRIP} button[aria-label="Open a surface"]`;
export const CHOICE = "[data-surface-choice]";
export type SurfaceName = "Assistant" | "Import PDF";

export const panelOpen = (page: Page) =>
  page.$eval(
    PANEL,
    (el) => !el.hasAttribute("aria-hidden") && el.clientWidth > 0,
  );
export const tab = (page: Page, name: SurfaceName) =>
  page.locator(`${STRIP} [role="tab"]`, { hasText: name });

/** The strip's controls, left to right as they sit on screen, row by row
 *  where a narrow panel wraps them (controls of different heights share a
 *  row when their centres are within 12px). */
export const stripOrder = (page: Page) =>
  page.$$eval(`${STRIP} button`, (els) => {
    const items = els
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: el.getAttribute("aria-label") ?? el.textContent?.trim(),
          left: r.left,
          centre: r.top + r.height / 2,
        };
      })
      .sort((a, b) => a.centre - b.centre);
    const rows: { centre: number; items: typeof items }[] = [];
    for (const item of items) {
      const row = rows.at(-1);
      if (row && Math.abs(row.centre - item.centre) < 12) row.items.push(item);
      else rows.push({ centre: item.centre, items: [item] });
    }
    return rows
      .flatMap((row) => row.items.sort((a, b) => a.left - b.left))
      .map((b) => b.label)
      .join(", ");
  });

/** Opens the surface the way an author would: its tab if it has one, else the
 *  panel (from the header) and then the choice or the + menu. */
export async function openSurface(page: Page, name: SurfaceName) {
  await page.waitForSelector(PANEL_BUTTON);
  if (!(await panelOpen(page))) {
    await page.click(PANEL_BUTTON);
    await page.waitForSelector(STRIP);
  }
  const existing = tab(page, name);
  if (await existing.count()) {
    if ((await existing.getAttribute("aria-selected")) !== "true")
      await existing.click();
    return;
  }
  const choice = page.locator(`${CHOICE} button`, { hasText: name });
  if (await choice.count()) await choice.click();
  else {
    await page.click(PLUS);
    await page.click(`[role="menu"] [role="menuitem"]:has-text("${name}")`);
  }
}

/** The strip's Close panel: the panel slides out, focus goes to the header. */
export async function closePanel(page: Page) {
  await page.click(CLOSE_PANEL);
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.hasAttribute("aria-hidden"),
    PANEL,
  );
}
