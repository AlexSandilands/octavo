// dev-assistant-panel-gate.mts's Stop cases (#309): the log is busy while a
// reply streams, Stop leaves focus in the composer, and after a Stop the next
// message shows "Thinking…" until its reply starts to show (the owner's
// browser pass found it missing), and the conversation carries on.
import type { Page } from "playwright";

const LOG = '[role="log"]';
const INPUT = "#assistant-input";
const STOP = 'button[aria-label="Stop the reply"]';

/** Replies in the log so far: each starts "Looking at …". */
const replies = (page: Page) =>
  page.$eval(
    LOG,
    (el) => (el as HTMLElement).innerText.split("Looking at").length - 1,
  );

/** Every 50ms until reply `n` shows: "thinking", "reply", or "blank" (neither). */
function watchIndicator(page: Page, n: number) {
  return page.evaluate(
    ([sel, n]) =>
      new Promise<string[]>((resolve) => {
        const seen: string[] = [];
        const timer = setInterval(() => {
          const text =
            (document.querySelector(sel as string) as HTMLElement | null)
              ?.innerText ?? "";
          const state =
            text.split("Looking at").length - 1 >= (n as number)
              ? "reply"
              : text.includes("Thinking…")
                ? "thinking"
                : "blank";
          if (seen.at(-1) !== state) seen.push(state);
          if (state === "reply" || seen.length > 20) {
            clearInterval(timer);
            resolve(seen);
          }
        }, 50);
      }),
    [LOG, n] as const,
  );
}

export async function stopChecks(
  page: Page,
  ok: (cond: unknown, msg: string) => void,
) {
  const idle = () =>
    page.waitForFunction(
      (sel) =>
        document.querySelector(sel)?.getAttribute("aria-busy") === "false",
      LOG,
      { timeout: 30_000 },
    );
  const before = await replies(page);
  await page.fill(INPUT, "Take your time [fake:slow]");
  await page.keyboard.press("Enter");
  await page.waitForSelector(STOP);
  ok(
    (await page.getAttribute(LOG, "aria-busy")) === "true",
    "the log is busy while a reply streams",
  );
  // Stop mid-reply, once its first words are showing.
  await page.waitForFunction(
    ([sel, n]) =>
      (document.querySelector(sel as string) as HTMLElement).innerText.split(
        "Looking at",
      ).length -
        1 >
      (n as number),
    [LOG, before] as const,
    { timeout: 30_000 },
  );
  await page.click(STOP);
  await idle();
  ok(
    await page.evaluate(() => document.activeElement?.id === "assistant-input"),
    "Stop leaves focus in the composer",
  );
  await page.fill(INPUT, "Carry on. [fake:slow]");
  const watching = watchIndicator(page, (await replies(page)) + 1);
  await page.keyboard.press("Enter");
  const states = await watching;
  ok(
    states.join() === "blank,thinking,reply" ||
      states.join() === "thinking,reply",
    `after a Stop, the next message shows Thinking… until its reply starts (${states.join(" → ")})`,
  );
  await page.waitForFunction(
    (sel) =>
      (
        document
          .querySelector(sel)
          ?.textContent?.match(/Nothing needed changing\./g) ?? []
      ).length >= 2,
    LOG,
    { timeout: 30_000 },
  );
  ok(true, "the conversation carries on after a Stop");
  await idle();
}
