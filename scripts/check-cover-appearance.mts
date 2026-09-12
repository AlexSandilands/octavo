import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import {
  DEFAULT_COVER_PLACEMENT,
  makeCoverElement,
} from "../src/lib/cover-elements";
const base = process.argv[2] ?? "http://localhost:3024";
await withCoverFixture(
  base,
  async ({ page, edit, sql, id, number, stored, waitSaved, errors }) => {
    const initial = await stored(),
      cover = initial.pages[0]!;
    const photo = cover.blocks.find((b) => b.type === "image")!;
    const heading = cover.blocks.find((b) => b.type === "heading")!;
    assert(heading.type === "heading");
    heading.title = "Spring Issue";
    heading.coverPlacement = { ...DEFAULT_COVER_PLACEMENT, row: "top" };
    cover.blocks = [
      heading,
      {
        id: "tagline",
        type: "text",
        text: "Stories from our community.",
        coverPlacement: { ...DEFAULT_COVER_PLACEMENT },
      },
    ];
    const detail = makeCoverElement("details");
    detail.id = "details";
    detail.placement.row = "bottom";
    cover.coverElements = [detail];
    await sql`update issues set content=${sql.json(initial)} where id=${id}`;
    await page.goto(edit);
    const canvas = page.locator("[data-page-frame]");
    const panel = page.getByRole("complementary", {
      name: "Cover element settings",
    });
    const decoration = canvas.locator("[data-page-decoration]");
    const toggle = panel.getByRole("checkbox", {
      name: "Show theme decoration",
    });
    await canvas.waitFor();
    await page.keyboard.press("Escape");
    await toggle.waitFor();
    assert(await toggle.isChecked());
    assert.equal(await decoration.count(), 1);
    const masthead = panel.getByRole("checkbox", {
      name: "Show magazine name and issue number",
      exact: true,
    });
    assert(await masthead.isChecked());
    assert.equal(await canvas.locator("[data-page-masthead]").count(), 1);
    await masthead.uncheck();
    await waitSaved((c) => c.pages[0]!.coverOverlay?.masthead === false);
    assert.equal(await canvas.locator("[data-page-masthead]").count(), 0);
    assert.equal(
      await decoration.locator(":scope > .border-page-frame").count(),
      1,
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert(await masthead.isChecked());
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    assert.equal(await canvas.locator("[data-page-masthead]").count(), 0);
    await toggle.uncheck();
    await waitSaved((c) => c.pages[0]!.coverOverlay?.decoration === false);
    assert.equal(await decoration.count(), 0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert(await toggle.isChecked());
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    assert.equal(await decoration.count(), 0);
    const font = async (selector: string) =>
      canvas
        .locator(selector)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const title = '[data-block-id="masthead"] [data-cover-copy]';
    const headCopy = canvas.locator(title).last();
    await headCopy.click();
    const width = await canvas
      .locator('[data-cover-entry="masthead"]')
      .evaluate((e) => e.clientWidth);
    await panel
      .getByRole("button", { name: "Text size: large", exact: true })
      .click();
    assert.equal(
      await headCopy.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      ),
      81.6,
    );
    assert.equal(
      await canvas
        .locator('[data-cover-entry="masthead"]')
        .evaluate((e) => e.clientWidth),
      width,
    );
    await panel
      .getByRole("button", { name: "Text size: small", exact: true })
      .click();
    assert.equal(
      await headCopy.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      ),
      54.4,
    );
    await canvas.locator('[data-block-id="tagline"]').click();
    await panel
      .getByRole("button", { name: "Text size: large", exact: true })
      .click();
    assert.equal(
      await font('[data-block-id="tagline"] [data-cover-copy]'),
      28.8,
    );
    await canvas
      .getByRole("button", { name: "Edit Issue details", exact: true })
      .click();
    await panel
      .getByRole("button", { name: "Text size: extra large", exact: true })
      .click();
    assert.equal(await font(".cover-issue-details"), 16.8);
    await waitSaved(
      (c) => c.pages[0]!.coverElements?.[0]?.placement.textSize === "xlarge",
    );
    await page.reload();
    assert.equal(await decoration.count(), 0);
    assert.equal(await font(".cover-issue-details"), 16.8);
    await page.screenshot({ path: "/tmp/octavo-cover-text-size.png" });
    await page.keyboard.press("Escape");
    for (const width of [1440, 1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await panel.waitFor();
      await page.waitForFunction(() => {
        const frame = document
          .querySelector("[data-page-frame]")
          ?.getBoundingClientRect();
        const panel = document
          .querySelector('aside[aria-label="Cover element settings"]')
          ?.getBoundingClientRect();
        return frame && panel && panel.left >= frame.right - 1;
      });
      const box = await panel.boundingBox(),
        frame = await canvas.boundingBox();
      assert(
        box &&
          frame &&
          box.x >= frame.x + frame.width &&
          box.x + box.width <= width,
      );
      assert.equal(
        await panel.evaluate(
          (el) => getComputedStyle(el.parentElement!).zIndex,
        ),
        "10",
      );
      await page.screenshot({
        path: `/tmp/octavo-cover-appearance-${width}.png`,
      });
    }
    const saved = await stored();
    saved.pages[0]!.coverOverlay!.decoration = true;
    await page.goto(`${base}/admin`);
    await sql`update issues set status='published', published_at=now(), content=${sql.json(saved)} where id=${id}`;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/read/${number}`);
    const readerCover = page.locator("[data-page-frame]:visible").first();
    await readerCover.locator(".cover-grid").waitFor();
    assert.equal(
      await readerCover.locator("[data-page-decoration]").count(),
      1,
    );
    assert.equal(
      await readerCover
        .locator('[data-cover-entry="masthead"] h2')
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      54.4,
    );
    assert.equal(await readerCover.locator("[data-page-masthead]").count(), 0);
    const token = createHash("sha256")
      .update(`${process.env.AUTH_SECRET}:pdf-print`)
      .digest("hex");
    for (const theme of ["classic", "modern"]) {
      for (const enabled of [false, true]) {
        const content = structuredClone(saved);
        content.pages[0]!.coverOverlay!.decoration = enabled;
        await sql`update issues set content=${sql.json(content)} where id=${id}`;
        await page.goto(
          `${base}/read/${number}/print?token=${token}&theme=${theme}`,
          { waitUntil: "networkidle" },
        );
        const frames = page.locator("[data-page-frame]");
        assert.equal(
          await frames.first().locator("[data-page-masthead]").count(),
          0,
        );
        assert.equal(
          await frames.nth(1).locator("[data-page-masthead]").count(),
          theme === "classic" ? 1 : 0,
        );

        assert.equal(
          await frames.first().locator("[data-page-decoration]").count(),
          enabled ? 1 : 0,
        );
        assert.equal(
          await frames.nth(1).locator("[data-page-decoration]").count(),
          1,
          "interior decoration stays",
        );
        assert.equal(
          await frames
            .first()
            .locator('[data-cover-entry="tagline"] p')
            .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
          28.8,
        );
        await page.pdf({
          path: `/tmp/octavo-cover-appearance-${theme}-${enabled}.pdf`,
          printBackground: true,
          preferCSSPageSize: true,
        });
      }
    }
    await sql`update issues set content=${sql.json(saved)} where id=${id}`;
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${base}/read/${number}`);
      const cover = page.locator("section.cover-composition").first();
      await cover.locator(".cover-grid-mobile").waitFor();
      const title = cover.locator('[data-cover-entry="masthead"] h2');
      const before = await title.evaluate((e) =>
        parseFloat(getComputedStyle(e).fontSize),
      );
      assert.equal(before, 32.8);
      await page
        .getByRole("button", { name: "Larger text", exact: true })
        .click();
      assert(
        (await title.evaluate((e) =>
          parseFloat(getComputedStyle(e).fontSize),
        )) > before,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(base);
    const thumb = page
      .locator(`a[href="/read/${number}"]`)
      .filter({ has: page.locator("[data-page-frame]") })
      .first();
    await thumb.waitFor();
    assert.equal(await thumb.locator("[data-page-decoration]").count(), 1);
    assert.equal(await thumb.locator("[data-page-masthead]").count(), 0);
    assert.equal(
      await thumb
        .locator('[data-cover-entry="masthead"] h2')
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      54.4,
    );
    // Explicit decoration also works on photographic covers; legacy photos remain unframed.
    for (const enabled of [undefined, true]) {
      const content = structuredClone(saved);
      content.pages[0]!.blocks.push(photo);
      content.pages[0]!.coverOverlay!.decoration = enabled;
      await sql`update issues set content=${sql.json(content)} where id=${id}`;
      await page.goto(edit);
      await canvas.locator("[data-cover-background]").waitFor();
      assert.equal(await decoration.count(), enabled ? 1 : 0);
    }
    await page.keyboard.press("Escape");
    assert.equal(await masthead.isChecked(), false);
    await page.screenshot({ path: "/tmp/octavo-cover-masthead-toggle.png" });
    await page.goto(`${base}/admin`);
    await sql`update issues set theme='modern' where id=${id}`;
    await page.goto(edit);
    await canvas.waitFor();
    await page.keyboard.press("Escape");
    await toggle.waitFor();
    assert.equal(
      await masthead.count(),
      0,
      "themes without a masthead have no redundant toggle",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: cover decoration defaults/toggle/history, independent text size, save/reload, responsive floating inspector, reader/thumbnail/both PDF themes, mobile reflow and reader text scaling.",
    );
  },
);
