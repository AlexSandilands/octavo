// The filter panel's controls as the discussion gates drive them: the funnel,
// the Show menu and the status line (shared by the tags and filter halves).
import type { Page } from "playwright";

export const FILTER_TOGGLE =
  '[role=dialog] button[aria-controls="discussion-filters"]';
export const SHOW_MENU = '[role=menu][aria-label="Show"]';

/** The filter's state: the funnel's name, the Show pill, the status line and
 *  how many top-level comments are listed. */
export function filterState(page: Page) {
  return page.evaluate(() => {
    const show = [
      ...document.querySelectorAll(
        "#discussion-filters button[aria-haspopup=menu]",
      ),
    ].find((b) => b.textContent?.trim().startsWith("Show:"));
    const text = show?.textContent?.trim() ?? null;
    return {
      toggle:
        document
          .querySelector('[aria-controls="discussion-filters"]')
          ?.getAttribute("aria-label") ?? null,
      show: text,
      on: text !== null && text !== "Show: All",
      count:
        document
          .querySelector("[role=dialog] [data-thread-count]")
          ?.textContent?.trim() ?? null,
      comments: document.querySelectorAll(
        '[role=dialog] article[aria-label^="Comment by"]',
      ).length,
    };
  });
}

/** Opens the Show menu, opening the filter panel first if it is shut. */
export async function openShow(page: Page) {
  const toggle = page.locator(FILTER_TOGGLE);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await page
    .locator("#discussion-filters button[aria-haspopup=menu]", {
      hasText: "Show:",
    })
    .click();
  await page.waitForSelector(SHOW_MENU);
}

/** The Show menu's rows, by their words. */
export function showRows(page: Page) {
  return page.$$eval(`${SHOW_MENU} [role=menuitemradio]`, (els) =>
    els.map(
      (el) => el.querySelector("[data-page-label]")?.textContent?.trim() ?? "",
    ),
  );
}

/** Chooses a Show row by its words and, unless `fetches` is false (My
 *  comments narrows the list already loaded), waits for the list it asks for. */
export async function chooseShow(
  page: Page,
  text: string | RegExp,
  fetches = true,
) {
  await openShow(page);
  const rows = await showRows(page);
  const at = rows.findIndex((t) =>
    typeof text === "string" ? t === text : text.test(t),
  );
  if (at < 0) throw new Error(`no Show row “${text}” in ${rows.join(", ")}`);
  await Promise.all([
    fetches && page.waitForResponse((r) => /\/comments/.test(r.url())),
    page.locator(`${SHOW_MENU} [role=menuitemradio]`).nth(at).click(),
  ]);
  await page.waitForTimeout(150);
}

/** Shows the open page(s) only, or everything again. */
export async function setFilter(page: Page, on: boolean) {
  if ((await filterState(page)).on === on) return;
  await chooseShow(page, on ? /^(This page|These pages)$/ : "All comments");
}
