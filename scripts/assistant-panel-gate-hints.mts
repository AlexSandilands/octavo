// dev-assistant-panel-gate.mts's hints and suggested follow-ups (#366): the
// row of four and More ideas, Shorten to fit pinned on a page that runs over,
// Compose cover on a cover, the row holding still through a run and dealing
// again when its reply lands; then a reply that offers something, as a 44px
// button that says whose suggestion it is and what it sends, the ghost in the
// composer and Tab (taking it, or moving on), the cost question turning the
// button off, pressing it, a suggestion with a link ignored, and Undo taking
// the button with the run. `shots` saves the screens the PR describes.
import type { Page, Request } from "playwright";
import type postgres from "postgres";
import { PANEL_BUTTON, openSurface } from "./editor-panel-gate-support.mts";

const LOG = '[role="log"]';
const INPUT = "#assistant-input";
const HINTS = "[data-assistant-hints] button[data-hint]";
const MORE = "[data-more-ideas]";
const FOLLOW = "[data-assistant-follow-up]";
const FOLLOW_BUTTON = `${FOLLOW} button`;
const MESSAGE = "Yes, go ahead and tidy page 1.";

type Content = {
  pages: { blocks: { id: string; type: string }[]; cover?: boolean }[];
};

export async function checkHints(d: {
  page: Page;
  base: string;
  sql: postgres.Sql;
  draftId: string;
  pageCount: number;
  shots?: string;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
}) {
  const { page, ok, heading } = d;
  const shot = async (name: string) => {
    if (d.shots) await page.screenshot({ path: `${d.shots}/${name}.png` });
  };
  const hints = () =>
    page.$$eval(HINTS, (els) => els.map((e) => e.textContent));
  const idle = () =>
    page.waitForFunction(
      (sel) =>
        document.querySelector(sel)?.getAttribute("aria-busy") === "false",
      LOG,
      { timeout: 30_000 },
    );
  const asked: string[] = [];
  const onRequest = (r: Request) => {
    if (!r.url().endsWith("/api/admin/ai/chat")) return;
    const body = r.postDataJSON() as {
      messages: { role: string; parts: { type: string; text?: string }[] }[];
    };
    const last = body.messages.at(-1)!;
    if (last.role === "user")
      asked.push(last.parts.find((p) => p.type === "text")?.text ?? "");
  };
  page.on("request", onRequest);
  const send = async (text: string) => {
    await page.fill(INPUT, text);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (sel) =>
        document.querySelector(sel)?.getAttribute("aria-busy") === "true",
      LOG,
    );
    await idle();
    await page.waitForTimeout(400);
  };

  try {
    heading("Hints (#366)");
    await page.goto(`${d.base}/admin/issues/${d.draftId}/edit`);
    await page.waitForSelector(PANEL_BUTTON);
    await openSurface(page, "Assistant");
    await page.waitForSelector(INPUT);
    await page.waitForSelector(HINTS);
    const cover = await hints();
    ok(
      cover[0] === "Compose cover" &&
        cover.length === 4 &&
        !cover.includes("Tidy this page") &&
        (await page.$(MORE)) === null,
      `a cover: Compose cover first, three more cover hints, no More ideas (${cover.join(", ")})`,
    );
    await page.click('button[aria-label="Page 2"]');
    await page.waitForTimeout(600);
    const first = await hints();
    ok(
      first.length === 4 && !first.includes("Compose cover"),
      `an inside page: four hints (${first.join(", ")})`,
    );
    const heights = await page.$$eval(`${HINTS}, ${MORE}`, (els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height)),
    );
    ok(
      heights.every((h) => h === 36),
      `the pills keep #310's height (${[...new Set(heights)].join()}px)`,
    );
    await shot("hints-a");
    await page.focus(MORE);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const second = await hints();
    ok(
      second.length === 4 && second.every((h) => !first.includes(h)),
      `More ideas: four others (${second.join(", ")})`,
    );
    ok(
      await page.evaluate(() =>
        document.activeElement?.hasAttribute("data-more-ideas"),
      ),
      "and keeps the focus",
    );
    await shot("hints-b");
    await page.waitForTimeout(1_000);
    ok(
      (await hints()).join() === second.join(),
      "the row holds still while nothing happens",
    );
    await page.click(`button[aria-label="Page ${d.pageCount}"]`);
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent === "Shorten to fit",
      HINTS,
      { timeout: 10_000 },
    );
    ok(true, "a page that runs over: Shorten to fit, first");

    heading("The row through a run");
    await page.click('button[aria-label="Page 2"]');
    await page.waitForTimeout(600);
    const before = await hints();
    await page.fill(INPUT, "What's on this page? [fake:slow]");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1_500);
    ok(
      (await hints()).join() === before.join() &&
        (await page.$eval(HINTS, (el) => el.getAttribute("aria-disabled"))) ===
          "true",
      "mid-run: the same hints, off",
    );
    await idle();
    await page.waitForTimeout(400);
    const after = await hints();
    ok(
      after.join() !== before.join(),
      `the reply landed: dealt again (${after.join(", ")})`,
    );

    heading("A suggested follow-up (#366)");
    await send("Is page 1 tidy? Don't change anything yet. [fake:offer]");
    const log = (await page.textContent(LOG)) ?? "";
    ok(
      log.includes("Want me to go ahead and tidy page 1?") &&
        !log.includes("[[next"),
      "the reply offers, and its suggestion line isn't shown",
    );
    const button = page.locator(FOLLOW_BUTTON);
    const box = await button.boundingBox();
    ok(
      (await button.textContent())?.trim() === "Go ahead" &&
        Math.round(box?.height ?? 0) === 44,
      "one 44px button with the model's label",
    );
    const group = (await page.textContent(FOLLOW)) ?? "";
    ok(
      group.includes("Suggested by the assistant") &&
        group.includes(`Sends: “${MESSAGE}”`) &&
        (await page.getAttribute(FOLLOW, "aria-label")) ===
          "Suggested by the assistant",
      "marked as the assistant's suggestion, with the words it sends",
    );
    const described = await page.$eval(
      FOLLOW_BUTTON,
      (el) =>
        document.getElementById(el.getAttribute("aria-describedby") ?? "")
          ?.textContent,
    );
    ok(described === `Sends: “${MESSAGE}”`, "which the button is described by");
    await shot("follow-up");

    heading("Keyboard");
    await page.focus(FOLLOW_BUTTON);
    await page.keyboard.press("Tab");
    const next = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-hint"),
    );
    ok(next, `Tab from it goes on to the hints (${next})`);
    await page.keyboard.press("Shift+Tab");
    ok(
      await page.evaluate(
        () =>
          document.activeElement?.closest("[data-assistant-follow-up]") !==
          null,
      ),
      "and Shift+Tab comes back to it: after the reply, before the hints",
    );
    await page.focus(INPUT);
    ok(
      (await page.getAttribute(INPUT, "placeholder")) ===
        `${MESSAGE} (Tab to use)`,
      "the empty box shows it ghosted, with Tab",
    );
    const sr = await page.$eval(INPUT, (el) =>
      (el.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .map((id) => document.getElementById(id)?.textContent)
        .join(" "),
    );
    ok(
      sr === `Suggested: ${MESSAGE} Press Tab to use it.`,
      "a screen reader hears it",
    );
    await shot("ghost");
    await page.keyboard.press("Shift+Tab");
    ok(
      (await page.evaluate(() => document.activeElement?.id)) !==
        "assistant-input" && (await page.inputValue(INPUT)) === "",
      "Shift+Tab moves back, the box left empty",
    );
    await page.focus(INPUT);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
    const caret = await page.$eval(INPUT, (el) => {
      const t = el as HTMLTextAreaElement;
      return [document.activeElement === t, t.selectionStart, t.value.length];
    });
    ok(
      (await page.inputValue(INPUT)) === MESSAGE &&
        caret[0] === true &&
        caret[1] === caret[2] &&
        (await page.isEnabled('button[aria-label="Send"]')),
      "Tab takes it into the box: focus stays, caret at the end, Send on",
    );
    await shot("after-tab");
    await page.keyboard.press("Tab");
    ok(
      (await page.evaluate(() => document.activeElement?.id)) !==
        "assistant-input" && (await page.inputValue(INPUT)) === MESSAGE,
      "Tab again (the box has words) moves on: no trap",
    );
    await page.fill(INPUT, "My own words");
    await page.focus(INPUT);
    await page.keyboard.press("Tab");
    ok(
      (await page.inputValue(INPUT)) === "My own words" &&
        (await page.evaluate(() => document.activeElement?.id)) !==
          "assistant-input",
      "with the author's own words, Tab moves on and leaves them",
    );
    await page.fill(INPUT, "");

    heading("The cost question holds it");
    await page.fill(INPUT, "A long note. ".repeat(400));
    await page.keyboard.press("Enter");
    await page.waitForSelector("[data-assistant-paste-confirm]");
    ok(
      (await page.getAttribute(FOLLOW_BUTTON, "aria-disabled")) === "true",
      "while it asks, the button is off",
    );
    const sent = asked.length;
    await page.click(FOLLOW_BUTTON, { force: true });
    await page.waitForTimeout(600);
    ok(asked.length === sent, "and pressing it sends nothing");
    await page.click('[data-assistant-paste-confirm] button:text-is("Cancel")');
    await page.fill(INPUT, "");

    heading("Pressing it");
    await page.click(FOLLOW_BUTTON);
    await page.waitForFunction((sel) => !document.querySelector(sel), FOLLOW);
    ok(true, "sent: the button goes at once");
    await idle();
    await page.waitForTimeout(400);
    ok(asked.at(-1) === MESSAGE, "it sent exactly the words it showed");
    ok(
      (await page.$(FOLLOW)) === null &&
        (await page.getAttribute(INPUT, "placeholder")) ===
          "Ask about this issue…",
      "the next reply offers nothing: no button, the usual placeholder",
    );

    heading("A suggestion with a link");
    await send("Anything to add? [fake:offer-link]");
    const linked = (await page.textContent(LOG)) ?? "";
    ok(
      linked.includes("Shall I add the club's page?") &&
        !linked.includes("[[next") &&
        !linked.includes("example.com") &&
        (await page.$(FOLLOW)) === null,
      "ignored: no button, and the line isn't shown",
    );

    heading("Undo takes it with the run");
    const [row] = await d.sql<{ content: Content }[]>`
      select content from issues where id = ${d.draftId}`;
    const text = row!.content.pages
      .flatMap((p) => (p.cover ? [] : p.blocks))
      .find((b) => b.type === "text")!;
    await send(
      `Change it [fake:offer] [fake:tools]${JSON.stringify([
        {
          toolName: "set_text",
          input: { blockId: text.id, markdown: "A new first paragraph." },
        },
      ])}`,
    );
    ok(
      (await page.isVisible("[data-assistant-run]")) &&
        (await page.isVisible(FOLLOW)),
      "a run that changed a block and offers more: its line and the button",
    );
    await page.click('[data-assistant-run] button:text-is("Undo")');
    await page.waitForTimeout(400);
    ok(
      (await page.$(FOLLOW)) === null &&
        (await page.getAttribute(INPUT, "placeholder")) ===
          "Ask about this issue…",
      "Undo: the button and the ghost go with it",
    );
  } finally {
    page.off("request", onRequest);
  }
}
