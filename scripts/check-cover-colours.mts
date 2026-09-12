import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { coverAppearanceSchema } from "../src/lib/cover-appearance";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import {
  DEFAULT_COVER_PLACEMENT,
  makeCoverElement,
} from "../src/lib/cover-elements";
import { coverRichDocSchema } from "../src/lib/cover-rich-text";
const base = process.argv[2] ?? "http://localhost:3024";
await withCoverFixture(
  base,
  async ({ page, edit, sql, id, stored, waitSaved, errors, number }) => {
    const content = await stored(),
      cover = content.pages[0]!;
    const heading = cover.blocks.find((b) => b.type === "heading")!;
    assert(heading.type === "heading");
    heading.title = "Spring Issue";
    heading.coverPlacement = {
      ...DEFAULT_COVER_PLACEMENT,
      row: "top",
      style: "paper-panel",
    };
    const story = makeCoverElement("story");
    assert(story.type === "stories");
    story.id = "story";
    story.items = [
      { id: "one", title: "Club stories", description: "Meet our community." },
    ];
    cover.coverElements = [story];
    await sql`update issues set content=${sql.json(content)} where id=${id}`;
    await page.goto(edit);
    const canvas = page.locator("[data-page-frame]"),
      panel = page.getByRole("complementary", {
        name: "Cover element settings",
      });
    const frame = canvas.locator('[data-cover-entry="masthead"]');
    const textbox = canvas.getByRole("textbox", {
      name: "Cover title",
      exact: true,
    });
    await textbox.waitFor().catch(async (error) => {
      await page.screenshot({ path: "/tmp/octavo-cover-colours-error.png" });
      console.log(errors);
      throw error;
    });
    await panel
      .getByRole("button", { name: "Panel colour: Forest", exact: true })
      .click();
    await waitSaved((c) =>
      c.pages[0]!.blocks.some(
        (b) =>
          "coverPlacement" in b &&
          b.coverPlacement?.appearance?.background === "green",
      ),
    );
    assert.equal(
      await frame.evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(29, 77, 62)",
    );
    // Selected-word formatting lives in the floating bar over the item, with
    // the colour and shadow swatches in trays under it.
    const bar = page.getByRole("group", { name: "Selected text formatting" });
    await textbox.click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("Control+Shift+ArrowRight");
    await bar.getByRole("button", { name: "Bold", exact: true }).click();
    await bar.getByRole("button", { name: "Underline", exact: true }).click();
    await bar.getByRole("button", { name: "Italic", exact: true }).click();
    await bar.getByRole("button", { name: "Text colour", exact: true }).click();
    await bar
      .getByRole("button", {
        name: "Selected text colour: Warm stone",
        exact: true,
      })
      .click();
    await bar.getByRole("button", { name: "Text shadow", exact: true }).click();
    await bar
      .getByRole("button", {
        name: "Selected text shadow: strong",
        exact: true,
      })
      .click();
    await bar
      .getByRole("button", {
        name: "Selected text shadow colour: Blue",
        exact: true,
      })
      .click();
    await waitSaved((c) => {
      const h = c.pages[0]!.blocks.find((b) => b.id === "masthead");
      return Boolean(
        h &&
        "coverPlacement" in h &&
        JSON.stringify(h.coverPlacement?.richText ?? {}).includes("strong"),
      );
    });
    const saved = (await stored()).pages[0]!.blocks.find(
      (b) => b.id === "masthead",
    )!;
    assert("coverPlacement" in saved);
    const doc = saved.coverPlacement!.richText!.title!;
    assert(coverRichDocSchema.safeParse(doc).success);
    const nodes = doc.content[0]!.content!;
    assert(
      nodes.some(
        (n) =>
          n.type === "text" &&
          n.text.includes("Spring") &&
          n.marks?.some((m) => m.type === "bold"),
      ),
    );
    assert(
      nodes.some(
        (n) =>
          n.type === "text" && n.text.includes("Issue") && !n.marks?.length,
      ),
    );
    await page.screenshot({ path: "/tmp/octavo-cover-colours-selection.png" });
    const formatted = await textbox.innerHTML();
    await page.keyboard.press("Control+z");
    assert.notEqual(
      await textbox.innerHTML(),
      formatted,
      "native text undo reverses formatting",
    );
    await page.keyboard.press("Control+Shift+z");
    assert.equal(
      await textbox.innerHTML(),
      formatted,
      "native text redo restores formatting",
    );
    await waitSaved((c) => {
      const h = c.pages[0]!.blocks.find((b) => b.id === "masthead");
      return Boolean(
        h &&
        "coverPlacement" in h &&
        JSON.stringify(h.coverPlacement?.richText?.title) ===
          JSON.stringify(doc),
      );
    });

    await page.reload();
    await textbox.waitFor();
    assert.equal(await textbox.locator("strong").innerText(), "Spring");
    assert.equal(
      await frame.evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(29, 77, 62)",
    );
    // Custom colours are saved, and panel removal preserves the text formatting.
    const custom = panel.getByLabel("Panel colour: custom colour", {
      exact: true,
    });
    await custom.fill("#163852");
    await waitSaved((c) =>
      c.pages[0]!.blocks.some(
        (b) =>
          "coverPlacement" in b &&
          b.coverPlacement?.appearance?.background === "#163852",
      ),
    );
    await panel
      .getByRole("button", { name: "Background: none", exact: true })
      .click();
    assert.equal(
      await frame.evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgba(0, 0, 0, 0)",
    );
    await panel
      .getByRole("button", { name: "Background: panel", exact: true })
      .click();
    const headline = canvas.getByRole("textbox", {
      name: "Story headline",
      exact: true,
    });
    await headline.click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("Control+Shift+ArrowRight");
    await bar.getByRole("button", { name: "Bold", exact: true }).click();
    await waitSaved(
      (c) =>
        !!c.pages[0]!.coverElements?.[0]?.placement.richText?.["one:title"],
    );
    await page.keyboard.press("End");
    await page.keyboard.type(" today");
    await waitSaved(
      (c) =>
        c.pages[0]!.coverElements?.[0]?.type === "stories" &&
        c.pages[0]!.coverElements[0].items[0]!.title.includes("today"),
    );
    await page.keyboard.press("Escape");
    await panel
      .getByRole("button", { name: "Background: panel", exact: true })
      .click();
    await panel
      .getByRole("button", { name: "Panel colour: Blue", exact: true })
      .click();
    await waitSaved(
      (c) => c.pages[0]!.coverOverlay?.appearance?.background === "blue",
    );
    await page.screenshot({ path: "/tmp/octavo-cover-colours-panel.png" });
    for (const width of [1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await panel
        .getByRole("button", { name: "Panel colour: Blue", exact: true })
        .waitFor();
      const picker = await panel
        .getByLabel("Panel colour: custom colour", { exact: true })
        .boundingBox();
      assert(picker && picker.x + picker.width <= width);
      await page.screenshot({ path: `/tmp/octavo-cover-colours-${width}.png` });
    }
    assert.equal(
      coverAppearanceSchema.safeParse({
        background: "url(https://example.invalid)",
      }).success,
      false,
    );
    const savedCover = await stored();
    await page.goto(`${base}/admin`);
    await sql`update issues set status='published', published_at=now() where id=${id}`;
    const checkFrame = async () => {
      const frame = page.locator("[data-page-frame]:visible").first();
      await frame.locator('[data-cover-entry="masthead"]').waitFor();
      const heading = frame.locator('[data-cover-entry="masthead"]');
      assert.equal(
        await heading.evaluate((e) => getComputedStyle(e).backgroundColor),
        "rgb(22, 56, 82)",
      );
      const painted = heading.locator("strong u span");
      assert.equal(await painted.innerText(), "Spring");
      assert.equal(
        await painted.evaluate((e) => getComputedStyle(e).fontStyle),
        "italic",
      );
      assert.notEqual(
        await painted.evaluate((e) => getComputedStyle(e).textShadow),
        "none",
      );
      return frame;
    };
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/read/${number}`);
    await checkFrame();
    const token = createHash("sha256")
      .update(`${process.env.AUTH_SECRET}:pdf-print`)
      .digest("hex");
    for (const theme of ["classic", "modern"]) {
      await page.goto(
        `${base}/read/${number}/print?token=${token}&theme=${theme}`,
        { waitUntil: "networkidle" },
      );
      const frame = await checkFrame();
      await frame.screenshot({
        path: `/tmp/octavo-cover-colours-print-${theme}.png`,
      });
      await page.pdf({
        path: `/tmp/octavo-cover-colours-${theme}.pdf`,
        printBackground: true,
        preferCSSPageSize: true,
      });
    }
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${base}/read/${number}`);
      const cover = page.locator("section.cover-composition").first();
      await cover.locator(".cover-grid-mobile").waitFor();
      assert.equal(
        await cover
          .locator('[data-cover-entry="masthead"] strong u span')
          .innerText(),
        "Spring",
      );
      for (let i = 0; i < 4; i++)
        await page
          .getByRole("button", { name: "Larger text", exact: true })
          .click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `/tmp/octavo-cover-colours-mobile-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(base);
    const thumb = page
      .locator(`a[href="/read/${number}"]`)
      .filter({ has: page.locator("[data-page-frame]") })
      .first();
    await thumb.waitFor();
    assert.equal(
      await thumb
        .locator('[data-cover-entry="masthead"] strong u span')
        .innerText(),
      "Spring",
    );
    assert.deepEqual((await stored()).pages, savedCover.pages);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: palette/custom panels, selected-word bold/italic/underline/colour/shadow, unselected text unchanged, optional detail editing, inheritance, save/reload.",
    );
  },
);
