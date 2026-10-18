// Dev-only: proves moving a block between pages (issue #406) headless against
// a running dev server. The arrows cross a page edge — Move up on a page's
// first block lands it at the end of the page before, Move down on the last at
// the top of the page after — and "Move to page…" beside them lists every page
// and lands the block at the end of the chosen one. Each is one undo step, the
// editor follows the block, and the move autosaves. Covers and full-page photos
// take no part either way; a block that doesn't fit where it lands gets the
// existing overflow marker. The menu is checked by keyboard too, and at a zoom.
//
// It mints its own scratch admin + session + draft issue and removes them again
// in the finally block — it never seeds and never touches existing rows.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-move-block-gate.mts <base-url>
import postgres from "postgres";
import { chromium, type Page } from "playwright";
import type { IssueContent } from "../src/lib/blocks";
import { content } from "./move-block-gate-fixture.mts";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: dev-move-block-gate.mts <base-url>");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const sql = postgres(process.env.DATABASE_URL!);
const userId = crypto.randomUUID();
const issueId = crypto.randomUUID();
const token = crypto.randomUUID();
const email = `scratch-406-${userId.slice(0, 8)}@example.invalid`;

const rail = (n: number) =>
  `button[aria-label="Page ${n}${n === 1 ? " (cover)" : ""}"]`;
const block = (id: string) => `[data-block-id="${id}"]`;
const ctrl = (id: string, label: string) =>
  `${block(id)} button[aria-label="${label}"]`;
const MENU = '[role="menu"][aria-label="Move to page"]';

const stored = async () => {
  const [row] = await sql<
    { content: IssueContent }[]
  >`select content from issues where id = ${issueId}`;
  return row!.content;
};
const waitSaved = async (check: (c: IssueContent) => boolean, what: string) => {
  for (let i = 0; i < 100; i++) {
    if (check(await stored())) return ok(true, `autosaved: ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`FAIL: autosave did not reach: ${what}`);
};
const orderOf = (c: IssueContent, pageId: string) =>
  c.pages
    .find((p) => p.id === pageId)!
    .blocks.map((b) => b.id)
    .join(",");

/** The page open now (from the rail) and the block order the canvas shows. */
const state = (page: Page) =>
  page.evaluate(() => ({
    page:
      document
        .querySelector('[aria-current="page"]')
        ?.getAttribute("aria-label") ?? null,
    blocks: Array.from(
      document.querySelectorAll("[data-page-frame] [data-block-id]"),
    )
      .map((el) => el.getAttribute("data-block-id"))
      .join(","),
    selected:
      document
        .querySelector(
          "[data-page-frame] [data-block-id] button[aria-label='Delete']",
        )
        ?.closest("[data-block-id]")
        ?.getAttribute("data-block-id") ?? null,
    overflow:
      document
        .querySelector('[data-page-frame] [role="status"]')
        ?.textContent?.trim() ?? null,
    focus:
      (document.activeElement as HTMLElement | null)?.getAttribute(
        "aria-label",
      ) ??
      document.activeElement?.tagName.toLowerCase() ??
      null,
  }));

const expect = async (
  page: Page,
  want: { page: string; blocks: string; selected?: string | null },
  msg: string,
) => {
  const s = await state(page);
  ok(
    s.page === want.page &&
      s.blocks === want.blocks &&
      (want.selected === undefined || s.selected === want.selected),
    `${msg} (on ${s.page}: ${s.blocks}${want.selected !== undefined ? `, selected ${s.selected}` : ""})`,
  );
};

const select = async (page: Page, id: string) => {
  await page.click(block(id), { force: true, position: { x: 4, y: 4 } });
  await page.waitForSelector(ctrl(id, "Delete"));
};
const go = async (page: Page, n: number) => {
  await page.click(rail(n));
  await page.waitForSelector(`${rail(n)}[aria-current="page"]`);
};

const menuRows = (page: Page) =>
  page.$$eval(`${MENU} [role="menuitemradio"]`, (els) =>
    els.map((el) => ({
      label: el.querySelector("[data-page-label]")?.textContent?.trim() ?? "",
      hint: el.querySelector("[data-page-hint]")?.textContent?.trim() ?? null,
      checked: el.getAttribute("aria-checked") === "true",
      disabled: el.getAttribute("aria-disabled") === "true",
    })),
  );
const focusedRow = (page: Page) =>
  page.evaluate(
    () =>
      document.activeElement
        ?.querySelector("[data-page-label]")
        ?.textContent?.trim() ?? null,
  );

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${userId}, ${email}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${userId}, now() + interval '1 day')`;
  await sql`insert into issues (id, title, theme, status, content, footer_mark_size, footer_text_size)
            values (${issueId}, 'Scratch 406', 'classic', 'draft', ${sql.json(content as never)}, 36, 12)`;
  console.log(`scratch draft ${issueId}, user ${email}`);

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await ctx.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/admin/issues/${issueId}/edit`);
  await page.waitForSelector("[data-editor-block]");

  heading("The arrows cross a page edge");
  await go(page, 2);
  await select(page, "a");
  // First a no-op at the start of the issue's content: nothing moves, no step.
  await select(page, "h2");
  await page.click(ctrl("h2", "Move up"));
  await expect(
    page,
    { page: "Page 2", blocks: "h2,a", selected: "h2" },
    "Move up on page 2's first block does nothing (the cover is before it)",
  );
  await page.keyboard.press("Control+z");
  ok(
    (await page.textContent("[aria-live]")) === "Nothing to undo" ||
      (await page.locator("[aria-live]").allTextContents()).some((t) =>
        t.includes("Nothing to undo"),
      ),
    "…and took no undo step",
  );

  await select(page, "a");
  await page.focus(ctrl("a", "Move down"));
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${rail(3)}[aria-current="page"]`);
  await expect(
    page,
    { page: "Page 3", blocks: "a,b,c", selected: "a" },
    "Enter on Move down takes the last block to the top of page 3, selected",
  );
  const focusAfter = (await state(page)).focus;
  ok(
    focusAfter === "Move down",
    `keyboard focus stays on the block's Move down (${focusAfter})`,
  );
  await waitSaved(
    (c) => orderOf(c, "p2") === "h2" && orderOf(c, "p3") === "a,b,c",
    "the crossing",
  );

  await page.keyboard.press("Control+z");
  await expect(
    page,
    { page: "Page 2", blocks: "h2,a", selected: "a" },
    "undo returns it in one step, back on page 2",
  );
  await page.keyboard.press("Control+Shift+z");
  await expect(
    page,
    { page: "Page 3", blocks: "a,b,c", selected: "a" },
    "redo crosses again",
  );
  await page.click(ctrl("a", "Move up"));
  await expect(
    page,
    { page: "Page 2", blocks: "h2,a", selected: "a" },
    "Move up on page 3's first block takes it to the end of page 2",
  );
  await waitSaved(
    (c) => orderOf(c, "p2") === "h2,a" && orderOf(c, "p3") === "b,c",
    "the return",
  );

  heading("Edges a block can't cross");
  await go(page, 3);
  await select(page, "c");
  await page.click(ctrl("c", "Move down"));
  await expect(
    page,
    { page: "Page 3", blocks: "b,c", selected: "c" },
    "Move down before a full-page photo's page does nothing",
  );
  await go(page, 5);
  await select(page, "e");
  ok((await state(page)).overflow === null, "page 5 fits as it stands");
  await page.click(ctrl("e", "Move down"));
  await expect(
    page,
    { page: "Page 5", blocks: "e", selected: "e" },
    "Move down on the last page does nothing",
  );
  await go(page, 4);
  await select(page, "d");
  ok(
    (await page.$(ctrl("d", "Move to page…"))) === null,
    "a full-page photo offers no Move to page…",
  );
  await page.click(ctrl("d", "Move up"));
  await expect(
    page,
    { page: "Page 4", blocks: "d", selected: "d" },
    "…and its arrows don't take it off the page it owns",
  );
  await go(page, 1);
  await select(page, "cover-sponsor");
  ok(
    (await page.$(ctrl("cover-sponsor", "Move to page…"))) === null,
    "a block on a cover offers no Move to page…",
  );
  await page.click(ctrl("cover-sponsor", "Move down"));
  await expect(
    page,
    { page: "Page 1 (cover)", blocks: "cover-heading,cover-sponsor" },
    "…and its arrows keep today's behaviour on the cover",
  );

  heading("Move to page…");
  await go(page, 3);
  await select(page, "b");
  const trigger = ctrl("b", "Move to page…");
  ok(
    (await page.getAttribute(trigger, "aria-haspopup")) === "menu",
    "the control announces a menu",
  );
  await page.click(trigger);
  await page.waitForSelector(MENU);
  const rows = await menuRows(page);
  console.log(
    "  " +
      rows
        .map(
          (r) =>
            `${r.label}${r.hint ? ` (${r.hint})` : ""}${r.checked ? " ✓" : ""}${r.disabled ? " ·dim" : ""}`,
        )
        .join(" | "),
  );
  ok(
    rows.map((r) => r.label).join(",") ===
      "The cover,Page 2,Page 3,Page 4,Page 5",
    "every page is listed in order, named like the discussion's tags",
  );
  ok(
    rows[1]!.hint === "Club background" && rows[2]!.hint === null,
    "a page's first heading is its hint",
  );
  ok(rows[2]!.checked && rows[2]!.disabled, "this page is marked and disabled");
  ok(
    rows[0]!.disabled && rows[3]!.disabled,
    "the cover and the full-page photo's page are disabled",
  );
  ok(
    rows[3]!.hint === "Full-page photo",
    "a page that can't take the block says why",
  );
  ok(!rows[1]!.disabled && !rows[4]!.disabled, "the other pages can be chosen");
  ok(
    (await focusedRow(page)) === "Page 3",
    "the menu opens with focus on this page",
  );
  // Forced: Playwright treats an aria-disabled row as not actionable.
  await page.click(`${MENU} [role="menuitemradio"]:nth-child(1)`, {
    force: true,
  });
  ok(
    (await page.$(MENU)) !== null && (await state(page)).page === "Page 3",
    "a disabled row does nothing",
  );
  await page.keyboard.press("Escape");
  ok((await page.$(MENU)) === null, "Escape closes the menu");
  ok(
    (await state(page)).focus === "Move to page…",
    "…with focus back on the control",
  );
  ok((await state(page)).selected === "b", "…and the block still selected");

  // Keyboard: open, arrow, choose.
  await page.keyboard.press("ArrowDown");
  await page.waitForSelector(MENU);
  await page.keyboard.press("ArrowDown");
  ok((await focusedRow(page)) === "Page 4", "ArrowDown moves to the next row");
  await page.keyboard.press("End");
  ok((await focusedRow(page)) === "Page 5", "End reaches the last page");
  await page.keyboard.press("Enter");
  await page.waitForSelector(`${rail(5)}[aria-current="page"]`);
  await expect(
    page,
    { page: "Page 5", blocks: "e,b", selected: "b" },
    "Enter moves the block to the end of page 5, selected, the editor following",
  );
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") === "Move to page…",
  );
  ok(true, "…with focus back on Move to page…");
  await page.waitForSelector('[data-page-frame] [role="status"]');
  const after = (await state(page)).overflow;
  ok(
    after !== null && /overflows/i.test(after),
    `a block that doesn't fit shows the overflow marker (${after})`,
  );
  ok(
    (await page.$(`${block("b")} [role="status"] button`)) !== null,
    "…with its usual action",
  );
  await waitSaved(
    (c) => orderOf(c, "p3") === "c" && orderOf(c, "p5") === "e,b",
    "the move",
  );
  await page.keyboard.press("Control+z");
  await expect(
    page,
    { page: "Page 3", blocks: "b,c", selected: "b" },
    "undo returns it in one step, back on page 3",
  );
  await page.keyboard.press("Control+y");
  await expect(
    page,
    { page: "Page 5", blocks: "e,b", selected: "b" },
    "redo moves it again",
  );
  await page.keyboard.press("Control+z");

  // The emptied page stays; a block landing on it by mouse, at a zoom.
  await go(page, 3);
  await select(page, "c");
  await page.click(ctrl("c", "Move to page…"));
  await page.waitForSelector(MENU);
  await page.click(`${MENU} [role="menuitemradio"]:nth-child(2)`);
  await page.waitForSelector(`${rail(2)}[aria-current="page"]`);
  await expect(
    page,
    { page: "Page 2", blocks: "h2,a,c", selected: "c" },
    "a click moves the block to the end of page 2",
  );
  ok(
    (await stored()).pages.length === 5,
    "no page is added or removed by a move",
  );
  await go(page, 3);
  await select(page, "b");
  await page.click(ctrl("b", "Move to page…"));
  await page.waitForSelector(MENU);
  await page.click(`${MENU} [role="menuitemradio"]:nth-child(2)`);
  await page.waitForSelector(`${rail(2)}[aria-current="page"]`);
  await go(page, 3);
  ok((await state(page)).blocks === "", "the page left empty stays in place");
  await waitSaved(
    (c) =>
      orderOf(c, "p2") === "h2,a,c,b" &&
      orderOf(c, "p3") === "" &&
      c.pages.length === 5,
    "the emptied page",
  );

  heading("At a zoom");
  await go(page, 2);
  // Zoomed about the page's top edge, so the first block stays in view.
  await page.hover("[data-page-frame]", { position: { x: 240, y: 30 } });
  await page.mouse.wheel(0, -400);
  const scale = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-page-frame]");
    return el ? el.getBoundingClientRect().width / 640 : 0;
  });
  ok(scale > 1, `the canvas is zoomed in (${scale.toFixed(2)}×)`);
  await select(page, "h2");
  const box = await page.locator(ctrl("h2", "Move to page…")).boundingBox();
  ok(
    box !== null && Math.abs(box.width - 24 * 1.1) < 1.5,
    `the control keeps the chrome's size at this zoom (${box?.width.toFixed(1)}px)`,
  );
  await page.click(ctrl("h2", "Move to page…"));
  await page.waitForSelector(MENU);
  const menuBox = await page.locator(MENU).boundingBox();
  ok(
    menuBox !== null &&
      menuBox.x >= 0 &&
      menuBox.y >= 0 &&
      menuBox.x + menuBox.width <= 1280 &&
      menuBox.y + menuBox.height <= 900,
    "the menu sits inside the viewport",
  );
  await page.click(`${MENU} [role="menuitemradio"]:nth-child(5)`);
  await page.waitForSelector(`${rail(5)}[aria-current="page"]`);
  await expect(
    page,
    { page: "Page 5", blocks: "e,h2", selected: "h2" },
    "a choice at this zoom lands the block",
  );
  await waitSaved((c) => orderOf(c, "p5") === "e,h2", "the zoomed move");

  ok(errors.length === 0, `no page errors (${errors.join("; ")})`);
  console.log("\nall checks passed");
} finally {
  await browser.close();
  await sql`delete from issues where id = ${issueId}`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${userId}`;
  await sql.end();
}
