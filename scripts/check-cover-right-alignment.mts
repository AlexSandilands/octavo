import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Locator } from "playwright";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import { makeCoverElement } from "../src/lib/cover-elements";

const base = process.argv[2] ?? "http://localhost:3024";
await mkdir(".data/cover-alignment-check", { recursive: true });
await withCoverFixture(base, async (f) => {
  const { page, sql, id, stored, waitSaved } = f;
  const content = await stored();
  const story = makeCoverElement("story");
  assert(story.type === "story");
  story.id = "alignment-story";
  story.headlineFont = "hanken-grotesk";
  story.headlineWeight = 900;
  story.headlineSize = "large";
  story.placement = {
    ...story.placement,
    row: "bottom",
    column: "right",
    width: "narrow",
  };
  story.items = [
    { id: "one", title: "Something Deeply Hidden", description: "" },
  ];
  content.pages[0]!.coverElements = [story];
  await sql`update issues set content=${sql.json(content)} where id=${id}`;
  await page.goto(f.edit);
  const title = page
    .locator("[data-page-frame]")
    .getByRole("textbox", { name: "Story headline", exact: true });
  await title.click();
  await page
    .getByRole("complementary", { name: "Cover element settings" })
    .getByRole("button", { name: "Alignment: right", exact: true })
    .click();
  await waitSaved(
    (c) => c.pages[0]!.coverElements![0]!.placement.align === "right",
  );
  await page.evaluate(() => document.fonts.ready);
  const edges = (locator: Locator) =>
    locator.evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const lines = new Map<number, number>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (let i = 0; i < node.textContent!.length; i++) {
          if (/\s/.test(node.textContent![i]!)) continue;
          const r = new Range();
          r.setStart(node, i);
          r.setEnd(node, i + 1);
          const rect = r.getBoundingClientRect();
          const y = Math.round(rect.top);
          lines.set(y, Math.max(lines.get(y) ?? -Infinity, rect.right));
        }
      }
      return {
        whitespace: getComputedStyle(el).whiteSpace,
        gaps: [...lines.values()].map(
          (x) => el.getBoundingClientRect().right - x,
        ),
      };
    });
  const check = async (locator: Locator) => {
    const result = await edges(locator);
    assert(result.gaps.length >= 2, "fixture wraps across multiple lines");
    assert(
      result.gaps.every((gap) => Math.abs(gap) < 1),
      `visible line endings align: ${JSON.stringify(result)}`,
    );
  };
  // Confirm this fixture catches the injected editor rule that caused the offset.
  await title.evaluate((el) => {
    el.style.whiteSpace = "break-spaces";
  });
  assert((await edges(title)).gaps.some((gap) => gap > 2));
  await title.evaluate((el) => el.style.removeProperty("white-space"));
  assert.equal((await edges(title)).whitespace, "pre-wrap");
  await check(title);
  await title.click();
  await check(title);
  await page.screenshot({ path: ".data/cover-alignment-check/editor.png" });
  await page.keyboard.press("Escape");
  await check(title);
  await page.reload();
  await title.waitFor();
  await check(title);
  const saved = await stored();
  const savedStory = saved.pages[0]!.coverElements![0]!;
  assert(savedStory.type === "story");
  assert.equal(
    savedStory.items[0]!.title,
    story.items[0]!.title,
    "alignment does not trim or rewrite authored text",
  );
  await page.goto(`${base}/admin`);
  await sql`update issues set status='published', published_at=now() where id=${id}`;
  await page.goto(`${base}/read/${f.number}`);
  const readerTitle = page
    .locator(
      '[data-page-frame]:visible [data-cover-entry="alignment-story"] .cover-story-headline',
    )
    .first();
  await readerTitle.waitFor();
  await page.evaluate(() => document.fonts.ready);
  await check(readerTitle);
  const token = createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  for (const theme of ["classic", "modern"]) {
    await page.goto(
      `${base}/read/${f.number}/print?token=${token}&theme=${theme}`,
      { waitUntil: "networkidle" },
    );
    await check(readerTitle);
  }
  assert.deepEqual(f.errors, []);
  console.log(
    "PASS: wrapped right-aligned cover text in focused/unfocused editor, reload, reader and both print themes; authored text preserved",
  );
});
