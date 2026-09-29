// The cover sponsor's Ask, part of dev-assistant-tools-gate.mts's cover
// sequence (#369). A sponsor isn't a cover item, so it keeps a block bar of its
// own; on a cover that bar is placed clear of the inspector (panel closed) and
// the standing tool pill (panel open, 768). At 1440, 900 and 768, panel closed
// and open, the point at the centre of its Ask must be Ask: after a click
// selects the sponsor, and again after Tab reaches Ask (focus scrolls the
// canvas at 768). A real click there opens the box, whose Send is on top too.
// Runs on a scratch copy of the Regatta cover (masthead, story, details, logo)
// plus a sponsor, in the caller's signed-in context; the caller deletes the
// issue.
import type { BrowserContext } from "playwright";
import type postgres from "postgres";
import { makeBlock } from "../src/lib/blocks";
import { settled } from "./assistant-tools-gate-ask.mts";
import { PANEL_BUTTON, openSurface } from "./editor-panel-gate-support.mts";

type Doc = { pages: { blocks: { id: string }[] }[] };
const DIALOG =
  '[role="dialog"][aria-label="Ask the assistant about this block"]';

export async function checkCoverSponsorAsk(d: {
  ctx: BrowserContext;
  sql: postgres.Sql;
  base: string;
  /** The scratch issue's id; the caller deletes it. */
  id: string;
  title: string;
  seed: { content: Doc; theme: string };
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
  shots?: string;
}) {
  const { sql, ok } = d;
  d.heading("cover: a sponsor's Ask is on top at every width (#369)");
  const sponsor = { ...makeBlock("sponsor"), name: "Chandlery" };
  const content = structuredClone(d.seed.content);
  content.pages[0]!.blocks.push(sponsor);
  await sql`insert into issues (id, title, theme, status, content) values
    (${d.id}, ${d.title}, ${d.seed.theme}, 'draft',
     ${sql.json(content as never)})`;
  const tab = await d.ctx.newPage();
  const block = `[data-block-id="${sponsor.id}"]`;
  const ask = `${block} [data-ask] > button[aria-label="Ask"]`;
  // What sits at the centre of Ask: Ask itself (or its icon), or what covers it.
  const onTop = (sel = ask) =>
    tab.$eval(sel, (el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      const over = hit?.closest("[aria-label]")?.getAttribute("aria-label");
      return {
        mine: Boolean(hit && el.contains(hit)),
        at: `x${Math.round(r.left)}–${Math.round(r.right)}`,
        hit: hit ? `${hit.tagName.toLowerCase()} in "${over}"` : "nothing",
      };
    });
  let wrappedSeen = false;
  try {
    await tab.goto(`${d.base}/admin/issues/${d.id}/edit`);
    await tab.waitForSelector(PANEL_BUTTON);
    for (const panel of [false, true]) {
      if (panel) {
        await openSurface(tab, "Assistant");
        await tab.waitForSelector("#assistant-input");
      }
      for (const width of [1440, 900, 768]) {
        const at = `${width}px, panel ${panel ? "open" : "closed"}`;
        await tab.setViewportSize({ width, height: 900 });
        // A click right after a resize can land before the tools stand on end.
        for (let tries = 1; ; tries++) {
          await settled(tab, sponsor.id);
          await tab.click(block, { force: true, position: { x: 4, y: 4 } });
          if (
            await tab.waitForSelector(ask, { timeout: 3000 }).catch(() => null)
          )
            break;
          if (tries === 3) throw new Error(`FAIL: ${at}: no sponsor Ask`);
        }
        await settled(tab, sponsor.id);
        // The panel may still be sliding in: look once nothing finite moves.
        await tab.waitForFunction(() =>
          document
            .getAnimations()
            .every(
              (a) =>
                a.playState !== "running" ||
                a.effect?.getComputedTiming().iterations === Infinity,
            ),
        );
        const mouse = await onTop();
        ok(
          mouse.mine,
          `${at}: the sponsor's Ask (${mouse.at}) is on top at its centre (${mouse.hit})`,
        );
        // #377: a rule that would hang alone on a wrapped line is hidden, and
        // Ask then sits flush with the bar's left padding (the picker's edge).
        const rule = await tab.$eval(ask, (el) => {
          const wrap = el.parentElement!;
          const picker = wrap.parentElement!.firstElementChild as HTMLElement;
          const line = wrap.previousElementSibling as HTMLElement;
          const shown =
            line.classList.contains("bg-line") && !!line.offsetParent;
          return {
            shown,
            wrapped: wrap.offsetTop >= picker.offsetTop + picker.offsetHeight,
            hangs:
              shown &&
              (line.offsetLeft <= picker.offsetLeft ||
                wrap.offsetLeft <= line.offsetLeft),
            inset: wrap.offsetLeft - picker.offsetLeft,
          };
        });
        ok(!rule.hangs, `${at}: no rule hangs alone beside Ask`);
        if (rule.wrapped)
          ok(
            !rule.shown && rule.inset === 0,
            `${at}: Ask on its own line has no rule and sits flush (inset ${rule.inset}px)`,
          );
        wrappedSeen ||= rule.wrapped;
        if (d.shots)
          await tab.screenshot({
            path: `${d.shots}/cover-sponsor-ask-${width}-panel-${panel ? "open" : "closed"}.png`,
          });
        const box = (await tab.locator(ask).boundingBox())!;
        await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        ok(
          await tab
            .waitForSelector(DIALOG, { timeout: 3000 })
            .catch(() => null),
          `${at}: a click there opens its box`,
        );
        const send = await onTop(`${DIALOG} button[aria-label="Send"]`);
        ok(
          send.mine,
          `${at}: its box's Send is on top too, clear of the inspector (${send.hit})`,
        );
        await tab.keyboard.press("Escape");
        // The keyboard's way in: focus scrolls the canvas to show the picker.
        await tab.focus(`${block} button[aria-label="Drag to reorder"]`);
        for (let i = 0; i < 6; i++) {
          await tab.keyboard.press("Tab");
          if (await tab.$eval(ask, (el) => el === document.activeElement))
            break;
        }
        ok(
          await tab.$eval(ask, (el) => el === document.activeElement),
          `${at}: Tab reaches the sponsor's Ask`,
        );
        await settled(tab, sponsor.id);
        const keys = await onTop();
        ok(
          keys.mine,
          `${at}: reached by Tab, it is still on top (${keys.hit})`,
        );
        await tab.keyboard.press("Escape"); // deselects: the next width starts clean
      }
    }
    ok(wrappedSeen, "a width wrapped Ask onto its own line (#377 exercised)");
  } finally {
    await tab.close();
  }
}
