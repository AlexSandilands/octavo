// The per-block Ask half of dev-assistant-tools-gate.mts (#311): the pill on a
// selected block, reached by Tab from the block's own bar; its box is a named
// dialog; Escape closes it with focus back on the pill; Ctrl+Z typed in it
// never reaches the editor; Send opens the panel on an ordinary run whose
// `set_text` lands on that block, with the run's line and Undo. Absent on a
// published issue (the `--off` panel gate checks a server with it off).
import type { Page } from "playwright";
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

  heading("Ask: the pill, reached from the block's own bar");
  await page.click(CLOSE);
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.hasAttribute("aria-hidden"),
    PANEL,
  );
  await page.click(`[data-block-id="${ids.story}"]`, {
    position: { x: 200, y: 8 },
  });
  await page.waitForSelector(PILL);
  // The last control on the text bar, then Tab: the pill comes next.
  await page.$$eval(
    `[data-block-id="${ids.story}"] [data-block-bar] button`,
    (buttons) => (buttons.at(-1) as HTMLElement).focus(),
  );
  await page.keyboard.press("Tab");
  ok((await focused(page)) === "Ask", "Tab from the block's bar lands on Ask");
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

  heading("Ask: Escape closes it, focus back on the pill");
  await page.keyboard.type("never sent");
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
}
