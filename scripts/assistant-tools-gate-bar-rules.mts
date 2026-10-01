// The bars' thin rules (#377, #388), part of dev-assistant-tools-gate.mts: at
// widths that wrap a selected block's bar, no visible rule may be first or last
// on its line. The text bar and the photo bar are exercised, and each must have
// actually wrapped at some width so the check can't pass vacuously. Runs on the
// gate's draft page 2 (a heading, two text blocks and a photo with an image).
import type { Page } from "playwright";
import { ids } from "./fixtures/assistant/tools-gate-kit.mts";
import {
  PANEL_BUTTON,
  openSurface,
  panelOpen,
} from "./editor-panel-gate-support.mts";

const KINDS = [
  { name: "text bar", block: ids.story, at: { x: 10, y: 4 } },
  { name: "photo bar", block: ids.photo, at: { x: 10, y: 4 } },
] as const;

/** Every visible rule in the bar, and whether it starts or ends its line. */
const measure = (page: Page, id: string) =>
  page.$eval(`[data-block-id="${id}"] [data-block-bar]`, (bar) => {
    // Plain expressions only: tsx's __name helper isn't in the page.
    const all = [...bar.querySelectorAll("*")].filter(
      (el) => (el as HTMLElement).offsetParent !== null,
    );
    const mids = new Map(
      all.map((el) => {
        const r = el.getBoundingClientRect();
        return [el, r.top + r.height / 2] as const;
      }),
    );
    const rules = all.filter(
      (el) => el.tagName === "SPAN" && el.classList.contains("w-px"),
    );
    const hanging = rules.filter((rule) => {
      const line = [...rule.parentElement!.children].filter(
        (el) => mids.has(el) && Math.abs(mids.get(el)! - mids.get(rule)!) < 10,
      );
      return line[0] === rule || line.at(-1) === rule;
    });
    const rows = new Set(
      all
        .filter((el) => el.tagName === "BUTTON")
        .map((el) => Math.round(mids.get(el)! / 12)),
    );
    return { rules: rules.length, hanging: hanging.length, wrapped: rows.size };
  });

export async function checkBarRules(d: {
  page: Page;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
}) {
  const { page, ok } = d;
  d.heading("block bars: no rule hangs alone on a wrapped line (#388)");
  const wrapped = new Set<string>();
  // Panel closed, then open: the panel takes canvas room, so the bars wrap.
  if (await panelOpen(page)) await page.click(PANEL_BUTTON);
  for (const panel of [false, true]) {
    if (panel) await openSurface(page, "Assistant");
    for (const width of [900, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(500);
      for (const kind of KINDS) {
        const at = `${width}px, panel ${panel ? "open" : "closed"}, ${kind.name}`;
        // A click right after a resize can land before the layout settles.
        const bar = `[data-block-id="${kind.block}"] [data-block-bar]`;
        for (let tries = 1; ; tries++) {
          await page.click(`[data-block-id="${kind.block}"]`, {
            force: true,
            position: kind.at,
          });
          if (
            await page.waitForSelector(bar, { timeout: 3000 }).catch(() => null)
          )
            break;
          if (tries === 3) throw new Error(`FAIL: ${at}: no bar`);
          await page.waitForTimeout(500);
        }
        await page.waitForTimeout(300);
        const m = await measure(page, kind.block);
        ok(
          m.hanging === 0,
          `${at}: no rule first or last on a line (${m.rules} shown, ${m.wrapped} rows)`,
        );
        if (m.wrapped > 1) wrapped.add(kind.name);
      }
    }
  }
  for (const kind of KINDS)
    ok(wrapped.has(kind.name), `the ${kind.name} wrapped at some width`);
  await page.setViewportSize({ width: 1440, height: 900 });
}
