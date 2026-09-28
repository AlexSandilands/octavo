// The assistant panel's hints rotate (#366): a gate that presses one brings it
// up first with More ideas, which walks the whole list before any comes round
// again. Call it before anything turns the row off (a run, the cost question).
import type { Locator, Page } from "playwright";

export const HINT = (label: string) =>
  `[data-assistant-hints] button[data-hint]:text-is("${label}")`;

export async function showHint(page: Page, label: string): Promise<Locator> {
  const hint = page.locator(HINT(label));
  await page.waitForSelector("[data-assistant-hints]");
  for (let i = 0; i < 16; i++) {
    // Settles first: another page or a landed reply deals afresh.
    await page.waitForTimeout(300);
    if (await hint.count()) return hint;
    const more = page.locator("[data-more-ideas]");
    if (await more.count()) await more.click();
  }
  throw new Error(`FAIL: the "${label}" hint never came up`);
}
