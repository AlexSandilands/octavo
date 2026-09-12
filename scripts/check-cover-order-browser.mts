import assert from "node:assert/strict";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import { coverItems, placementOf } from "../src/lib/cover-order";
const base = process.argv[2] ?? "http://localhost:3024";
await withCoverFixture(
  base,
  async ({ page, edit, waitSaved, stored, errors }) => {
    await page.goto(edit);
    const canvas = page.locator("[data-page-frame]");
    await canvas.waitFor();
    const toolbar = page.getByRole("group", {
      name: "Editor tools",
      exact: true,
    });
    const panel = page.getByRole("complementary", {
      name: "Cover element settings",
    });
    await toolbar.getByRole("button", { name: "Text", exact: true }).click();
    const text = canvas.locator("[data-block-id]").filter({
      has: page.getByRole("textbox", {
        name: "Add a tagline or date…",
        exact: true,
      }),
    });
    await text
      .getByRole("textbox", { name: "Add a tagline or date…", exact: true })
      .fill("Our monthly stories");
    const textId = await text.getAttribute("data-block-id");
    assert(textId);
    await canvas.locator('[data-block-id="masthead"]').click();
    assert.equal(await panel.getByText("Content", { exact: true }).count(), 0);
    assert.equal(
      await panel.getByRole("button", { name: /Remove/ }).count(),
      0,
    );
    await canvas
      .locator('[data-block-id="masthead"]')
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await toolbar.getByRole("button", { name: "Heading", exact: true }).click();
    // Heading placeholders vary by theme; resolve the newly selected heading by its stored type.
    await waitSaved((c) =>
      c.pages[0]!.blocks.some(
        (b) => b.type === "heading" && b.id !== "masthead",
      ),
    );
    const saved = await stored(),
      headingId = saved.pages[0]!.blocks.find((b) => b.type === "heading")!.id;
    const head = canvas.locator(`[data-block-id="${headingId}"]`);
    const ids = async () =>
      canvas
        .locator(
          '.cover-placement-group[data-row="center"][data-column="center"] [data-cover-entry]',
        )
        .evaluateAll((es) => es.map((e) => e.getAttribute("data-cover-entry")));
    assert.deepEqual(await ids(), [textId, headingId]);
    const drag = head.getByRole("button", {
      name: "Drag to reorder",
      exact: true,
    });
    const from = await drag.boundingBox(),
      target = await text.boundingBox();
    assert(from && target);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 15 },
    );
    await page.mouse.up();
    await waitSaved(
      (c) =>
        coverItems(c.pages[0]!)
          .map((i) => i.id)
          .indexOf(headingId) <
        coverItems(c.pages[0]!)
          .map((i) => i.id)
          .indexOf(textId),
    );
    assert.deepEqual(await ids(), [headingId, textId]);
    await toolbar.getByRole("button", { name: "Undo", exact: true }).click();
    assert.deepEqual(await ids(), [textId, headingId]);
    await toolbar.getByRole("button", { name: "Redo", exact: true }).click();
    assert.deepEqual(await ids(), [headingId, textId]);
    await head
      .getByRole("button", { name: "Drag to reorder", exact: true })
      .focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() =>
      document.querySelector(
        '[aria-roledescription="sortable"][aria-pressed="true"]',
      ),
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.keyboard.press("ArrowDown");
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.keyboard.press("Space");
    await waitSaved(
      (c) =>
        coverItems(c.pages[0]!)
          .map((i) => i.id)
          .indexOf(textId) <
        coverItems(c.pages[0]!)
          .map((i) => i.id)
          .indexOf(headingId),
    );
    await toolbar
      .getByRole("button", { name: "Add detail", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: "Story preview", exact: true })
      .click();
    await panel
      .getByRole("textbox", { name: "Headline", exact: true })
      .fill("A featured story");
    const story = canvas.locator("[data-cover-element]");
    const storyId = await story.getAttribute("data-cover-element");
    assert(storyId);
    const source = await story
        .getByRole("button", { name: "Drag to reorder", exact: true })
        .boundingBox(),
      dest = await head.boundingBox();
    assert(source && dest);
    await page.mouse.move(
      source.x + source.width / 2,
      source.y + source.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(dest.x + dest.width / 2, dest.y + dest.height / 2, {
      steps: 15,
    });
    await page.mouse.up();
    await waitSaved((c) => {
      const p = c.pages[0]!,
        i = coverItems(p).find((i) => i.id === storyId);
      return Boolean(i && placementOf(i, p).column === "center");
    });
    await page.screenshot({ path: "/tmp/octavo-cover-reordered.png" });
    const before = await ids();
    await page.reload();
    await canvas.waitFor();
    assert.deepEqual(await ids(), before);
    assert.equal(
      await panel.getByText("Heading and text flow", { exact: true }).count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: deleting/recreating heading, pointer and keyboard reorder, undo/redo, shared text/detail anchors, reload and on-page deletion",
    );
  },
);
