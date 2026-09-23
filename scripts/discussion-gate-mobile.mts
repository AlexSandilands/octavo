// dev-discussion-gate.mts, phone half (issue #301): the floating button and
// the bottom sheet at 390×844 and 360×740 — every way out (close, Escape,
// Back, swipe), the locked column, posting with the keyboard up.
import type { Page } from "playwright";
import type { Kit } from "./discussion-gate-kit.mts";
import type { Cast } from "./discussion-gate-desktop.mts";
import { heard, post } from "./discussion-gate-desktop.mts";

const fab = 'button[aria-label^="Discussion"]';

async function openSheet(k: Kit, page: Page) {
  await page.click(fab);
  await k.waitThread(page);
  await page.waitForTimeout(350); // the sheet's entrance
}

async function closed(page: Page) {
  try {
    await page.waitForSelector("[role=dialog]", {
      state: "detached",
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function mobileGate(k: Kit, c: Cast) {
  for (const [width, height] of [
    [390, 844],
    [360, 740],
  ] as const) {
    k.heading(`phone ${width}×${height} — the button and the sheet`);
    const { page, ctx, listCalls } = await k.reader(c.alice, c.issue.number!, {
      width,
      height,
    });
    const button = page.locator(fab);
    const b = await button.boundingBox();
    k.ok(
      b && Math.round(b.width) === 56 && Math.round(b.height) === 56,
      `the button is 56px (${b?.width}×${b?.height})`,
    );
    k.ok(
      b &&
        b.x + b.width <= width - 8 &&
        b.y + b.height <= height - 8 &&
        b.x > width / 2,
      "it sits bottom-right, clear of the edges",
    );
    k.ok(
      /^Discussion, \d+ comments?$/.test(
        (await button.getAttribute("aria-label")) ?? "",
      ),
      `it is named with the count (“${await button.getAttribute("aria-label")}”)`,
    );
    await page.waitForTimeout(500);
    k.ok(listCalls() === 0, "nothing is fetched before the sheet opens");

    await openSheet(k, page);
    const sheet = await k.shell(page).boundingBox();
    k.ok(
      sheet &&
        Math.abs(sheet.height - height * 0.85) < 4 &&
        Math.abs(sheet.y + sheet.height - height) < 2,
      `the sheet rises from the bottom, ~85% tall (${sheet?.height} of ${height})`,
    );
    k.ok(
      (await page.locator("[role=dialog] h2").textContent()) ===
        `Discussion · Issue ${c.issue.number}`,
      "headed “Discussion · Issue N”",
    );
    const close = await page
      .locator('button[aria-label="Close discussion"]')
      .boundingBox();
    k.ok(
      close && close.width >= 44 && close.height >= 44,
      `the close button is 44px (${close?.width}×${close?.height})`,
    );
    k.ok(
      (await page.evaluate(
        () => getComputedStyle(document.documentElement).overflow,
      )) === "hidden",
      "the column behind is locked",
    );
    k.ok(
      (await k.activeLabel(page)) === "Close discussion",
      "focus moves into the sheet",
    );
    await k.shot(page, `phone-${width}-sheet`);

    await page.click('button[aria-label="Close discussion"]');
    k.ok(await closed(page), "the close button closes it");
    k.ok(
      (await k.activeLabel(page)).startsWith("Discussion"),
      "focus returns to the button",
    );
    k.ok(
      (await page.evaluate(
        () => getComputedStyle(document.documentElement).overflow,
      )) !== "hidden",
      "the column scrolls again",
    );

    await openSheet(k, page);
    await page.keyboard.press("Escape");
    k.ok(await closed(page), "Escape closes it");

    const url = page.url();
    await openSheet(k, page);
    await page.goBack();
    k.ok(await closed(page), "Back closes it");
    k.ok(page.url() === url, "and stays on the issue");

    await openSheet(k, page);
    const grip = await page
      .locator("[role=dialog] > div[aria-hidden]")
      .first()
      .boundingBox();
    await page.mouse.move(
      grip!.x + grip!.width / 2,
      grip!.y + grip!.height / 2,
    );
    await page.mouse.down();
    // Slowly: a fast short drag is a flick, which dismisses.
    for (let dy = 10; dy <= 60; dy += 10) {
      await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + dy);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(400);
    k.ok(
      await k.shell(page).isVisible(),
      "a short drag on the handle springs back",
    );
    await page.mouse.move(
      grip!.x + grip!.width / 2,
      grip!.y + grip!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + 260, {
      steps: 8,
    });
    await page.mouse.up();
    k.ok(await closed(page), "a swipe down on the handle dismisses it");
    k.ok(page.url() === url, "swiping away left the issue open too");

    k.heading(`phone ${width}×${height} — posting with the keyboard up`);
    await openSheet(k, page);
    await page.focus("#discussion-composer");
    // Headless has no on-screen keyboard; shrinking the viewport is what one
    // does to the visual viewport.
    const keyboardTop = Math.round(height * 0.52);
    await page.setViewportSize({ width, height: keyboardTop });
    await page.waitForTimeout(300);
    const shrunk = await k.shell(page).boundingBox();
    const box = await page.locator("#discussion-composer").boundingBox();
    const postBtn = await page
      .locator("form:has(#discussion-composer) button[type=submit]")
      .boundingBox();
    k.ok(
      shrunk && shrunk.y + shrunk.height <= keyboardTop + 1,
      `the sheet shrinks above the keyboard (bottom ${shrunk && shrunk.y + shrunk.height} ≤ ${keyboardTop})`,
    );
    k.ok(
      box &&
        postBtn &&
        box.y >= 0 &&
        postBtn.y + postBtn.height <= keyboardTop + 1,
      "the box and Post stay in view",
    );
    await k.shot(page, `phone-${width}-keyboard`);
    const before = await post(page, `check-301 from a phone at ${width}`);
    k.ok(
      await heard(page, "Your comment is posted.", before),
      "posting works with it up",
    );
    await page.setViewportSize({ width, height });
    await page.keyboard.press("Escape");
    await closed(page);
    await ctx.close();
  }
}
