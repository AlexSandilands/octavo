// npx tsx --tsconfig scripts/tsconfig.json scripts/check-cover-fonts-browser.mts http://localhost:3024
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import type { Locator } from "playwright";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import { makeCoverElement } from "../src/lib/cover-elements";
import { CONTENT_VERSION, type IssueContent } from "../src/lib/blocks";
import { checkFontReaders } from "./cover-fonts-reader-checks.mts";

const base = process.argv[2] ?? "http://localhost:3024";
await mkdir(".data/cover-font-check", { recursive: true });
await withCoverFixture(base, async (f) => {
  const { page, sql, id, stored, waitSaved } = f;
  const content = await stored();
  const story = makeCoverElement("story");
  assert(story.type === "story");
  story.id = "font-story";
  story.headlineSize = "display";
  story.placement = {
    ...story.placement,
    width: "wide",
    row: "bottom",
    style: "paper-panel",
  };
  story.items = [
    { id: "one", title: "Club stories", description: "Māori voices" },
  ];
  content.pages[0]!.coverElements = [story];
  await sql`update issues set content=${sql.json(content)} where id=${id}`;
  const savedStory = (c: IssueContent) => {
    const s = c.pages[0]!.coverElements!.find((e) => e.id === story.id)!;
    assert(s.type === "story");
    return s;
  };
  const paintFor = (c: IssueContent) =>
    savedStory(c)
      .placement.richText?.["one:title"]?.content[0]?.content?.flatMap((n) =>
        n.type === "text" ? (n.marks ?? []) : [],
      )
      .find((m) => m.type === "coverPaint")?.attrs;
  await page.goto(f.edit);
  const frame = page.locator("[data-page-frame]");
  const headline = frame.getByRole("textbox", {
    name: "Story headline",
    exact: true,
  });
  const description = frame.getByRole("textbox", {
    name: "Supporting text",
    exact: true,
  });
  await headline.waitFor();
  await headline.click();
  const panel = page.getByRole("complementary", {
    name: "Cover element settings",
  });
  const bar = page.getByRole("group", { name: "Selected text formatting" });
  const style = (locator: Locator) =>
    locator.evaluate((el) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, weight: s.fontWeight, style: s.fontStyle };
    });
  const choose = async (host: Locator, label: string, name: string) => {
    const trigger = host.getByRole("button", { name: label, exact: true });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const menu = page.getByRole("menu", { name: label, exact: true });
    try {
      await menu.getByRole("menuitemradio", { name, exact: true }).click();
      if (label.startsWith("Selected text"))
        await page.waitForFunction(
          () =>
            document.activeElement instanceof HTMLElement &&
            document.activeElement.isContentEditable,
        );
    } catch (error) {
      await page.screenshot({ path: ".data/cover-font-check/failure.png" });
      console.log({
        label,
        name,
        triggerCount: await trigger.count(),
        menus: await page.getByRole("menu").allTextContents(),
        errors: f.errors,
      });
      throw error;
    }
  };
  const selectClub = async () => {
    await headline.click();
    await page.keyboard.press("Control+Home");
    for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowRight");
  };
  const beforeDescription = await style(description);
  for (const [font, count, max] of [
    ["Newsreader", 4, "Extra Bold 800"],
    ["Hanken Grotesk", 4, "Black 900"],
    ["Roboto Condensed", 4, "Black 900"],
  ] as const) {
    await choose(panel, "Headline font", font);
    await panel
      .getByRole("button", { name: "Headline weight", exact: true })
      .click();
    const menu = page.getByRole("menu", {
      name: "Headline weight",
      exact: true,
    });
    assert.equal(await menu.getByRole("menuitemradio").count(), count + 1);
    assert.deepEqual(
      (await menu.getByRole("menuitemradio").allTextContents()).slice(1),
      ["Extra Light 200", "Regular 400", "Semi Bold 600", max],
    );
    assert.equal(
      await menu.getByRole("menuitemradio", { name: max, exact: true }).count(),
      1,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await panel
        .getByRole("button", { name: "Headline weight", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
  }
  await choose(panel, "Headline weight", "Black 900");
  await waitSaved((c) => savedStory(c).headlineWeight === 900);
  assert.match((await style(headline)).family, /roboto/i);
  assert.equal((await style(headline)).weight, "900");
  assert.deepEqual(await style(description), beforeDescription);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await waitSaved((c) => savedStory(c).headlineWeight !== 900);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await waitSaved((c) => savedStory(c).headlineWeight === 900);

  await selectClub();
  await choose(bar, "Selected text font", "Hanken Grotesk");
  await choose(bar, "Selected text weight", "Regular 400");
  await bar.getByRole("button", { name: "Bold", exact: true }).click();
  const regularBold = headline.locator(
    '[data-cover-font-family="hanken-grotesk"]',
  );
  assert.equal(
    (await style(regularBold)).weight,
    "700",
    "Bold raises an explicitly Regular selection",
  );
  await page.keyboard.press("Control+a");
  await choose(bar, "Selected text font", "Newsreader");
  const mixed = await headline
    .locator('[data-cover-font-family="newsreader"]')
    .evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent,
        weight: getComputedStyle(el).fontWeight,
      })),
    );
  assert(
    mixed.some((r) => r.text === "Club" && r.weight === "700"),
    "mixed family change keeps bold words bold",
  );
  assert(
    mixed.some((r) => r.text === " stories" && r.weight === "800"),
    "mixed family change clamps inherited900 separately",
  );
  await bar
    .getByRole("button", { name: "Clear formatting", exact: true })
    .click();
  await waitSaved((c) => !paintFor(c)?.fontFamily && !paintFor(c)?.fontWeight);

  await selectClub();
  await choose(bar, "Selected text font", "Newsreader");
  await choose(bar, "Selected text weight", "Extra Bold 800");
  await bar.getByRole("button", { name: "Italic", exact: true }).click();
  await waitSaved(
    (c) =>
      paintFor(c)?.fontWeight === 800 && paintFor(c)?.fontStyle === "italic",
  );
  const first = headline.locator('[data-cover-font-family="newsreader"]');
  assert.equal(await first.innerText(), "Club");
  assert.equal((await style(first)).weight, "800");
  assert.match((await style(first)).family, /newsreader/i);
  assert.equal((await style(first)).style, "italic");
  const nodes = savedStory(await stored()).placement.richText!["one:title"]!
    .content[0]!.content!;
  assert(
    nodes.some(
      (n) => n.type === "text" && n.text === " stories" && !n.marks?.length,
    ),
  );
  await bar.getByRole("button", { name: "Bold", exact: true }).click();
  assert.equal(
    (await style(first)).weight,
    "800",
    "Bold must not reduce Extra Bold",
  );
  await bar.getByRole("button", { name: "Underline", exact: true }).click();
  await waitSaved((c) =>
    JSON.stringify(savedStory(c).placement.richText).includes('"underline"'),
  );
  const formatted = await headline.innerHTML();
  await page.keyboard.press("Control+z");
  assert.notEqual(
    await headline.innerHTML(),
    formatted,
    "inline undo follows toolbar focus",
  );
  await page.keyboard.press("Control+Shift+z");
  assert.equal(await headline.innerHTML(), formatted);

  await choose(bar, "Selected text font", "Inherit font");
  await waitSaved((c) => !paintFor(c)?.fontFamily && !paintFor(c)?.fontWeight);
  assert.equal((await style(headline.locator("u").first())).weight, "900");
  await selectClub();
  await choose(bar, "Selected text font", "Hanken Grotesk");
  await choose(bar, "Selected text weight", "Black 900");
  await waitSaved(
    (c) =>
      paintFor(c)?.fontFamily === "hanken-grotesk" &&
      paintFor(c)?.fontWeight === 900,
  );
  await choose(bar, "Selected text font", "Newsreader");
  await waitSaved(
    (c) =>
      paintFor(c)?.fontFamily === "newsreader" &&
      paintFor(c)?.fontWeight === 800,
  );
  await choose(bar, "Selected text font", "Hanken Grotesk");
  await choose(bar, "Selected text weight", "Black 900");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLButtonElement>(
        '[aria-label="Selected text font"]',
      )?.disabled,
  );
  assert.equal(
    await bar
      .getByRole("button", { name: "Selected text font", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await bar
      .getByRole("button", { name: "Selected text weight", exact: true })
      .isDisabled(),
    true,
  );

  await waitSaved(
    (c) =>
      paintFor(c)?.fontFamily === "hanken-grotesk" &&
      paintFor(c)?.fontWeight === 900,
  );
  await selectClub();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("End");
  await page.keyboard.insertText(" / ");
  await page.keyboard.press("Control+v");
  await waitSaved(
    (c) => savedStory(c).items[0]!.title === "Club stories / Club",
  );
  assert.equal(
    await headline.locator('[data-cover-font-family="hanken-grotesk"]').count(),
    2,
    "copy/paste retains typeface",
  );
  for (
    let i = 0;
    i < 3 && (await headline.innerText()) !== "Club stories";
    i++
  ) {
    await page.keyboard.press("Control+z");
  }
  await waitSaved((c) => savedStory(c).items[0]!.title === "Club stories");

  await page.reload();
  await headline.waitFor();
  await headline.click();
  const saved = await stored();
  assert.equal(saved.version, CONTENT_VERSION);
  assert.equal(paintFor(saved)?.fontWeight, 900);
  assert.equal(paintFor(saved)?.fontFamily, "hanken-grotesk");
  const painted = headline.locator('[data-cover-font-family="hanken-grotesk"]');
  assert.equal(await painted.innerText(), "Club");
  assert.equal((await style(painted)).weight, "900");
  assert.equal((await style(painted)).style, "italic");
  await panel
    .getByRole("button", { name: "Bottom right", exact: true })
    .click();
  await panel
    .getByRole("group", { name: "Width", exact: true })
    .getByRole("button", { name: "Width: medium", exact: true })
    .click();
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await selectClub();
    await bar
      .getByRole("button", { name: "Selected text font", exact: true })
      .click();
    const menu = page.getByRole("menu", {
      name: "Selected text font",
      exact: true,
    });
    const bounds = await menu.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.keyboard.press("Escape");
    const boldBox = await bar
      .getByRole("button", { name: "Bold", exact: true })
      .boundingBox();
    assert(boldBox);
    for (const name of ["Selected text font", "Selected text weight"]) {
      const box = await bar
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert(box);
      assert(
        Math.abs(box.height - boldBox.height) <= 1,
        `${name} matches existing button height`,
      );
      assert(
        Math.abs(box.y + box.height / 2 - boldBox.y - boldBox.height / 2) <= 1,
        `${name} shares existing toolbar row`,
      );
    }
    const toolbarBox = await bar.boundingBox();
    assert(
      toolbarBox &&
        toolbarBox.x >= 0 &&
        toolbarBox.x + toolbarBox.width <= width,
      "toolbar remains in the viewport",
    );
    for (const name of [
      "Selected text font",
      "Selected text weight",
      "Bold",
      "Italic",
      "Underline",
      "Text colour",
      "Text shadow",
      "Clear formatting",
    ]) {
      await bar
        .getByRole("button", { name, exact: true })
        .click({ trial: true });
    }
    await bar
      .getByRole("button", { name: "Selected text font", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `.data/cover-font-check/editor-${width}.png`,
    });
  }
  const canvasWidth = (await frame.boundingBox())!.width;
  await bar.hover();
  await page.mouse.wheel(200, 80);
  await page.waitForFunction(() => {
    const row = document.querySelector(
      '[aria-label="Selected text formatting"] > div',
    );
    return row && row.scrollLeft > 0;
  });
  assert.equal(
    (await frame.boundingBox())!.width,
    canvasWidth,
    "scrolling tools does not zoom the page",
  );
  await panel
    .getByRole("button", { name: "Move panel to the left", exact: true })
    .click();
  for (const name of [
    "Selected text font",
    "Selected text weight",
    "Bold",
    "Text shadow",
    "Clear formatting",
  ]) {
    await bar.getByRole("button", { name, exact: true }).click({ trial: true });
  }
  await checkFontReaders(base, f);
  assert.deepEqual(f.errors, []);
  console.log(
    "PASS: four weight presets, compact single-row font controls, headline defaults, selection-only overrides, inheritance, heavy Bold, keyboard undo/redo, copy/paste, empty selection, autosave/reload and responsive menus",
  );
});
