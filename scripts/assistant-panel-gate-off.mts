// The `--off` half of dev-assistant-panel-gate.mts: against a server with the
// assistant off, the Assistant surface, the Ask on a selected block (#311),
// the guide's section and the usage route are all absent.
import type { Page } from "playwright";
import {
  CHOICE,
  PANEL_BUTTON,
  PLUS,
  closePanel,
} from "./editor-panel-gate-support.mts";

export async function checkOff(d: {
  page: Page;
  base: string;
  draftId: string;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
}) {
  const { page, base, ok, heading } = d;
  heading("Off: nothing to see");
  await page.goto(`${base}/admin/issues/${d.draftId}/edit`);
  await page.waitForSelector(PANEL_BUTTON);
  await page.click(PANEL_BUTTON);
  await page.waitForSelector(CHOICE);
  const choices = await page.$$eval(`${CHOICE} button`, (els) =>
    els.map((el) => el.textContent?.trim()),
  );
  ok(
    choices.join() === "Import PDF",
    `the panel offers Import PDF alone (${choices.join(", ")})`,
  );
  await page.click(PLUS);
  await page.waitForSelector('[role="menu"] [role="menuitem"]');
  const items = await page.$$eval('[role="menu"] [role="menuitem"]', (els) =>
    els.map((el) => el.textContent?.trim()),
  );
  // On the cover the row carries its reason under the name.
  ok(
    items.length === 1 && items[0]?.startsWith("Import PDF"),
    `and so does the + menu (${items.join(", ")})`,
  );
  await page.keyboard.press("Escape");
  await closePanel(page);
  await page.click('button[aria-label="Page 2"]');
  const first = page.locator("[data-editor-block]").first();
  await first.click({ position: { x: 20, y: 6 } });
  await page.waitForSelector("[data-editor-block] [data-block-bar]");
  ok((await page.$("[data-ask]")) === null, "no Ask on a selected block");
  const usage = await page.request.get(`${base}/api/admin/ai/usage`);
  ok(usage.status() === 404, "usage route 404s");
  await page.goto(`${base}/admin/help`);
  ok(
    (await page.$("#assistant")) === null,
    "no Assistant section in the guide",
  );
  console.log("\nassistant panel gate (off): all checks passed");
}
