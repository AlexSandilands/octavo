// The per-block Ask half of dev-assistant-tools-gate.mts (#311): the last
// control in a selected block's own bar, inside the canvas even on a wide
// photo bar at 1440 and 900px. Its box is a named dialog that keeps Tab inside
// it; Escape closes it with focus back on Ask; Ctrl+Z typed in it never
// reaches the editor; Send opens the panel on an ordinary run whose `set_text`
// lands on that block, with the run's line and Undo. Absent on a published
// issue (the `--off` panel gate checks a server with it off). With the month
// spent and the panel never opened, nothing is sent and the words stay.
import type { Page } from "playwright";
import type postgres from "postgres";
import { AI_ERROR_COPY } from "../src/lib/ai-chat-contract";
import {
  block,
  canonical,
  content,
  ids,
  until,
  type Doc,
  type watchChat,
} from "./fixtures/assistant/tools-gate-kit.mts";

const PANEL = "aside#editor-side-panel";
const CLOSE =
  'nav[aria-label="Editor panels"] button[aria-label="Close panel"]';
const RUN = "[data-assistant-run]";
const LOG = '[role="log"]';
const DIALOG =
  '[role="dialog"][aria-label="Ask the assistant about this block"]';
const PILL = `[data-block-id="${ids.story}"] [data-ask] > button`;
const BOX = `${DIALOG} input`;

const panelOpen = (page: Page) =>
  page.$eval(
    PANEL,
    (el) => !el.hasAttribute("aria-hidden") && el.clientWidth > 0,
  );
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
  });

export async function checkAsk(d: {
  page: Page;
  sql: postgres.Sql;
  adminId: string;
  draftId: string;
  chat: ReturnType<typeof watchChat>;
  base: string;
  publishedId: string;
  saved: () => Promise<Doc>;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
}) {
  const { page, chat, saved, ok, heading } = d;
  const storyBefore = canonical(block(await saved(), ids.story)?.text);
  ok(
    storyBefore === canonical(content.pages[1]!.blocks[3]!.text),
    "the story starts as the fixture wrote it",
  );

  heading("Ask: the last control in the block's own bar");
  await page.click(CLOSE);
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.hasAttribute("aria-hidden"),
    PANEL,
  );
  await page.click(`[data-block-id="${ids.story}"]`, {
    position: { x: 200, y: 8 },
  });
  await page.waitForSelector(PILL);
  // Ask is the text bar's last control: Tab from Link lands on it.
  await page.focus(
    `[data-block-id="${ids.story}"] [data-block-bar] button[title="Link"]`,
  );
  await page.keyboard.press("Tab");
  ok(
    (await focused(page)) === "Ask" &&
      (await page.$eval(PILL, (el) => Boolean(el.closest("[data-block-bar]")))),
    "Ask is the last control in the block's own bar, after Link",
  );
  ok(
    (await page.getAttribute(PILL, "aria-haspopup")) === "dialog" &&
      (await page.getAttribute(PILL, "aria-expanded")) === "false",
    "announced as opening a dialog, closed",
  );
  await page.keyboard.press("Enter");
  await page.waitForSelector(DIALOG);
  ok(
    (await focused(page)) === "What should the assistant do with this block?",
    "Enter opens a named dialog with the focus in its labelled box",
  );

  heading("Ask: Tab stays in the box");
  await page.keyboard.type("never sent");
  await page.keyboard.press("Tab");
  ok((await focused(page)) === "Send", "Tab goes to Send");
  await page.keyboard.press("Tab");
  ok(
    (await focused(page)) === "What should the assistant do with this block?",
    "and Tab again comes back round to the box",
  );
  await page.keyboard.press("Shift+Tab");
  ok(
    (await focused(page)) === "Send" && (await page.$(DIALOG)) !== null,
    "Shift+Tab goes back to Send; the box is still open",
  );

  heading("Ask: Escape closes it, focus back on Ask");
  await page.keyboard.press("Escape");
  ok((await page.$(DIALOG)) === null, "Escape closed the box");
  ok((await focused(page)) === "Ask", "and the focus is back on Ask");
  ok(
    (await page.$(PILL)) !== null,
    "the block is still selected (the stage's Escape didn't deselect it)",
  );

  heading("Ask: Send runs on that block, and the panel opens");
  const script = JSON.stringify([
    {
      toolName: "set_text",
      input: { blockId: ids.story, markdown: "ASKED EDIT" },
    },
  ]);
  await page.keyboard.press("Enter");
  await page.fill(BOX, `Tighten this [fake:tools]${script}`);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "false",
    LOG,
    { timeout: 60_000 },
  );
  ok(await panelOpen(page), "the panel opened on the run");
  ok((await page.$(DIALOG)) === null, "the box closed");
  ok(
    chat.asked.at(-1) ===
      `About the selected block [${ids.story}] on page 2: Tighten this [fake:tools]${script}`,
    "the message went with the block id and page",
  );
  const bubble = (
    await page.$$eval(`${LOG} .self-end`, (els) =>
      els.map((el) => el.textContent ?? ""),
    )
  ).at(-1);
  ok(
    bubble?.includes("About the selected block on page 2: Tighten this") &&
      !bubble.includes(`[${ids.story}]`),
    "the author reads it without the id",
  );
  await until("autosave of the Ask", async () =>
    JSON.stringify(block(await saved(), ids.story)).includes("ASKED EDIT"),
  );
  ok(true, "set_text landed on the story");
  const line = (await page.textContent(RUN))?.trim();
  ok(
    /^Changed 1 block on page 2\s*Undo$/.test(line ?? ""),
    `the run's line, with Undo (${line})`,
  );

  heading("Ask: Ctrl+Z typed in the box stays in the box");
  await page.click(`[data-block-id="${ids.story}"]`, {
    position: { x: 200, y: 8 },
  });
  await page.click(PILL);
  await page.waitForSelector(DIALOG);
  await page.keyboard.type("abc");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(1_000);
  ok(
    JSON.stringify(block(await saved(), ids.story)).includes("ASKED EDIT") &&
      (await page.$(RUN)) !== null,
    "the run is still in place: the editor's undo stood down",
  );
  await page.keyboard.press("Escape");
  await page.click(`${RUN} button:text-is("Undo")`);
  await until(
    "autosave of the Ask's Undo",
    async () =>
      canonical(block(await saved(), ids.story)?.text) === storyBefore,
  );
  ok(true, "the panel's Undo took the Ask's run back in one step");

  heading("Ask: in reach, box and all, at 1440, 900 and 768");
  await checkReach(page, ok);

  heading("Ask: not on a published issue");
  // In a second tab: this one's conversation carries on.
  const other = await page.context().newPage();
  await other.goto(`${d.base}/admin/issues/${d.publishedId}/edit`);
  await other.click('button[aria-label="Page 2"]');
  await other.click(`[data-block-id="${ids.story}"]`, {
    position: { x: 200, y: 8 },
  });
  await other.waitForSelector(
    `[data-block-id="${ids.story}"] [data-block-bar]`,
  );
  ok((await other.$("[data-ask]")) === null, "no Ask on a selected block");
  await other.close();

  heading("Ask: a spent month, the panel never opened, keeps the words");
  const spendId = crypto.randomUUID();
  await d.sql`insert into ai_usage (id, user_id, issue_id, run_id, model,
    provider, prompt_tokens, cache_read_tokens, cache_write_tokens,
    completion_tokens, cost_usd) values (${spendId}, ${d.adminId},
    ${d.draftId}, ${crypto.randomUUID()}, 'fake', 'fake', 0, 0, 0, 0, 9999)`;
  const fresh = await page.context().newPage();
  try {
    let posted = 0;
    fresh.on("request", (req) => {
      if (req.url().endsWith("/api/admin/ai/chat")) posted++;
    });
    await fresh.goto(`${d.base}/admin/issues/${d.draftId}/edit`);
    await fresh.click('button[aria-label="Page 2"]');
    await fresh.click(`[data-block-id="${ids.story}"]`, {
      position: { x: 200, y: 8 },
    });
    await fresh.click(PILL);
    await fresh.fill(BOX, "Tighten this");
    await fresh.keyboard.press("Enter");
    await fresh.waitForSelector(`${DIALOG} [role="alert"]`);
    ok(
      (await fresh.inputValue(BOX)) === "Tighten this" && posted === 0,
      "nothing was sent and the box keeps the words",
    );
    ok(
      (await fresh.textContent(`${DIALOG} [role="alert"]`))?.includes(
        AI_ERROR_COPY.budget_spent,
      ),
      "and says the month's budget is spent",
    );
  } finally {
    await fresh.close();
    await d.sql`delete from ai_usage where id = ${spendId}`;
  }
}

/** Until the stage and a block hold still across two frames, with no transition
 * running: a click right after a resize can land before the canvas re-fits. */
const settled = (page: Page, id: string) =>
  page.waitForFunction(
    (blockId) =>
      new Promise<boolean>((done) => {
        const rects = () =>
          JSON.stringify(
            ["[data-editor-canvas-stage]", `[data-block-id="${blockId}"]`].map(
              (sel) => document.querySelector(sel)?.getBoundingClientRect(),
            ),
          );
        const first = rects();
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            done(
              first === rects() &&
                document
                  .getAnimations()
                  .every(
                    (a) =>
                      a.playState !== "running" ||
                      a.effect?.getTiming().iterations === Infinity,
                  ),
            ),
          ),
        );
      }),
    id,
  );

/** Every bar's Ask and its open box stay inside the canvas and clear of its
 * standing tools, panel open or not. */
async function checkReach(page: Page, ok: (c: unknown, m: string) => void) {
  const blocks = [
    ["heading", ids.head, undefined],
    ["text", ids.story, undefined],
    ["photo", ids.photo, { x: 30, y: 30 }],
  ] as const;
  const inside = (sel: string) =>
    page.$eval(sel, (el) => {
      const r = el.getBoundingClientRect();
      const s = el
        .closest("[data-editor-canvas-stage]")!
        .getBoundingClientRect();
      // Clear of the canvas's tools, where they stand on end at its edge.
      const t = document
        .querySelector(
          '[data-bar-placement="left"], [data-bar-placement="right"]',
        )
        ?.getBoundingClientRect();
      const clear = !t || r.left >= t.right || r.right <= t.left;
      return r.left >= s.left && r.right <= s.right && r.top >= s.top && clear;
    });
  for (const withPanel of [false, true]) {
    if ((await panelOpen(page)) !== withPanel)
      await page.click(
        withPanel
          ? 'nav[aria-label="Editor panels"] button[aria-label="Assistant"]'
          : CLOSE,
      );
    await page.waitForFunction(
      ([sel, want]) => {
        const el = document.querySelector(sel as string);
        return !el?.hasAttribute("aria-hidden") === want;
      },
      [PANEL, withPanel] as const,
    );
    for (const width of [1440, 900, 768]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, id, position] of blocks) {
        const ask = `[data-block-id="${id}"] [data-ask] > button`;
        await settled(page, id);
        await page.click(`[data-block-id="${id}"]`, { position, force: true });
        await page.waitForSelector(ask);
        await page.waitForTimeout(300);
        await page.click(ask);
        await page.waitForSelector(DIALOG);
        const at = `${width}px, panel ${withPanel ? "open" : "closed"}`;
        ok(
          (await inside(ask)) && (await inside(DIALOG)),
          `${at}: the ${name} bar's Ask and its box are inside the canvas, clear of its tools`,
        );
        // Once for the box, once to deselect: the bar would cover the next block.
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await page.waitForSelector(ask, { state: "detached" });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
