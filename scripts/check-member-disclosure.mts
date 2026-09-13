import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";

export async function expandMember(row: Locator) {
  // Streamed rows may be attached before their Suspense boundary is revealed.
  await row.waitFor({ state: "visible" });
  const toggle = row.getByRole("button", { name: /^Show details for / });
  if (await toggle.isVisible()) await toggle.click();
  await row.locator("[data-member-details]").waitFor({ state: "visible" });
}

export async function checkMemberDisclosure(
  page: Page,
  row: Locator,
  output: string,
) {
  const second = page.locator(".members-row").nth(1);
  const emptyNotes = page.locator(".members-row").nth(2);
  const toggle = row.getByRole("button", { name: /^(Show|Hide) details for / });
  const details = row.locator("[data-member-details]");
  const selected = row.getByRole("checkbox");
  const subscription = row.locator('[data-member-cell="subscription"] button');
  const wasSelected = await selected.isChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await details.isVisible(), false);
  assert(
    await subscription.isVisible(),
    "Subscription is immediately available",
  );
  assert(
    !/Make admin|Joined|Read full notes/.test(await row.ariaSnapshot()),
    "Collapsed details are absent from the accessibility tree",
  );

  await selected.focus();
  await page.keyboard.press("Space");
  assert.equal(await selected.isChecked(), !wasSelected);
  assert.equal(
    await toggle.getAttribute("aria-expanded"),
    "false",
    "Selecting does not expand details",
  );
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  assert(await subscription.evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Tab");
  assert(await toggle.evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Tab");
  assert(
    await second
      .getByRole("checkbox")
      .evaluate((el) => el === document.activeElement),
    "Tab skips collapsed actions",
  );

  await toggle.focus();
  await page.keyboard.press("Space");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  assert.equal(
    await toggle.getAttribute("aria-controls"),
    await details.getAttribute("id"),
  );
  assert(await details.isVisible());
  assert(
    await toggle.evaluate((el) => el === document.activeElement),
    "Expanding keeps focus on the chevron",
  );
  for (const cell of ["notes", "role", "joined", "actions"]) {
    assert(await row.locator(`[data-member-cell="${cell}"]`).isVisible());
  }
  assert(
    await row
      .locator('[data-member-cell="actions"]')
      .getByText("Edit", { exact: true })
      .isVisible(),
  );
  assert(
    await row
      .locator('[data-member-cell="actions"]')
      .getByText("Remove", { exact: true })
      .isVisible(),
  );

  await expandMember(second);
  assert(await details.isVisible(), "Several rows can stay expanded");
  await expandMember(emptyNotes);
  assert.equal(
    await emptyNotes.locator('[data-member-cell="notes"]').isVisible(),
    false,
    "Empty notes do not take mobile space",
  );
  for (const width of [320, 640, 768, 1024, 1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await selected.isChecked(), wasSelected);
    assert.equal(await row.getAttribute("data-expanded"), "true");
    assert.equal(await second.getAttribute("data-expanded"), "true");
    if (width === 1440) {
      assert.equal(await toggle.isVisible(), false);
      assert(
        await emptyNotes.locator('[data-member-cell="notes"]').isVisible(),
        "Wide rows retain the Notes column",
      );
    } else {
      assert(await details.isVisible());
      await page.screenshot({
        path: `${output}/expanded-members-${width}.png`,
      });
    }
  }
  await toggle.click();
  await second.getByRole("button", { name: /^Hide details for / }).click();
  await emptyNotes.getByRole("button", { name: /^Hide details for / }).click();
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    const height = (await second.boundingBox())!.height;
    const contentWidth = (await page
      .locator("[data-members-list]")
      .boundingBox())!.width;
    assert(
      height <= (contentWidth < 512 ? 132 : 88),
      `Collapsed row stays compact at ${width}px (${height}px)`,
    );
    assert.equal(await details.isVisible(), false);
    await page.locator("main").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: `${output}/collapsed-members-${width}.png` });
  }

  // Test subscription without a status filter removing the member mid-check.
  const direct = await page.context().newPage();
  try {
    const url = new URL(page.url());
    url.searchParams.delete("filter");
    await direct.setViewportSize({ width: 390, height: 844 });
    await direct.goto(url.toString());
    const target = direct.locator(".members-row").first();
    await target.getByRole("button", { name: /^Subscribe / }).click();
    await target.getByRole("button", { name: /^Unsubscribe / }).waitFor();
    assert.equal(await target.getAttribute("data-expanded"), "false");
    await target.getByRole("button", { name: /^Unsubscribe / }).click();
    await target.getByRole("button", { name: /^Subscribe / }).waitFor();
    assert.equal(await target.getAttribute("data-expanded"), "false");
  } finally {
    await direct.close();
  }
  await expandMember(row);
  console.log(
    "ok — compact disclosures: keyboard, hidden controls, independent expansion, resize, compact heights and direct subscription",
  );
}
