import assert from "node:assert/strict";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import { makeCoverElement } from "../src/lib/cover-elements";

const base = process.argv[2] ?? "http://localhost:3024";
await withCoverFixture(base, async (f) => {
  const { page, sql, id, stored, waitSaved } = f;
  const content = await stored();
  const story = makeCoverElement("story");
  assert(story.type === "story");
  story.id = "caret-story";
  story.placement = {
    ...story.placement,
    row: "bottom",
    width: "wide",
    style: "paper-panel",
  };
  story.items = [{ id: "one", title: "", description: "Supporting copy" }];
  content.pages[0]!.coverElements = [story];
  await sql`update issues set content=${sql.json(content)} where id=${id}`;
  await page.goto(f.edit);
  const headline = page
    .locator("[data-page-frame]")
    .getByRole("textbox", { name: "Story headline", exact: true });
  await headline.click();
  const bar = page.getByRole("group", { name: "Selected text formatting" });
  const trigger = (kind: "font" | "weight") =>
    bar.getByRole("button", { name: `Selected text ${kind}`, exact: true });
  const expectMenus = async (family: string, weight: string) => {
    await page.waitForFunction(
      ({ family, weight }) => {
        const bar = document.querySelector(
          '[aria-label="Selected text formatting"]',
        );
        return (
          bar?.querySelector('[aria-label="Selected text font"]')
            ?.textContent === family &&
          bar?.querySelector('[aria-label="Selected text weight"]')
            ?.textContent === weight
        );
      },
      { family, weight },
    );
  };
  const choose = async (kind: "font" | "weight", name: string) => {
    assert(await trigger(kind).isEnabled());
    await trigger(kind).click();
    await page
      .getByRole("menu", { name: `Selected text ${kind}`, exact: true })
      .getByRole("menuitemradio", { name, exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.activeElement instanceof HTMLElement &&
        document.activeElement.isContentEditable,
    );
  };
  const textRuns = () =>
    headline.evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const runs: {
        text: string;
        family: string;
        weight: string;
        italic: string;
      }[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const s = getComputedStyle(n.parentElement!);
        runs.push({
          text: n.textContent!,
          family: s.fontFamily,
          weight: s.fontWeight,
          italic: s.fontStyle,
        });
      }
      return runs;
    });
  await expectMenus("Newsreader", "Medium");
  await choose("font", "Roboto Condensed");
  await choose("weight", "Black 900");
  await choose("font", "Newsreader");
  await expectMenus("Newsreader", "Extra Bold");
  await choose("weight", "Regular 400");
  await choose("font", "Roboto Condensed");
  await expectMenus("Roboto Cond.", "Regular");
  await bar.getByRole("button", { name: "Italic", exact: true }).click();
  await choose("weight", "Black 900");
  await page.keyboard.insertText("Alpha");
  let runs = await textRuns();
  assert.equal(runs.length, 1);
  assert.match(runs[0]!.family, /roboto/i);
  assert.equal(runs[0]!.weight, "900");
  assert.equal(runs[0]!.italic, "italic");
  await choose("font", "Hanken Grotesk");
  await choose("weight", "Regular 400");
  await page.keyboard.type(" beta");
  runs = await textRuns();
  assert.deepEqual(
    runs.map((r) => r.text),
    ["Alpha", " beta"],
  );
  assert.match(runs[0]!.family, /roboto/i);
  assert.equal(runs[0]!.weight, "900");
  assert.match(runs[1]!.family, /hanken/i);
  assert.equal(runs[1]!.weight, "400");
  const before = await headline.innerHTML();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("ArrowRight");
  await expectMenus("Roboto Cond.", "Black");
  await choose("font", "Newsreader");
  await choose("weight", "Regular 400");
  assert.equal(
    await headline.innerHTML(),
    before,
    "caret formatting leaves existing text untouched",
  );
  await page.keyboard.press("End");
  await expectMenus("Hanken", "Regular");
  await page.keyboard.press("Control+a");
  await choose("font", "Newsreader");
  runs = await textRuns();
  assert(runs.every((r) => /newsreader/i.test(r.family)));
  assert.deepEqual(
    runs.map((r) => r.weight),
    ["800", "400"],
  );
  await choose("weight", "Semi Bold 600");
  assert((await textRuns()).every((r) => r.weight === "600"));
  await page.keyboard.press("ArrowRight");
  await choose("font", "Inherit font");
  await expectMenus("Newsreader", "Medium");
  await page.keyboard.insertText(" tail");
  runs = await textRuns();
  assert.equal(runs.at(-1)!.text, " tail");
  assert.equal(runs.at(-1)!.weight, "500");
  assert(runs.slice(0, -1).every((r) => r.weight === "600"));
  await waitSaved((c) => {
    const e = c.pages[0]!.coverElements![0]!;
    return e.type === "story" && e.items[0]!.title === "Alpha beta tail";
  });
  await page.reload();
  await headline.click();
  assert.deepEqual(
    await textRuns(),
    runs,
    "typed and selected font changes survive save/reload",
  );
  assert.deepEqual(f.errors, []);
  console.log(
    "PASS: fonts before first typing, chained cursor styles, caret tracking, unchanged neighbours, range formatting, inheritance and save/reload",
  );
});
