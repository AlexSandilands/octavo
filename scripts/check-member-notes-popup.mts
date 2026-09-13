import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { expandMember } from "./check-member-disclosure.mts";

async function withinViewport(page: Page, popup: Locator) {
  const box = await popup.boundingBox();
  const viewport = page.viewportSize()!;
  assert(box && box.x >= 0 && box.y >= 0);
  assert(box.x + box.width <= viewport.width + 1);
  assert(box.y + box.height <= viewport.height + 1);
}

export async function checkMemberNotesPopup(
  page: Page,
  row: Locator,
  output: string,
) {
  const trigger = row.getByRole("button", { name: /Read full notes for/ });
  const popup = page.locator("[data-member-notes-popup]");
  await page.setViewportSize({ width: 1440, height: 900 });
  await trigger.scrollIntoViewIfNeeded();
  const height = (await row.boundingBox())!.height;
  assert(
    (await trigger.innerText()).startsWith("Club secretary in Wellington."),
    "The notes text itself opens the popup",
  );
  assert.equal(
    await trigger.locator("svg").count(),
    0,
    "No separate notes icon",
  );
  assert(
    (await trigger.locator("span").boundingBox())!.height <= 40.5,
    "Notes preview stays within two lines",
  );

  await trigger.hover();
  await popup.waitFor();
  assert.equal(
    (await row.boundingBox())!.height,
    height,
    "Hover never expands the row",
  );
  await popup.hover();
  await page.waitForTimeout(220);
  assert(await popup.isVisible(), "Hover stays open while reading the popup");
  assert(
    (await popup.innerText()).includes("unbroken".repeat(24)),
    "Full note is present",
  );
  await withinViewport(page, popup);
  await page.mouse.move(0, 0);
  await popup.waitFor({ state: "hidden" });

  await trigger.click();
  await popup.waitFor();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(220);
  assert(await popup.isVisible(), "Click pins the popup after pointer leaves");
  await trigger.click();
  await popup.waitFor({ state: "hidden" });
  assert.equal(
    (await row.boundingBox())!.height,
    height,
    "Click never expands the row",
  );

  await trigger.focus();
  await page.keyboard.press("Enter");
  await popup.waitFor();
  await page.waitForFunction(() =>
    document.activeElement?.hasAttribute("data-member-notes-popup"),
  );
  assert(
    await popup.evaluate((el) => el === document.activeElement),
    "Keyboard reaches the scrollable note",
  );
  await page.keyboard.press("End");
  await page.waitForFunction(
    () => document.querySelector("[data-member-notes-popup]")!.scrollTop > 0,
  );
  await page.keyboard.press("Escape");
  await popup.waitFor({ state: "hidden" });
  assert(
    await trigger.evaluate((el) => el === document.activeElement),
    "Escape restores focus",
  );
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document.activeElement?.hasAttribute("data-member-notes-popup"),
  );
  await page.keyboard.press("Shift+Tab");
  await popup.waitFor({ state: "hidden" });
  assert(
    await trigger.evaluate((el) => el === document.activeElement),
    "Shift+Tab returns to the notes preview",
  );
  await page.keyboard.press("Enter");
  await popup.waitFor();
  await page.keyboard.press("Tab");
  await popup.waitFor({ state: "hidden" });
  assert(
    await row
      .locator('[data-member-cell="role"] button')
      .evaluate((el) => el === document.activeElement),
    "Tab continues to the next row control",
  );

  for (const width of [320, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 600 });
    await expandMember(row);
    await trigger.scrollIntoViewIfNeeded();
    const before = (await row.boundingBox())!.height;
    await trigger.click();
    await popup.waitFor();
    await withinViewport(page, popup);
    assert.equal((await row.boundingBox())!.height, before);
    await page.screenshot({ path: `${output}/notes-popup-${width}.png` });
    await page.getByRole("heading", { name: "Members", exact: true }).click();
    await popup.waitFor({ state: "hidden" });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await trigger.click();
  await popup.waitFor();
  await page.locator("[data-members-list]").evaluate((el) => {
    el.closest(".scrollbar-soft")!.scrollTop += 100;
  });
  await popup.waitFor({ state: "hidden" });
  await trigger.click();
  await popup.waitFor();
  await page.setViewportSize({ width: 1024, height: 900 });
  await popup.waitFor({ state: "hidden" });

  const touch = await page
    .context()
    .browser()!
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  try {
    await touch.addCookies(await page.context().cookies());
    const phone = await touch.newPage();
    await phone.goto(page.url());
    await phone
      .locator(".members-row")
      .first()
      .getByRole("button", { name: /^Show details for / })
      .tap();
    const preview = phone
      .getByRole("button", { name: /Read full notes for/ })
      .first();
    const phonePopup = phone.locator("[data-member-notes-popup]");
    await preview.tap();
    await phonePopup.waitFor();
    await withinViewport(phone, phonePopup);
    await preview.tap();
    await phonePopup.waitFor({ state: "hidden" });
  } finally {
    await touch.close();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  console.log(
    "ok — notes popup: hover, click, touch, keyboard scrolling, dismissal, viewport bounds and fixed row height",
  );
}
