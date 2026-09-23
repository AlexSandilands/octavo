// dev-discussion-gate.mts, the composer's two pills (issue #304): "Posting as"
// under a 40-character name beside the page pill, measured and photographed in
// the desktop drawer (440px) and on phones at 390 and 360 — one row where
// they fit with Post, the pills on a row of their own where they don't — and
// the page menu on a 42-page issue, scrolling inside the panel. A reply box
// keeps its one row. The screenshots are for the owner's eye.
import { randomUUID } from "node:crypto";
import type { Page } from "playwright";
import type { Kit } from "./discussion-gate-kit.mts";
import {
  TAGS_OUT,
  escapeMenu,
  pickerRows,
  openPicker,
  openShell,
  tagReader,
  writePages,
} from "./discussion-gate-tags.mts";

const LONG = "Wilhelmina Featherstonehaugh-Worthington";

function layout(page: Page) {
  return page.evaluate(() => {
    const form = document
      .querySelector("#discussion-composer")!
      .closest("form")!;
    const box = (el: Element | null) => {
      const r = el!.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height };
    };
    const name = form.querySelector('button[aria-label^="Posting as"]')!;
    const tag = form.querySelector(
      'button[aria-haspopup=menu][aria-label^="Tag"]',
    )!;
    const words = name.querySelector(".truncate") as HTMLElement;
    const style = (el: Element) => {
      const s = getComputedStyle(el);
      return `${s.borderTopWidth} ${s.borderTopColor} ${s.fontSize} ${s.borderRadius}`;
    };
    return {
      form: box(form),
      name: box(name),
      tag: box(tag),
      post: box(form.querySelector("button[type=submit]")),
      truncated: words.scrollWidth > words.clientWidth,
      same: style(name) === style(tag),
      styles: `${style(name)} / ${style(tag)}`,
    };
  });
}

/** The panel's box: the drawer, or the sheet. */
const panel = (page: Page) =>
  page.locator("[role=dialog]").first().boundingBox();

export async function composerLook(k: Kit) {
  // A long issue: a real issue's pages repeated to 42, each with its own id,
  // and a comment tagged to page 12 so the thread shows a chip.
  const issue = await k.issue(true, 5);
  const [row] = await k.sql<{ content: { pages: { id: string }[] } }[]>`
    select content from issues where id = ${issue.id}`;
  const source = row!.content.pages;
  const long = Array.from({ length: 42 }, (_, i) => ({
    ...source[i % source.length]!,
    id: randomUUID(),
    ...(i === 0 ? {} : { cover: false }),
  }));
  await writePages(k, issue.id, long);
  const wren = await k.member("wren", { name: "Wren Check" });
  await k.name(wren.id, LONG);
  const short = await k.name(wren.id, "Wren");
  await k.comment(
    issue.id,
    wren,
    short,
    "check-304 The photograph on this page is the 1978 final, not 1979.",
    { pageId: long[11]!.id },
  );
  const issueNo = issue.number!;

  for (const [width, height] of [
    [1280, 860],
    [390, 844],
    [360, 740],
  ] as const) {
    const desk = width >= 768;
    const tagName = desk ? "440" : `${width}`;
    k.heading(`tags — the two pills at ${tagName}px`);
    const r = await tagReader(k, wren, issueNo, { width, height }, true);
    const { page } = r;
    // tsx names the helpers inside evaluate() with a __name the page lacks.
    await page.evaluate("globalThis.__name ??= (f) => f");
    // Reading page 12: the flipbook turned six times, the column scrolled.
    if (desk) {
      for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
    } else {
      await page.evaluate((id) => {
        document.querySelector(`[data-reader-page="${id}"]`)!.scrollIntoView();
      }, long[11]!.id);
      await page.waitForTimeout(250);
    }
    await openShell(k, page);
    const menu = page.locator('button[aria-label^="Posting as"]');
    if (!(await menu.getAttribute("aria-label"))?.includes(LONG)) {
      await menu.click();
      await page.click(`[role=menuitemradio]:has-text("${LONG}")`);
    }
    // Off every control, so no hover colour lingers in the pictures.
    await page.mouse.move(1, 1);
    await page.waitForTimeout(300);
    const shotBox = desk ? await panel(page) : null;
    const shoot = (file: string) =>
      page.screenshot({
        path: `${TAGS_OUT}/${file}.png`,
        ...(shotBox ? { clip: shotBox } : {}),
      });
    let l = await layout(page);
    k.ok(
      l.same && Math.round(l.name.h) === Math.round(l.tag.h),
      `both pills alike: same height (${l.name.h}px), border, type and shape${l.same ? "" : ` (${l.styles})`}`,
    );
    k.ok(l.truncated, "the 40-character name truncates");
    const row = (a: { t: number; b: number }, c: { t: number; b: number }) =>
      Math.abs(a.t + a.b - c.t - c.b) < 4;
    k.ok(
      row(l.name, l.tag) && l.tag.l > l.name.r && l.tag.l - l.name.r <= 12,
      `the page pill sits right beside the name (${Math.round(l.tag.l - l.name.r)}px)`,
    );
    if (desk) {
      k.ok(
        row(l.name, l.post) && l.post.l > l.tag.r,
        "at 440 the pills and Post share one row",
      );
    } else {
      k.ok(
        l.post.t >= l.name.b && Math.abs(l.post.r - l.form.r) < 2,
        "on a phone the pills take their own row, Post beneath at the right",
      );
    }
    k.ok(
      l.post.r <= l.form.r + 0.5 && l.tag.r <= l.form.r + 0.5,
      "nothing overflows the composer",
    );
    await shoot(`composer-${tagName}`);
    await openPicker(page);
    await page.mouse.move(1, 1);
    await shoot(`menu-top-${tagName}`);
    let rows = await pickerRows(page);
    const open = desk ? ["Page 12", "Page 13"] : ["Page 12"];
    k.ok(
      rows
        .slice(1, 1 + open.length)
        .every((r, i) => r.open && r.text === open[i]) &&
        rows.filter((r) => r.open).length === open.length * 2 &&
        rows.length === 42 + 1 + open.length,
      `past the first screen, the open page(s) (${open.join(", ")}) are repeated under “No page”, marked in both places`,
    );
    await page.locator("[role=menu] [role=menuitemradio]").nth(1).click();
    await openPicker(page);
    rows = await pickerRows(page);
    k.ok(
      rows.filter((r) => r.checked).length === 1 && rows[1]!.checked,
      "choosing the repeat ticks that row alone",
    );
    await escapeMenu(page);
    // The pictures show the pills at rest, not the ring Escape left behind.
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await page.mouse.move(1, 1);
    await page.waitForTimeout(300);
    l = await layout(page);
    k.ok(
      desk ? row(l.name, l.post) : l.post.t >= l.name.b,
      "choosing “Page 12” leaves the layout as it was",
    );
    await shoot(`composer-${tagName}-tagged`);

    await openPicker(page);
    const m = await page.evaluate(() => {
      const el = document.querySelector(
        '[role=menu][aria-label="Tag a page"]',
      )!;
      const r = el.getBoundingClientRect();
      const p = el.closest("[role=dialog]")!.getBoundingClientRect();
      return {
        scrolls: el.scrollHeight > el.clientHeight + 10,
        inside:
          r.top >= p.top - 0.5 &&
          r.bottom <= p.bottom + 0.5 &&
          r.left >= p.left - 0.5 &&
          r.right <= p.right + 0.5 &&
          r.bottom <= window.innerHeight,
        rows: el.querySelectorAll("[role=menuitemradio]").length,
        repeats:
          el.querySelectorAll("[role=menuitemradio] [data-open-now]").length /
          2,
      };
    });
    k.ok(
      m.scrolls && m.inside && m.rows === 42 + 1 + m.repeats,
      `the menu lists all 42 pages, scrolls, and stays inside the panel`,
    );
    await page.keyboard.press("End");
    await page.mouse.move(1, 1);
    await shoot(`menu-${tagName}`);
    k.ok(
      await page.evaluate(() => {
        const el = document.activeElement!;
        const r = el.getBoundingClientRect();
        const m = el.closest("[role=menu]")!.getBoundingClientRect();
        return (
          el.textContent?.startsWith("Page 42") && r.bottom <= m.bottom + 1
        );
      }),
      "End reaches Page 42, scrolled into view",
    );
    await escapeMenu(page);

    if (desk) {
      k.heading("tags — a reply box keeps its one row, with no page pill");
      await page.fill("#discussion-composer", "check-304 for a reply");
      await page.click("form:has(#discussion-composer) button[type=submit]");
      await page.waitForSelector('button[aria-label^="Reply to"]');
      await page.locator('button[aria-label^="Reply to"]').last().click();
      const reply = await page.evaluate(() => {
        const form = document
          .querySelector('textarea[id^="reply-"]')!
          .closest("form")!;
        const t = (sel: string) =>
          form.querySelector(sel)!.getBoundingClientRect().top;
        return {
          pill: form.querySelector('[aria-label^="Tag"]') !== null,
          oneRow:
            Math.abs(
              t('button[aria-label^="Posting as"]') - t("button[type=submit]"),
            ) < 6,
        };
      });
      k.ok(
        !reply.pill && reply.oneRow,
        "Posting as, Cancel and Reply on one row",
      );
    }
    await r.ctx.close();
  }
}
