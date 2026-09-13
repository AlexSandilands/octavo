// Cover panels that fit the text (issue #286). Without a URL it checks the schema,
// resolution and shared markup in memory; with a local server it also drives the
// inspector, history, autosave, reload, desktop and phone readers and both PDF
// themes, measuring each wrapped line's band against the words it carries.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locator, Page as BrowserPage } from "playwright";
import { withCoverFixture } from "./cover-elements-fixture.mts";
import {
  coverAppearanceSchema,
  resolveCoverAppearance,
} from "../src/lib/cover-appearance";
import {
  DEFAULT_COVER_PLACEMENT,
  makeCoverElement,
} from "../src/lib/cover-elements";
import { itemAppearance } from "../src/lib/cover-order";
import type { IssueContent, Page } from "../src/lib/blocks";
import { CoverRichText } from "../src/features/blocks/cover-rich-text.tsx";
import { PageContent } from "../src/features/blocks/page-content.tsx";

// In memory: additive, defaulted, and never offered to items without lines.
assert(coverAppearanceSchema.safeParse({ panelShape: "text" }).success);
assert(!coverAppearanceSchema.safeParse({ panelShape: "pill" }).success);
assert.equal(resolveCoverAppearance("paper-panel").panelShape, "block");
assert.equal(
  resolveCoverAppearance("dark", { panel: true, panelShape: "text" })
    .panelShape,
  "text",
);
const fitted: Page = {
  id: "cover",
  cover: true,
  coverOverlay: {
    style: "dark",
    position: "center",
    appearance: { panel: true, panelShape: "text" },
  },
  blocks: [
    {
      id: "photo",
      type: "image",
      align: "full",
      width: 60,
      caption: "",
      coverPlacement: {
        ...DEFAULT_COVER_PLACEMENT,
        appearance: { panel: true },
      },
    },
  ],
  coverElements: [makeCoverElement("story"), makeCoverElement("logo")],
};
assert.equal(
  itemAppearance(fitted.coverElements![0]!, fitted).panelShape,
  "text",
);
for (const item of [fitted.blocks[0]!, fitted.coverElements![1]!])
  assert.equal(itemAppearance(item, fitted).panelShape, "block");
const markup = renderToStaticMarkup(
  createElement(CoverRichText, { text: "One\nTwo" }),
);
assert.match(
  markup,
  /^<span class="cover-line"><span class="cover-line-ink">One<br\/>Two<\/span><\/span>$/,
);
// Both cover compositions carry the shape: the anchor grid per item, the older
// stacked overlay (a Fill photo and unplaced blocks) on the composition.
const render = (page: Page) =>
  renderToStaticMarkup(
    createElement(PageContent, {
      page,
      renderBlock: (b) => createElement("div", { key: b.id }),
    }),
  );
assert.match(
  render(fitted),
  /data-cover-entry="[^"]+"[^>]*data-cover-panel-shape="text"/,
);
const stacked: Page = {
  ...fitted,
  coverElements: undefined,
  blocks: [
    { id: "photo", type: "image", align: "page-fill", width: 100, caption: "" },
    { id: "title", type: "heading", title: "Winter", kicker: "" },
  ],
};
assert.match(
  render(stacked),
  /class="cover-composition relative"[^>]*data-cover-panel="true" data-cover-panel-shape="text"/,
);
console.log(
  "PASS (memory): panel shape schema, defaults, photo/logo blocks, line markup, both compositions",
);

const base = process.argv[2];
if (!base) process.exit(0);
const shots = ".data/cover-panel-shape-check";
await mkdir(shots, { recursive: true });

/** Per wrapped line of copy: the band's box and the words' box, in CSS px. */
function lines(root: Locator) {
  return root.evaluate((el) => {
    const edge =
      el.getBoundingClientRect().right -
      parseFloat(getComputedStyle(el).paddingRight);
    return [...el.querySelectorAll<HTMLElement>(".cover-line")].map((band) => {
      const words = new Map<number, { left: number; right: number }>();
      const walker = document.createTreeWalker(band, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode())
        for (let i = 0; i < node.textContent!.length; i++) {
          if (/\s/.test(node.textContent![i]!)) continue;
          const r = new Range();
          r.setStart(node, i);
          r.setEnd(node, i + 1);
          const box = r.getBoundingClientRect();
          const key = Math.round(box.top + box.height / 2);
          const row = [...words.keys()].find((k) => Math.abs(k - key) < 4);
          const prev = row === undefined ? undefined : words.get(row);
          words.set(row ?? key, {
            left: Math.min(prev?.left ?? Infinity, box.left),
            right: Math.max(prev?.right ?? -Infinity, box.right),
          });
        }
      const style = getComputedStyle(band);
      return {
        edge,
        space: parseFloat(style.fontSize) * 0.3,
        background: style.backgroundColor,
        ink: getComputedStyle(band.firstElementChild!).position,
        bands: [...band.getClientRects()].map((r) => ({
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
        })),
        words: [...words.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, w]) => w),
      };
    });
  });
}
type Lines = Awaited<ReturnType<typeof lines>>;
const wrapped = (runs: Lines) =>
  runs.find((r) => r.words.length >= 2 && r.bands.length >= 2);

/** Each line's band hugs its own words and joins the next line's band. */
async function assertFitted(item: Locator, scale = 1) {
  const box = await item.evaluate(
    (el) =>
      getComputedStyle(el).backgroundImage +
      getComputedStyle(el).backgroundColor,
  );
  assert.match(
    box,
    /^none(rgba\(0, 0, 0, 0\)|transparent)$/,
    "the item's box is clear",
  );
  const runs = await lines(item);
  const run = wrapped(runs);
  assert(run, `fixture wraps: ${JSON.stringify(runs)}`);
  for (const r of runs) {
    assert.notEqual(r.background, "rgba(0, 0, 0, 0)");
    assert.equal(r.ink, "relative", "ink paints above the bands");
  }
  const bands = run.bands.filter((b) => b.right - b.left > 1);
  assert.equal(bands.length, run.words.length, JSON.stringify(run));
  bands.forEach((band, i) => {
    const words = run.words[i]!;
    const pad = 12 * scale;
    // Known editor limit: a line whose words fill the item exactly still bands
    // the space it breaks at (pre-wrap hangs it), about a space wide.
    const hang = words.right >= run.edge - 1 ? run.space : 0;
    assert(
      band.left <= words.left - pad + 2 && band.left >= words.left - pad - 4,
      `left ${JSON.stringify({ band, words })}`,
    );
    assert(
      band.right >= words.right + pad - 3 &&
        band.right <= words.right + pad + 4 + hang,
      `right ${JSON.stringify({ band, words })}`,
    );
    const next = bands[i + 1];
    if (next)
      assert(
        band.bottom >= next.top - 0.01,
        `lines join: ${JSON.stringify({ band, next })}`,
      );
  });
  return run.words;
}
/** The band's padding above the first line's caps matches that below the last
 *  line's baseline, whatever the face's own ascent and descent. */
async function assertEvenPadding(item: Locator, scale = 1) {
  const pads = await item.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>(".cover-line-ink")].map((ink) => {
      // Zero-width probes spanning cap height to baseline.
      const first = document.createElement("span");
      first.style.cssText =
        "display:inline-block;width:0;height:1cap;vertical-align:baseline";
      const last = first.cloneNode() as HTMLSpanElement;
      ink.prepend(first);
      ink.append(last);
      const rects = [...ink.parentElement!.getClientRects()];
      const pad = {
        text: ink.textContent!.slice(0, 24),
        top: first.getBoundingClientRect().top - rects[0]!.top,
        bottom: rects.at(-1)!.bottom - last.getBoundingClientRect().bottom,
      };
      first.remove();
      last.remove();
      return pad;
    }),
  );
  assert(pads.length > 0);
  for (const pad of pads)
    assert(
      Math.abs(pad.top - pad.bottom) <= 1.5 * scale && pad.top > 2 * scale,
      `even padding: ${JSON.stringify(pad)}`,
    );
}
async function assertBlock(item: Locator) {
  const bg = await item.evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.notEqual(bg, "rgba(0, 0, 0, 0)", "block panel fills the box");
  for (const r of await lines(item))
    for (const b of r.bands)
      assert.equal(r.background, "rgba(0, 0, 0, 0)", JSON.stringify(b));
}

await withCoverFixture(base, async (f) => {
  const { page, sql, id, stored, waitSaved } = f;
  const content = await stored();
  const cover = content.pages[0]!;
  const story = makeCoverElement("story");
  assert(story.type === "story");
  story.id = "fit-story";
  story.headlineSize = "display";
  story.showPageNumbers = true;
  story.items = [
    {
      id: "one",
      title: "Night gala gives quietly to the harbour restoration fund",
      description:
        "Members raised more than expected over one long evening of speeches.",
    },
  ];
  story.placement = {
    ...story.placement,
    row: "bottom",
    column: "left",
    align: "left",
    width: "medium",
  };
  const details = makeCoverElement("details");
  assert(details.type === "details");
  details.id = "fit-details";
  details.text = "Winter 2026 edition, printed for the members of the club";
  details.placement = {
    ...details.placement,
    row: "top",
    column: "right",
    align: "right",
    width: "narrow",
  };
  const heading = cover.blocks.find((b) => b.type === "heading")!;
  assert(heading.type === "heading");
  heading.title = "Field Notes from the Long Winter";
  heading.coverPlacement = {
    ...DEFAULT_COVER_PLACEMENT,
    row: "center",
    align: "center",
  };
  cover.coverOverlay = {
    style: "dark",
    position: "center",
    appearance: {
      panel: true,
      background: "paper",
      text: "ink",
      shadow: "none",
    },
  };
  cover.coverElements = [story, details];
  await sql`update issues set content=${sql.json(content)} where id=${id}`;

  const item = (p: BrowserPage, entry: string) =>
    p
      .locator(`[data-page-frame]:visible [data-cover-entry="${entry}"]`)
      .first();
  const panel = page.getByRole("complementary", {
    name: "Cover element settings",
  });
  await page.goto(f.edit);
  await item(page, "fit-story").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await assertBlock(item(page, "fit-story"));
  const before = (await lines(item(page, "fit-story"))).map((r) => r.words);
  const gaps = () => item(page, "fit-story").locator(".cover-gap").count();
  assert.equal(await gaps(), 0, "a block panel leaves editing alone");

  await page.keyboard.press("Escape");
  await panel
    .getByRole("button", { name: "Panel shape: fit text", exact: true })
    .click();
  await waitSaved(
    (c) => c.pages[0]!.coverOverlay?.appearance?.panelShape === "text",
  );
  for (const entry of ["fit-story", "fit-details", heading.id])
    await assertFitted(item(page, entry));
  assert((await gaps()) > 0, "fitted lines mark the spaces between words");
  const widths = (await assertFitted(item(page, "fit-story"))).map(
    (w) => w.right - w.left,
  );
  assert(
    Math.max(...widths) - Math.min(...widths) > 40,
    "the story's lines differ in width",
  );
  assert.deepEqual(
    (await lines(item(page, "fit-story"))).map((r) => r.words),
    before,
    "switching shape never rewraps the text",
  );
  const rule = item(page, heading.id).locator("[data-cover-rule-row]");
  assert(
    await rule.evaluate(
      (el) =>
        el.getBoundingClientRect().width <
        el.parentElement!.getBoundingClientRect().width / 2,
    ),
  );
  await page.screenshot({ path: `${shots}/editor.png` });

  // Typing keeps the bands on the line being edited.
  const headline = item(page, "fit-story").getByRole("textbox", {
    name: "Story headline",
    exact: true,
  });
  await headline.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" appeal");
  await waitSaved((c) => {
    const s = c.pages[0]!.coverElements![0]!;
    return s.type === "story" && s.items[0]!.title.endsWith(" appeal");
  });
  await assertFitted(item(page, "fit-story"));
  // A doubled space is stored as typed, never as the no-break space the browser
  // inserts beside a collapsing gap.
  await page.keyboard.type("  now");
  await waitSaved((c) => {
    const s = c.pages[0]!.coverElements![0]!;
    return s.type === "story" && s.items[0]!.title.endsWith(" appeal  now");
  });

  // An empty field still shows its placeholder inside the new line spans.
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  assert.match(
    await headline.evaluate((el) => getComputedStyle(el, "::before").content),
    /Story headline/,
  );
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  /** Typing folds into history steps of its own choosing; step back until `done`. */
  const undoUntil = async (done: (c: IssueContent) => boolean) => {
    for (let i = 0; i < 4 && !done(await stored()); i++) {
      await undo.click();
      await page.waitForTimeout(1200);
    }
    await waitSaved(done);
  };
  const fit = (c: IssueContent) =>
    c.pages[0]!.coverOverlay?.appearance?.panelShape === "text";
  await undoUntil((c) => {
    const s = c.pages[0]!.coverElements![0]!;
    return s.type === "story" && s.items[0]!.title === story.items[0]!.title;
  });
  assert(fit(await stored()), "text history stops short of the shape change");

  // One item departs from the cover default; photos and logos offer no shape.
  await headline.click();
  await panel.getByRole("checkbox", { name: "Use cover appearance" }).uncheck();
  await panel
    .getByRole("button", { name: "Panel shape: block", exact: true })
    .click();
  await waitSaved(
    (c) =>
      c.pages[0]!.coverElements![0]!.placement.appearance?.panelShape ===
      "block",
  );
  await assertBlock(item(page, "fit-story"));
  await assertFitted(item(page, "fit-details"));
  await undoUntil(
    (c) => c.pages[0]!.coverElements![0]!.placement.appearance === undefined,
  );
  assert(fit(await stored()));
  await assertFitted(item(page, "fit-story"));
  await undo.click();
  await waitSaved((c) => !fit(c));
  await assertBlock(item(page, "fit-story"));
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await waitSaved(
    (c) => c.pages[0]!.coverOverlay?.appearance?.panelShape === "text",
  );
  await page.reload();
  await item(page, "fit-story").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await assertFitted(item(page, "fit-story"));

  await sql`update issues set status='published', published_at=now() where id=${id}`;
  await page.goto(`${base}/read/${f.number}`);
  await item(page, "fit-story").waitFor();
  await page.evaluate(() => document.fonts.ready);
  const frame = page.locator("[data-page-frame]:visible").first();
  const scale = await frame.evaluate(
    (el) => el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth,
  );
  for (const entry of ["fit-story", "fit-details", heading.id]) {
    await assertFitted(item(page, entry), scale);
    await assertEvenPadding(item(page, entry), scale);
  }
  await page.screenshot({ path: `${shots}/reader.png` });

  // The phone cover carries the cover's own paint; an item's Block must still win.
  const published = await stored();
  published.pages[0]!.coverElements![1]!.placement.appearance = {
    panel: true,
    panelShape: "block",
    background: "paper",
    text: "ink",
    shadow: "none",
  };
  await sql`update issues set content=${sql.json(published)} where id=${id}`;
  const phone = await f.context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`${base}/read/${f.number}`);
  const phoneItem = (entry: string) =>
    phone.locator(`[data-cover-entry="${entry}"]:visible`).first();
  await phoneItem("fit-story").waitFor();
  await phone.evaluate(() => document.fonts.ready);
  await assertFitted(phoneItem("fit-story"));
  await assertBlock(phoneItem("fit-details"));
  await phone.screenshot({ path: `${shots}/phone.png` });
  await phone.close();

  const token = createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  for (const theme of ["classic", "modern"]) {
    await page.goto(
      `${base}/read/${f.number}/print?token=${token}&theme=${theme}`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    for (const entry of ["fit-story", heading.id]) {
      await assertFitted(page.locator(`[data-cover-entry="${entry}"]`).first());
      await assertEvenPadding(
        page.locator(`[data-cover-entry="${entry}"]`).first(),
      );
    }
    await assertBlock(page.locator('[data-cover-entry="fit-details"]').first());
    await page.screenshot({ path: `${shots}/print-${theme}.png` });
  }
  const saved = (await stored()) satisfies IssueContent;
  assert.equal(saved.pages[0]!.coverOverlay?.appearance?.panelShape, "text");
  assert.deepEqual(f.errors, []);
  console.log(
    "PASS (browser): fitted bands in editor (typing, placeholder, override, undo/redo, reload), desktop and phone readers, both print themes",
  );
});
