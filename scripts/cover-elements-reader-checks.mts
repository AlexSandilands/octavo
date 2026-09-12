import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { CoverFixture } from "./cover-elements-fixture.mts";

export async function checkCoverReaders(base: string, f: CoverFixture) {
  const { page, sql, id, number, stored } = f;
  const saved = await stored();
  await page.goto(`${base}/admin`); // Unmount autosave before altering this scratch fixture.
  await sql`update issues set status='published', published_at=now() where id=${id}`;
  const assertCover = async () => {
    const frame = page.locator("[data-page-frame]:visible").first();
    await frame.locator(".cover-grid").waitFor();
    assert.equal(await frame.locator("[data-cover-entry]").count(), 5);
    assert((await frame.innerText()).includes("From the archive"));
    assert((await frame.innerText()).includes("Meet the members"));
    assert.equal(await frame.locator("[data-page-footer]").count(), 0);
    const logo = frame.locator(".cover-logo img");
    await logo.evaluate(async (el) => {
      if (el instanceof HTMLImageElement) await el.decode();
    });
    const ratio = await logo.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    });
    assert(Math.abs(ratio - 2) < 0.01);
    return frame;
  };
  const token = createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  for (const theme of ["classic", "modern"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/read/${number}`);
    await assertCover();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.locator("[data-turning]").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await page.locator("[data-turning]").waitFor({ state: "hidden" });
    await assertCover();
    await page.goto(
      `${base}/read/${number}/print?token=${token}&theme=${theme}`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    const frame = await assertCover();
    await frame.screenshot({
      path: `/tmp/octavo-cover-elements-print-${theme}.png`,
    });
    await page.pdf({
      path: `/tmp/octavo-cover-elements-${theme}.pdf`,
      printBackground: true,
      preferCSSPageSize: true,
    });
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/read/${number}`);
    const cover = page.locator("section.cover-composition").first();
    await cover.locator(".cover-grid-mobile").waitFor();
    assert.equal(await cover.locator("[data-cover-entry]").count(), 5);
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
    const boxes = await cover.locator("[data-cover-entry]").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
    );
    boxes.forEach((r, i) => {
      assert(r.left >= 0 && r.right <= width);
      if (i) assert(r.top >= boxes[i - 1]!.bottom - 1);
    });
    assert((await cover.innerText()).includes("Meet the members"));
    await page.screenshot({
      path: `/tmp/octavo-cover-elements-mobile-${width}.png`,
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
  assert.equal(await thumb.locator("[data-cover-entry]").count(), 5);
  assert((await thumb.innerText()).includes("From the archive"));
  assert.equal(
    await thumb.locator("a").count(),
    0,
    "thumbnail contains no nested links",
  );
  await page.goto(`${base}/admin/magazine`);
  await page
    .getByRole("button", { name: "Delete Cover test mark", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete logo", exact: true })
    .click();
  await page
    .getByText(
      "This logo is still used somewhere, so it can’t be deleted yet.",
      { exact: true },
    )
    .waitFor();
  const [logo] = await sql`select id from logos where id=${f.logoId}`;
  assert(logo, "cover logo is protected from library deletion");

  const plain = structuredClone(saved);
  plain.pages[0]!.blocks = plain.pages[0]!.blocks.filter(
    (b) => b.type !== "image",
  );
  plain.pages[0]!.coverOverlay = { style: "dark", position: "center" };
  await sql`update issues set content=${sql.json(plain)} where id=${id}`;
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/read/${number}`);
    await page.locator(".cover-grid").first().waitFor();
    assert.equal(
      await page
        .locator(".cover-grid")
        .first()
        .locator("[data-cover-entry]")
        .count(),
      5,
    );
    assert.equal(
      await page.locator(".cover-composition").first().locator("img").count(),
      1,
      "plain cover has only its logo",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await sql`update issues set content=${sql.json(saved)} where id=${id}`;
  console.log(
    "PASS: desktop/page turns, both PDF themes, phone reflow at maximum text size, plain covers, thumbnail references and logo deletion guard",
  );
}
