import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Locator } from "playwright";
import type { CoverFixture } from "./cover-elements-fixture.mts";

export async function checkFontReaders(base: string, f: CoverFixture) {
  const { page, sql, id, number } = f;
  await page.goto(`${base}/admin`);
  await sql`update issues set status='published', published_at=now() where id=${id}`;
  const check = async (container: Locator) => {
    const heading = container.locator(
      '[data-cover-entry="font-story"] .cover-story-headline',
    );
    await heading.waitFor();
    await page.evaluate(() => document.fonts.ready);
    const runs = await heading.evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const result: {
        text: string;
        family: string;
        weight: string;
        style: string;
      }[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const s = getComputedStyle(node.parentElement!);
        result.push({
          text: node.textContent!,
          family: s.fontFamily,
          weight: s.fontWeight,
          style: s.fontStyle,
        });
      }
      return result;
    });
    const club = runs.find((r) => r.text === "Club"),
      stories = runs.find((r) => r.text === " stories");
    assert(club && stories);
    assert.match(club.family, /hanken/i);
    assert.equal(club.weight, "900");
    assert.equal(club.style, "italic");
    assert.match(stories.family, /roboto/i);
    assert.equal(stories.weight, "900");
    assert.equal(stories.style, "normal");
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/read/${number}`);
  await check(page.locator("[data-page-frame]:visible").first());
  const token = createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  for (const theme of ["classic", "modern"]) {
    await page.goto(
      `${base}/read/${number}/print?token=${token}&theme=${theme}`,
      { waitUntil: "networkidle" },
    );
    await check(page.locator("[data-page-frame]").first());
    await page
      .locator("[data-page-frame]")
      .first()
      .screenshot({ path: `.data/cover-font-check/print-${theme}.png` });
    await page.pdf({
      path: `.data/cover-font-check/${theme}.pdf`,
      printBackground: true,
      preferCSSPageSize: true,
    });
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/read/${number}`);
    const mobile = page.locator("section.cover-composition").first();
    await check(mobile);
    for (let i = 0; i < 4; i++)
      await page
        .getByRole("button", { name: "Larger text", exact: true })
        .click();
    await check(mobile);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `.data/cover-font-check/mobile-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base);
  const thumb = page
    .locator(`a[href="/read/${number}"]`)
    .filter({ has: page.locator("[data-page-frame]") })
    .first();
  await check(thumb);
  console.log(
    "PASS: desktop reader, both PDF themes, mobile through largest text size, and library thumbnail retain heavy inline and headline fonts",
  );
}
