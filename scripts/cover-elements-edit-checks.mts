import assert from "node:assert/strict";
import type { CoverFixture } from "./cover-elements-fixture.mts";

export async function checkCoverEdits(f: CoverFixture, storyId: string) {
  const { page, waitSaved } = f;
  await page.setViewportSize({ width: 1440, height: 1000 });
  const canvas = page.locator("[data-page-frame]");
  const panel = page.getByRole("complementary", {
    name: "Cover element settings",
  });
  const clickCanvas = async (name: string) =>
    canvas.getByRole("button", { name, exact: true }).click();
  // Its name follows the heading it links to, which these checks rename; the id doesn't.
  const clickStory = async () =>
    canvas
      .locator(`[data-cover-element="${storyId}"]`)
      .getByRole("button", { name: /^Edit Stories/ })
      .click();
  const close = async () => page.getByRole("button", { name: "Done" }).click();
  const logoSize = (c: Awaited<ReturnType<CoverFixture["stored"]>>) => {
    const logo = c.pages[0]?.coverElements?.find((e) => e.type === "logo");
    return logo?.type === "logo" ? logo.size : 0;
  };
  console.log("Checking logo edit");
  await clickCanvas("Edit Logo");
  await panel.getByRole("slider", { name: "Logo size" }).fill("180");
  await close();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await waitSaved((c) => logoSize(c) === 140);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await waitSaved((c) => logoSize(c) === 180);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await waitSaved((c) => logoSize(c) === 140);
  await clickCanvas("Edit Logo");
  await panel.getByRole("slider", { name: "Vertical adjustment" }).fill("60");
  await panel.getByText(/runs past the page margin/).waitFor();
  await panel.getByRole("slider", { name: "Vertical adjustment" }).fill("0");
  await panel
    .getByText(/runs past the page margin/)
    .waitFor({ state: "hidden" });
  await canvas
    .locator("[data-cover-element]")
    .filter({
      has: page.getByRole("button", { name: "Edit Logo", exact: true }),
    })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  assert.equal(await canvas.locator("[data-cover-element]").count(), 3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await canvas.locator("[data-cover-element]").count(), 4);
  await clickStory();
  await panel.getByRole("checkbox", { name: "Use cover appearance" }).uncheck();
  await panel
    .getByRole("button", { name: "Background: panel", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Panel colour: Charcoal", exact: true })
    .click();
  const panelled = canvas.locator(
    '[data-cover-entry][data-cover-panel="true"]',
  );
  assert.equal(await panelled.count(), 1);
  assert.equal(
    await canvas
      .locator('[data-block-id="masthead"] [data-cover-copy]')
      .last()
      .evaluate((el) => getComputedStyle(el).textShadow !== "none"),
    true,
    "story override leaves main heading treatment unchanged",
  );
  await panel.getByRole("checkbox", { name: "Use cover appearance" }).check();
  await close();
  // Rename a referenced heading through its actual editor, then move its page.
  await page.getByRole("button", { name: "3", exact: true }).click();
  const title = canvas
    .locator('[data-block-id="community"] [contenteditable="true"]')
    .last();
  await title.fill("People of the club");
  await page.getByRole("button", { name: "1", exact: true }).click();
  await waitSaved(
    (c) =>
      c.pages[2]?.blocks.some(
        (b) => b.type === "heading" && b.title === "People of the club",
      ) === true,
  );
  assert((await canvas.innerText()).includes("People of the club"));
  await page.getByRole("button", { name: "3", exact: true }).click();
  await canvas.locator('[data-block-id="community"]').click();
  await canvas
    .locator('[data-block-id="community"]')
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await clickStory();
  await panel.getByText(/links to a section that no longer exists/).waitFor();
  await close();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  assert((await canvas.innerText()).includes("People of the club"));
  // Restore the original headline with an editor operation for the reader checks.
  await page.getByRole("button", { name: "3", exact: true }).click();
  await canvas
    .locator('[data-block-id="community"] [contenteditable="true"]')
    .last()
    .fill("Meet the members");
  await page.getByRole("button", { name: "1", exact: true }).click();
  await waitSaved(
    (c) =>
      c.pages[2]?.blocks.some(
        (b) => b.type === "heading" && b.title === "Meet the members",
      ) === true && logoSize(c) === 140,
  );
  console.log(
    "PASS: undo/redo, removal recovery, independent contrast, overflow warning, linked heading rename and removed-section warning",
  );
}
