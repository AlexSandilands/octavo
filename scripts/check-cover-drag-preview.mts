import assert from "node:assert/strict";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import {
  DEFAULT_COVER_PLACEMENT,
  makeCoverElement,
} from "../src/lib/cover-elements";
import { coverItems } from "../src/lib/cover-order";
const base = process.argv[2] ?? "http://localhost:3024";
await withCoverFixture(
  base,
  async ({ page, edit, sql, id, stored, waitSaved, errors }) => {
    const initial = await stored(),
      cover = initial.pages[0]!;
    const photo = cover.blocks.find((b) => b.type === "image")!;
    assert(photo.type === "image");
    photo.align = "full";
    photo.width = 40;
    photo.coverPlacement = {
      ...DEFAULT_COVER_PLACEMENT,
      order: 0,
      style: "ink-panel",
    };
    const heading = cover.blocks.find((b) => b.type === "heading")!;
    assert(heading.type === "heading");
    heading.coverPlacement = { ...DEFAULT_COVER_PLACEMENT, order: 1 };
    cover.blocks = [photo, heading];
    const detail = makeCoverElement("details");
    detail.id = "pinned";
    const story = makeCoverElement("teaser");
    story.id = "story";
    assert(story.type === "teaser");
    story.title = "A story at the side";
    cover.coverElements = [detail, story];
    await sql`update issues set content=${sql.json(initial)} where id=${id}`;
    await page.goto(edit);
    const canvas = page.locator("[data-page-frame]");
    await canvas.waitFor();
    await canvas
      .locator("img")
      .evaluateAll((es) =>
        Promise.all(es.map((e) => (e as HTMLImageElement).decode())),
      );
    const frame = (id: string) => canvas.locator(`[data-cover-entry="${id}"]`);
    const head = canvas.locator('[data-block-id="masthead"]');
    const drag = async (targetId: string) => {
      await head.click();
      const start = await head
          .getByRole("button", { name: "Drag to reorder", exact: true })
          .boundingBox(),
        target = await frame(targetId).boundingBox();
      assert(start && target);
      await page.mouse.move(
        start.x + start.width / 2,
        start.y + start.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        target.x + target.width / 2,
        target.y + target.height / 2,
        { steps: 15 },
      );
    };
    const oldPhoto = await frame("photo").boundingBox(),
      pinned = await frame("pinned").boundingBox();
    assert(oldPhoto && pinned);
    await drag("photo");
    await page.waitForFunction(
      (y) =>
        document
          .querySelector('[data-cover-entry="photo"]')!
          .getBoundingClientRect().top >
        y + 20,
      oldPhoto.y,
    );
    assert.deepEqual(
      await frame("pinned").boundingBox(),
      pinned,
      "unrelated pinned areas stay put",
    );
    assert.equal(
      (await stored()).pages[0]!.blocks[0]!.id,
      "photo",
      "drag preview does not save an edit",
    );
    await page.screenshot({ path: "/tmp/octavo-cover-drag-preview.png" });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.waitForFunction(
      (y) =>
        Math.abs(
          document
            .querySelector('[data-cover-entry="photo"]')!
            .getBoundingClientRect().top - y,
        ) < 1,
      oldPhoto.y,
    );
    await drag("photo");
    await page.waitForFunction(
      (y) =>
        document
          .querySelector('[data-cover-entry="photo"]')!
          .getBoundingClientRect().top >
        y + 20,
      oldPhoto.y,
    );
    // Wait for the same 200ms sorting transition the normal editor uses.
    await frame("photo").evaluate(async (el) => {
      await Promise.all(
        el.getAnimations().map((a) => a.finished.catch(() => {})),
      );
    });
    const preview = await frame("photo").boundingBox();
    assert(preview);
    await page.mouse.up();
    await waitSaved(
      (c) =>
        coverItems(c.pages[0]!).findIndex((i) => i.id === "masthead") <
        coverItems(c.pages[0]!).findIndex((i) => i.id === "photo"),
    );
    assert(
      Math.abs((await frame("photo").boundingBox())!.y - preview.y) < 2,
      "drop agrees with the image displacement preview",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.waitForFunction(
      (y) =>
        Math.abs(
          document
            .querySelector('[data-cover-entry="photo"]')!
            .getBoundingClientRect().top - y,
        ) < 1,
      oldPhoto.y,
    );
    const oldStory = await frame("story").boundingBox();
    assert(oldStory);
    await drag("story");
    await page.waitForFunction(
      (y) =>
        Math.abs(
          document
            .querySelector('[data-cover-entry="story"]')!
            .getBoundingClientRect().top - y,
        ) > 10,
      oldStory.y,
    );
    assert.deepEqual(await frame("pinned").boundingBox(), pinned);
    await page.mouse.up();
    await waitSaved((c) =>
      c.pages[0]!.blocks.some(
        (b) =>
          b.id === "masthead" &&
          "coverPlacement" in b &&
          b.coverPlacement?.column === "right",
      ),
    );
    await page.reload();
    await canvas.waitFor();
    assert.equal(
      await frame("masthead").evaluate((el) =>
        el.parentElement!.getAttribute("data-column"),
      ),
      "right",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: image/panel slides aside while dragging, cancellation restores layout, drop matches preview, pinned groups stay put, cross-anchor preview, save/reload",
    );
  },
);
