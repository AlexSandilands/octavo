// dev-discussion-gate.mts, the address (issue #301): it mirrors the shell —
// `?discussion=1` while open (with `&comment=` when a link opened it so),
// neither once closed, by any way out — and any other query survives. Opening
// and closing are history entries only: no navigation, no server round trip,
// the reader never remounts, the page doesn't move and the draft survives.
import type { Page } from "playwright";
import { OPEN_BUTTON, type Kit } from "./discussion-gate-kit.mts";
import type { Cast } from "./discussion-gate-desktop.mts";

const search = (page: Page) => page.evaluate(() => window.location.search);

async function closed(page: Page) {
  await page.waitForSelector("[role=dialog]", { state: "detached" });
}

async function opened(k: Kit, page: Page) {
  await k.waitThread(page);
  await page.waitForTimeout(350); // the entrance
}

// Where the reading surface is: the spread's box, or the column's scroll.
const place = (page: Page, desktop: boolean) =>
  page.evaluate((d) => {
    if (!d) return String(Math.round(window.scrollY));
    const r = document
      .querySelector("[data-reader-block]")!
      .getBoundingClientRect();
    return `${r.x},${r.y},${r.width},${r.height}`;
  }, desktop);

export async function addressGate(k: Kit, c: Cast, linked: string) {
  const n = c.issue.number!;
  for (const width of [1280, 390]) {
    const desktop = width >= 768;
    k.heading(`the address — ${width}px`);
    const r = await k.reader(c.carol, n, { width, query: "?ref=keep" });
    const { page } = r;
    let serverTrips = 0;
    page.on("request", (req) => {
      if (req.headers()["rsc"] || req.url().includes("_rsc=")) serverTrips++;
    });
    if (!desktop) {
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(200);
    }
    const before = await place(page, desktop);
    // A node of the reader, to tell a remount from an update.
    await page.evaluate((d) => {
      (window as { __block?: Element | null }).__block = document.querySelector(
        d ? "[data-reader-block]" : "article",
      );
    }, desktop);

    await page.click(OPEN_BUTTON);
    await opened(k, page);
    k.ok(
      (await search(page)) === "?ref=keep&discussion=1",
      `opening adds ?discussion=1, keeping the rest (${await search(page)})`,
    );
    await page.fill("#discussion-composer", "check-301 a draft to keep");
    await page.click('button[aria-label="Close discussion"]');
    await closed(page);
    k.ok((await search(page)) === "?ref=keep", "the close button clears it");
    k.ok((await place(page, desktop)) === before, "the page did not move");

    await page.click(OPEN_BUTTON);
    await opened(k, page);
    k.ok(
      (await page.inputValue("#discussion-composer")) ===
        "check-301 a draft to keep",
      "the draft survives closing and opening again",
    );
    await page.keyboard.press("Escape");
    await closed(page);
    k.ok((await search(page)) === "?ref=keep", "Escape clears it");

    await page.click(OPEN_BUTTON);
    await opened(k, page);
    await page.goBack();
    await closed(page);
    k.ok(
      (await search(page)) === "?ref=keep" &&
        new URL(page.url()).pathname === `/read/${n}`,
      "Back clears it and stays on the issue",
    );
    k.ok(
      (await place(page, desktop)) === before,
      "the page still hasn't moved",
    );
    k.ok(
      await page.evaluate(
        () =>
          (window as { __block?: Element | null }).__block?.isConnected ===
          true,
      ),
      "the reader never remounted",
    );
    k.ok(
      serverTrips === 0,
      `no navigation reached the server (${serverTrips})`,
    );

    await page.click(OPEN_BUTTON);
    await opened(k, page);
    await page.reload();
    await opened(k, page);
    k.ok(
      (await k.shell(page).isVisible()) &&
        (await search(page)) === "?ref=keep&discussion=1",
      "a reload while open reopens it",
    );
    await page.click('button[aria-label="Close discussion"]');
    await closed(page);
    k.ok((await search(page)) === "?ref=keep", "and closing clears it again");
    await page.reload();
    await page.waitForSelector(OPEN_BUTTON);
    await page.waitForTimeout(800);
    k.ok(
      !(await page.isVisible("[role=dialog]")),
      "a reload after closing is the plain reader",
    );
    await r.ctx.close();

    const deep = await k.reader(c.carol, n, {
      width,
      query: `?ref=keep&discussion=1&comment=${linked}`,
    });
    await opened(k, deep.page);
    k.ok(
      (await search(deep.page)) === `?ref=keep&discussion=1&comment=${linked}`,
      "a deep link keeps its address while open",
    );
    await deep.page.keyboard.press("Escape");
    await closed(deep.page);
    k.ok(
      (await search(deep.page)) === "?ref=keep",
      "and closes to a clean one, &comment= included",
    );
    await deep.page.goBack();
    await deep.page.waitForTimeout(500);
    k.ok(
      !(await deep.page.isVisible("[role=dialog]")),
      "Back from there leaves the discussion shut",
    );
    await deep.ctx.close();
  }
}
