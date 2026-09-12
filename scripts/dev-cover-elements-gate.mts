// npx tsx --tsconfig scripts/tsconfig.json scripts/dev-cover-elements-gate.mts http://localhost:3024
import assert from "node:assert/strict";
import { checkCoverEdits } from "./cover-elements-edit-checks.mts";
import { checkCoverReaders } from "./cover-elements-reader-checks.mts";
import { withCoverFixture } from "./cover-elements-fixture.mts";

const base = process.argv[2] ?? "http://localhost:3024";
await withCoverFixture(base, async (fixture) => {
  const { page, edit, waitSaved, errors } = fixture;
  await page.goto(edit);
  const canvas = page.locator("[data-page-frame]");
  await canvas.waitFor();
  assert.equal(await canvas.locator("[data-cover-element]").count(), 0);
  await canvas.locator('[data-block-id="masthead"]').click();
  const panel = page.getByRole("complementary", {
    name: "Cover element settings",
  });
  const choose = async (trigger: RegExp, menu: string, option: string) => {
    // Portal menus close on any scroll, so bring the trigger into view first.
    await panel.getByRole("button", { name: trigger }).scrollIntoViewIfNeeded();
    await panel.getByRole("button", { name: trigger }).click();
    await page
      .getByRole("menu", { name: menu, exact: true })
      .getByRole("menuitemradio", { name: option, exact: true })
      .click();
  };
  await panel.getByRole("button", { name: "Top centre", exact: true }).click();
  await panel.getByRole("slider", { name: "Vertical adjustment" }).fill("40");
  await page.getByRole("button", { name: "Done" }).click();
  const add = async (name: string) => {
    const toolbar = page.getByRole("group", {
      name: "Editor tools",
      exact: true,
    });
    if (name === "Logo")
      await toolbar.getByRole("button", { name, exact: true }).click();
    else {
      // On a cover the Text tool is a menu: Paragraph, Story, Details.
      await toolbar.getByRole("button", { name: "Text", exact: true }).click();
      await page
        .getByRole("menu", { name: "Text", exact: true })
        .getByRole("menuitemradio", { name, exact: true })
        .click();
    }
    await panel.waitFor();
  };
  const ids = () =>
    canvas
      .locator("[data-cover-element]")
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-cover-element")!),
      );
  /** Adds an element and returns its id; two Stories share one label. */
  const addElement = async (name: string) => {
    const before = await ids();
    await add(name);
    return (await ids()).find((id) => !before.includes(id))!;
  };
  const contentsId = await addElement("Story");
  const listHeading = panel.getByRole("textbox", {
    name: "List heading (optional)",
    exact: true,
  });
  assert.equal(
    await listHeading.getAttribute("data-placeholder"),
    "Inside this issue",
    "the empty list heading offers the example as ghost text",
  );
  assert.equal(
    await canvas
      .locator(`[data-cover-element="${contentsId}"] .cover-story-heading`)
      .count(),
    0,
    "and prints nothing on the page until one is written",
  );
  await listHeading.fill("Inside this issue");
  // A Story starts with one blank story, open and ready; the second is a linked section heading.
  await choose(
    /^Source for story 1:/,
    "Section headings",
    "Our earliest days p. 2",
  );
  await choose(/^Add section:/, "Section headings", "A better game p. 3");
  await panel.getByRole("checkbox", { name: "Show page numbers" }).check();
  const placementBefore = await panel
    .getByRole("button", { name: "Top left", exact: true })
    .boundingBox();
  await panel
    .getByRole("textbox", {
      name: "Cover headline for story 1 (optional override)",
    })
    .fill("From the archive");
  await panel
    .getByRole("textbox", { name: "Supporting text for story 1 (optional)" })
    .fill("The people who started it all.");
  assert.deepEqual(
    await panel
      .getByRole("button", { name: "Top left", exact: true })
      .boundingBox(),
    placementBefore,
    "placement stays visible while content scrolls",
  );
  await panel.getByRole("button", { name: "Bottom left", exact: true }).click();
  await page.getByRole("button", { name: "Done" }).click();
  const storyId = await addElement("Story");
  await choose(
    /^Source for story 1:/,
    "Section headings",
    "Meet the members p. 3",
  );
  await panel
    .getByRole("textbox", { name: "Supporting text for story 1 (optional)" })
    .fill("The faces behind our growing community.");
  await panel
    .getByRole("button", { name: "Width: narrow", exact: true })
    .click();
  const headline = canvas
    .locator(`[data-cover-element="${storyId}"] .cover-story-headline`)
    .first();
  const headlineSize = () =>
    headline.evaluate((el) => getComputedStyle(el).fontSize);
  assert.equal(await headlineSize(), "23px", "a new Story starts at list size");
  await panel
    .getByRole("button", { name: "Headline size: display", exact: true })
    .click();
  assert.equal(await headlineSize(), "36px", "the size segment steps up");
  await panel
    .getByRole("button", { name: "Headline size: large", exact: true })
    .click();
  assert.equal(await headlineSize(), "28px", "and back down again");
  await page.getByRole("button", { name: "Done" }).click();
  await add("Details");
  await panel
    .getByRole("textbox", { name: "Date or edition (optional)" })
    .fill("Spring 2026");
  await page.getByRole("button", { name: "Done" }).click();
  await add("Logo");
  await choose(/^Logo:/, "Cover logo", "Cover test mark");
  await panel.getByRole("slider", { name: "Logo size" }).fill("140");
  await page.getByRole("button", { name: "Done" }).click();
  await waitSaved((c) => {
    const elements = c.pages[0]?.coverElements;
    const logo = elements?.at(-1);
    const story = elements?.find((e) => e.id === storyId);
    return (
      c.version === 7 &&
      elements?.length === 4 &&
      story?.type === "story" &&
      story.headlineSize === "large" &&
      story.items.length === 1 &&
      logo?.type === "logo" &&
      logo.size === 140
    );
  });
  const named = await canvas
    .locator('[data-cover-element] [aria-label^="Edit Story"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")!));
  assert.deepEqual(
    named.sort(),
    ["Edit Story: Inside this issue", "Edit Story: Meet the members"],
    "the two Stories are told apart by what they say",
  );
  const mark = canvas.locator('[data-cover-entry][data-logo="true"]');
  const markWidth = await mark.evaluate(
    (el) => (el as HTMLElement).offsetWidth,
  );
  assert.equal(markWidth, 140, "logo bounds match the image width");
  await canvas.getByRole("button", { name: "Edit Logo", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Use cover appearance" }).uncheck();
  await panel
    .getByRole("button", { name: "Background: panel", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Panel colour: Paper", exact: true })
    .click();
  assert.equal(
    await mark.evaluate((el) => (el as HTMLElement).offsetWidth),
    176,
    "panel adds only its padding",
  );
  await panel.getByRole("checkbox", { name: "Use cover appearance" }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.screenshot({ path: "/tmp/octavo-cover-elements-editor.png" });
  assert.equal(await canvas.locator("[data-cover-element]").count(), 4);
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const main = await page
      .getByRole("group", { name: "Editor tools", exact: true })
      .boundingBox();
    assert(main && main.x >= 110 && main.x + main.width <= width);
    const publish = await page
      .getByRole("button", { name: "Publish", exact: true })
      .boundingBox();
    assert(
      publish && publish.x + publish.width <= width,
      "header actions remain accessible",
    );
    assert.equal(
      await page.getByRole("button", { name: "Montage", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: "Sponsor", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: /^Editing:/ }).count(),
      0,
    );
    await canvas
      .locator(`[data-cover-element="${contentsId}"]`)
      .getByRole("button", { name: /^Edit Story/ })
      .click();
    await panel.waitFor();
    const box = await panel.boundingBox();
    const frameBox = await canvas.boundingBox();
    assert(
      box && frameBox && box.x >= frameBox.x + frameBox.width - 1,
      "inspector never covers the fitted page",
    );
    assert(box && box.y >= 60 && box.x + box.width <= width);
    await panel
      .getByRole("checkbox", { name: "Use cover appearance" })
      .uncheck();
    await panel
      .getByRole("button", { name: "Background: panel", exact: true })
      .click();
    const swatch = await panel
      .getByRole("button", { name: "Panel colour: Blue", exact: true })
      .boundingBox();
    assert(swatch && swatch.x >= 0 && swatch.x + swatch.width <= width);
    await panel.getByRole("checkbox", { name: "Use cover appearance" }).check();
    await page.screenshot({
      path: `/tmp/octavo-cover-elements-panel-${width}.png`,
    });
    await page.keyboard.press("Escape");
    assert.equal(
      await panel.getByRole("heading", { name: "Cover", exact: true }).count(),
      1,
    );
  }
  await page.reload();
  await canvas
    .getByRole("button", { name: "Edit Logo", exact: true })
    .waitFor();
  assert.equal(await canvas.locator("[data-cover-element]").count(), 4);
  // The pinned Placement band folds away, and the choice survives a reload.
  const openContents = async () => {
    await canvas
      .locator(`[data-cover-element="${contentsId}"]`)
      .getByRole("button", { name: /^Edit Story/ })
      .click();
    await panel.waitFor();
  };
  const placementBand = panel.getByRole("button", {
    name: "Placement",
    exact: true,
  });
  const grid = panel.getByRole("button", { name: "Top left", exact: true });
  await openContents();
  assert.equal(await placementBand.getAttribute("aria-expanded"), "true");
  await placementBand.click();
  assert.equal(await placementBand.getAttribute("aria-expanded"), "false");
  assert.equal(await grid.count(), 0, "a folded band shows no grid");
  await page.reload();
  await canvas
    .getByRole("button", { name: "Edit Logo", exact: true })
    .waitFor();
  await openContents();
  assert.equal(
    await placementBand.getAttribute("aria-expanded"),
    "false",
    "the fold is remembered",
  );
  await placementBand.click();
  await grid.waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await checkCoverEdits(fixture, storyId);
  await checkCoverReaders(base, fixture);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: the Text menu's Stories and Details, headline sizes, heading references, title override, placement, logo selection/size, docked responsive controls and autosave/reload",
  );
});
