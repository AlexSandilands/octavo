// The `--off` half of dev-assistant-panel-gate.mts: against a server with the
// assistant off, the rail button, the Ask on a selected block (#311), the
// guide's section and the usage route are all absent.
import type { Page } from "playwright";

const RAIL = 'nav[aria-label="Editor panels"]';

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
  await page.waitForSelector(RAIL);
  ok(
    (await page.$(`${RAIL} button[aria-label="Assistant"]`)) === null,
    "no Assistant button on the rail",
  );
  ok(
    (await page.$(`${RAIL} button[aria-label="Import PDF"]`)) !== null,
    "Import PDF still there",
  );
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
