// The one send seam (#312) from the Ask boxes: a request over
// CONFIRM_FROM_CHARS typed into a block's or a cover item's Ask closes the box
// and asks in the panel, sending nothing; while the question is up the
// composer is read-only, Attach and the presets are off, a preset sends
// nothing and another Ask is refused with the words kept; Cancel hands the
// words to the composer. Used by dev-assistant-tools-gate.mts (a block) and
// assistant-tools-gate-cover.mts (a cover story).
import type { Page } from "playwright";
import { CONFIRM_FROM_CHARS } from "../../../src/features/editor/assistant/paste-estimate";
import { showHint } from "./show-hint.mts";

const INPUT = "#assistant-input";
const CONFIRM = "[data-assistant-paste-confirm]";
const WAITING = "asking about a long message";

export async function askSeamChecks(
  page: Page,
  d: {
    /** Which surface, for the messages. */
    label: string;
    /** Selects the block or item, so its bar shows Ask. */
    select: () => Promise<void>;
    /** The Ask button in its bar, and the box it opens. */
    ask: string;
    dialog: string;
    /** A preset the panel shows here. */
    preset: string;
    ok: (cond: unknown, msg: string) => void;
    heading: (name: string) => void;
  },
) {
  const { label, ok } = d;
  d.heading(`${label}: a long Ask asks in the panel`);
  // The hints rotate (#366): the one checked below is brought up first.
  await showHint(page, d.preset);
  let requests = 0;
  const count = (req: { url(): string; method(): string }) => {
    if (req.url().endsWith("/api/admin/ai/chat") && req.method() === "POST")
      requests++;
  };
  page.on("request", count);
  try {
    const words = `Tidy this note. ${"The committee met to plan the season. ".repeat(120)}`;
    ok(
      words.length > CONFIRM_FROM_CHARS,
      `the Ask is ${words.length} characters`,
    );
    const open = async (text: string) => {
      await d.select();
      await page.click(d.ask);
      await page.waitForSelector(d.dialog);
      await page.fill(`${d.dialog} input`, text);
      await page.keyboard.press("Enter");
    };
    await open(words);
    await page.waitForSelector(CONFIRM);
    await page.waitForTimeout(800);
    ok(
      !(await page.$(d.dialog)) && requests === 0,
      "the box closed and the question is in the panel; nothing was sent",
    );
    ok(
      (await page.$eval(INPUT, (el) => el.hasAttribute("readonly"))) &&
        (await page.$eval('button[aria-label="Attach photos"]', (el) =>
          el.hasAttribute("disabled"),
        )) &&
        (await page
          .locator(`button:text-is("${d.preset}")`)
          .getAttribute("aria-disabled")) === "true",
      "while it asks: the composer is read-only, Attach and the presets are off",
    );
    // aria-disabled: Playwright would wait for it, a person can still press it.
    await page.click(`button:text-is("${d.preset}")`, { force: true });
    await page.waitForTimeout(800);
    ok(requests === 0, `pressing ${d.preset} sends nothing`);

    await open("Make this bold");
    const note = await page
      .locator(`${d.dialog} [role="alert"]`)
      .textContent({ timeout: 5_000 })
      .catch(() => null);
    ok(
      note?.includes(WAITING) &&
        (await page.inputValue(`${d.dialog} input`)) === "Make this bold" &&
        requests === 0,
      `another Ask is refused, its words kept: "${note}"`,
    );
    // (Escape here would cancel the question: the refusal handed it the focus.)
    await page.click(`${CONFIRM} button:text-is("Cancel")`);
    await page.waitForTimeout(500);
    const kept = await page.inputValue(INPUT);
    ok(
      !(await page.$(CONFIRM)) &&
        kept.startsWith("About the selected") &&
        kept.endsWith(words.trim()) &&
        !(await page.$eval(INPUT, (el) => el.hasAttribute("readonly"))) &&
        requests === 0,
      "Cancel: nothing sent, and the Ask's words are in the composer to edit",
    );
    await page.fill(INPUT, "");
  } finally {
    page.off("request", count);
  }
}
