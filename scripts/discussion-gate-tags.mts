// dev-discussion-gate.mts, page tags (issue #304): the open page(s) each
// reader exposes, the composer's page menu (every page, the open ones marked
// and listed first; keyboard only), a tagged post's chip and where it goes (the drawer staying open on a computer, the sheet
// closing onto the section on a phone), Show → This page in the filter panel
// with its count and its refetch when the page changes, an overflow split
// renumbering the chip, a deleted page's "Page removed", and a page_id the
// issue no longer has refused through the action. The phone half lives in
// discussion-gate-tags-phone.mts, the composer's look in
// discussion-gate-tags-look.mts.
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import {
  OPEN_BUTTON,
  type Issue,
  type Kit,
  type Member,
} from "./discussion-gate-kit.mts";
import { heard, said } from "./discussion-gate-desktop.mts";
import { composerLook } from "./discussion-gate-tags-look.mts";
import { phoneTags } from "./discussion-gate-tags-phone.mts";
import {
  SHOW_MENU,
  filterState,
  openShow,
  setFilter,
  showRows,
} from "./discussion-gate-filter-kit.mts";

export const TAGS_OUT = path.resolve(".data/tags-review");

export type TagCast = {
  issue: Issue;
  /** The issue's page ids, in order, as the gate began. */
  pages: string[];
  tess: Member;
  tom: Member;
  ada: Member;
  adaName: string;
};

/** The reader, recording every list request's address. Reduced motion makes
 *  the flipbook's turns instant. */
export async function tagReader(
  k: Kit,
  who: Member,
  number: number,
  size: { width: number; height: number },
  reducedMotion = true,
) {
  const r = await k.reader(who, number, { ...size, reducedMotion });
  const lists: string[] = [];
  r.page.on("request", (req) => {
    if (/\/api\/issues\/\d+\/comments/.test(req.url())) lists.push(req.url());
  });
  return { ...r, lists };
}

export async function openShell(k: Kit, page: Page) {
  await page.click(OPEN_BUTTON);
  await k.waitThread(page);
  await page.waitForTimeout(350);
}

export async function closeShell(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
}

const PILL =
  'form:has(#discussion-composer) button[aria-haspopup=menu][aria-label^="Tag"]';
const MENU = '[role=menu][aria-label="Tag a page"]';

/** The composer's page pill: its name, its words and its box. */
export function tagPill(page: Page) {
  return page.locator(PILL).evaluate((b) => {
    const r = b.getBoundingClientRect();
    return {
      label: b.getAttribute("aria-label"),
      text: b.textContent?.trim() ?? "",
      h: r.height,
      w: r.width,
    };
  });
}

/** Opens the page menu by pointer (or, with `keys`, from the focused pill). */
export async function openPicker(page: Page, keys = false) {
  if (keys) await page.keyboard.press("Enter");
  else await page.click(PILL);
  await page.waitForSelector(MENU);
}

/** The menu's rows: page name, heading hint, the open-now mark, ticked. */
export function pickerRows(page: Page) {
  return page.$$eval(`${MENU} [role=menuitemradio]`, (els) =>
    els.map((el) => ({
      text: el.querySelector("[data-page-label]")?.textContent?.trim() ?? "",
      hint: el.querySelector("[data-page-hint]")?.textContent?.trim() ?? null,
      open: el.querySelector("[data-open-now]") !== null,
      checked: el.getAttribute("aria-checked") === "true",
      h: el.getBoundingClientRect().height,
    })),
  );
}

/** Chooses a row by its page name — the last match, the in-order one. */
export async function pick(page: Page, text: string) {
  const rows = await pickerRows(page);
  const at = rows.map((r) => r.text).lastIndexOf(text);
  await page.locator(`${MENU} [role=menuitemradio]`).nth(at).click();
  await page.waitForSelector(MENU, { state: "detached" });
}

/** Escape closes the menu alone: the shell stays open. */
export async function escapeMenu(page: Page) {
  await page.keyboard.press("Escape");
  await page.waitForSelector(MENU, { state: "detached" });
  return (await page.locator("[role=dialog]").count()) === 1;
}

/** Each chip in the thread: its words, name, and whether it can be pressed. */
export function chips(page: Page) {
  return page.$$eval("[role=dialog] [data-page-chip]", (els) =>
    els.map((el) => ({
      page: el.getAttribute("data-page-chip"),
      text: el.textContent?.trim() ?? "",
      label: el.getAttribute("aria-label"),
      disabled: (el as HTMLButtonElement).disabled,
      h: el.getBoundingClientRect().height,
      comment: el.closest("article")?.id ?? null,
    })),
  );
}

const dock = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("span")]
        .map((s) => s.textContent ?? "")
        .find((t) => /^\d+(–\d+)? \/ \d+$/.test(t)) ?? null,
  );

/** Tabs forward until `match` holds focus (at most 40 presses). */
async function tabTo(page: Page, match: string) {
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate((m) => document.activeElement?.matches(m), match))
      return true;
    await page.keyboard.press("Tab");
  }
  return false;
}

export async function contentOf(k: Kit, issueId: string) {
  const [row] = await k.sql<{ content: { pages: { id: string }[] } }[]>`
    select content from issues where id = ${issueId}`;
  return row!.content;
}

export async function writePages(
  k: Kit,
  issueId: string,
  pages: { id: string }[],
) {
  const content = await contentOf(k, issueId);
  await k.sql`update issues set content = ${k.sql.json({ ...content, pages } as never)}
    where id = ${issueId}`;
}

export async function tagsGate(k: Kit, c: TagCast) {
  await mkdir(TAGS_OUT, { recursive: true });
  const n = c.issue.number!;
  const [, p2, p3, , p5] = c.pages;
  const size = { width: 1280, height: 860 };

  k.heading("tags — desktop: the page menu, keyboard only");
  const d = await tagReader(k, c.tess, n, size);
  await openShell(k, d.page);
  let pill = await tagPill(d.page);
  k.ok(
    pill.text === "Tag a page" && pill.label === "Tag a page",
    "the composer offers a “Tag a page” pill",
  );
  let f = await filterState(d.page);
  k.ok(
    f.toggle === "Filter and sort comments" && !f.on && f.count === "",
    "the funnel at the top, nothing filtered, no count",
  );
  await d.page.keyboard.press("Tab"); // off the panel, to the first control
  k.ok(await tabTo(d.page, "#discussion-composer"), "Tab reaches the box");
  await d.page.keyboard.type("check-304 about page three, read earlier");
  k.ok(
    await tabTo(d.page, 'button[aria-label="Tag a page"]'),
    "Tab reaches the page pill",
  );
  await openPicker(d.page, true);
  let rows = await pickerRows(d.page);
  k.ok(
    rows[0]?.text === "No page" &&
      rows[0].checked &&
      (await d.page.evaluate(
        () => document.activeElement?.getAttribute("aria-checked") === "true",
      )),
    "Enter opens it on “No page”, ticked and focused",
  );
  k.ok(
    rows
      .slice(1)
      .map((r) => r.text)
      .join(",") ===
      c.pages.map((_, i) => (i ? `Page ${i + 1}` : "The cover")).join(","),
    `then every page in order (${rows.length - 1}), no repeats this near the top`,
  );
  k.ok(
    rows[1]!.open &&
      rows.filter((r) => r.open).length === 1 &&
      rows.every((r) => r.h >= 44) &&
      rows.filter((r) => r.hint).length >= c.pages.length - 1,
    "the cover marked “open now”; 44px rows; headings as hints",
  );
  // No page, the cover, page 2, page 3.
  for (let i = 0; i < 3; i++) await d.page.keyboard.press("ArrowDown");
  await d.page.keyboard.press("Enter");
  await d.page.waitForSelector(MENU, { state: "detached" });
  pill = await tagPill(d.page);
  k.ok(
    pill.text === "Page 3" &&
      pill.label === "Tagged to page 3" &&
      (await d.page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      )) === "Tagged to page 3",
    "arrows and Enter choose page 3 — not open — and focus returns to the pill",
  );
  let before = await said(d.page);
  k.ok(
    await tabTo(d.page, "form:has(#discussion-composer) button[type=submit]"),
    "Tab reaches Post",
  );
  await d.page.keyboard.press("Enter");
  k.ok(
    await heard(d.page, "Your comment is posted.", before),
    "posted by keyboard",
  );
  const [row] = await k.sql<{ id: string; page_id: string | null }[]>`
    select id, page_id from comments where author_id = ${c.tess.id}
    order by created_at desc limit 1`;
  k.ok(row?.page_id === p3, "stored with page 3's id");
  const tessComment = row!.id;
  let list = await chips(d.page);
  const mine = list.find((x) => x.comment === `comment-${tessComment}`);
  k.ok(
    mine?.text === "Page 3" &&
      mine.label === "Go to page 3" &&
      !mine.disabled &&
      mine.h >= 44,
    `its chip reads “${mine?.text}”, named “${mine?.label}”, 44px`,
  );
  pill = await tagPill(d.page);
  k.ok(pill.text === "Tag a page", "the pill is back to “Tag a page”");
  await d.page.locator(`#comment-${tessComment} [data-page-chip]`).click();
  k.ok(
    (await dock(d.page))?.startsWith("2–3") &&
      (await d.page.locator("[role=dialog]").count()) === 1,
    "the chip turns from the cover to pages 2–3, the drawer open",
  );
  await openPicker(d.page);
  rows = await pickerRows(d.page);
  k.ok(
    rows[2]?.text === "Page 2" &&
      rows[3]?.text === "Page 3" &&
      rows[2].open &&
      rows[3].open &&
      rows.filter((r) => r.open).length === 2,
    "on the spread both pages are marked open now",
  );
  k.ok(
    await escapeMenu(d.page),
    "Escape closes the menu and leaves the drawer open",
  );
  await openShow(d.page);
  k.ok(
    (await showRows(d.page))[1] === "These pages",
    "the Show menu offers “These pages”",
  );
  await d.page.keyboard.press("Escape");
  await d.page.waitForSelector(SHOW_MENU, { state: "detached" });
  await closeShell(d.page);
  await d.ctx.close();

  k.heading("tags — desktop: another member's chip jumps there");
  const t = await tagReader(k, c.tom, n, size);
  await openShell(k, t.page);
  const chip = t.page.locator(`#comment-${tessComment} [data-page-chip]`);
  await chip.focus();
  before = await said(t.page);
  await t.page.keyboard.press("Enter");
  k.ok(
    await heard(t.page, "Now showing page 3.", before),
    "Enter on the chip announces “Now showing page 3.”",
  );
  k.ok((await dock(t.page))?.startsWith("2–3"), "the flipbook is at pages 2–3");
  k.ok(
    (await t.page.locator("[role=dialog]").count()) === 1 &&
      (await t.page.evaluate(
        () => document.activeElement?.getAttribute("data-page-chip") != null,
      )),
    "the drawer stays open, focus on the chip",
  );
  await openPicker(t.page);
  const marked = (await pickerRows(t.page)).filter((r) => r.open);
  k.ok(
    marked.map((r) => r.text).join(",") === "Page 2,Page 3",
    "its menu now marks pages 2 and 3 open",
  );
  await escapeMenu(t.page);

  k.heading("tags — desktop: Show → These pages, its count, the refetch");
  const asked = t.lists.length;
  await setFilter(t.page, true);
  f = await filterState(t.page);
  k.ok(
    t.lists.length === asked + 1 &&
      t.lists.at(-1)!.includes(`page=${p2}`) &&
      t.lists.at(-1)!.includes(`page=${p3}`),
    "choosing it asks the server for pages 2 and 3",
  );
  k.ok(
    f.on === true && f.count === "1 comment on these pages" && f.comments === 1,
    `the count reads “${f.count}” and one comment shows`,
  );
  await closeShell(t.page);
  await t.page.keyboard.press("ArrowRight");
  k.ok((await dock(t.page))?.startsWith("4–5"), "turned to pages 4–5");
  await openShell(k, t.page);
  await t.page.waitForTimeout(300);
  f = await filterState(t.page);
  k.ok(
    t.lists.at(-1)!.includes(`page=${p5}`) &&
      !t.lists.at(-1)!.includes(`page=${p3}`),
    "on the new spread it asks again, for pages 4 and 5",
  );
  k.ok(
    f.on === true && f.count === "1 comment on these pages" && f.comments === 1,
    `still on, “${f.count}” (the page-5 comment)`,
  );
  await setFilter(t.page, false);
  f = await filterState(t.page);
  k.ok(
    f.on === false && f.count === "" && f.comments >= 3,
    `Show → All: every comment (${f.comments}), no count`,
  );
  await closeShell(t.page);
  await t.ctx.close();

  k.heading("tags — admin: the chip and the filter behave the same");
  const a = await tagReader(k, c.ada, n, size);
  await openShell(k, a.page);
  await a.page.locator(`#comment-${tessComment} [data-page-chip]`).click();
  k.ok(
    (await dock(a.page))?.startsWith("2–3") &&
      (await a.page.locator("[role=dialog]").count()) === 1,
    "an admin's chip turns the book too, drawer open",
  );
  await setFilter(a.page, true);
  f = await filterState(a.page);
  k.ok(f.count === "1 comment on these pages", `and filters (“${f.count}”)`);
  await a.ctx.close();

  await phoneTags(k, c, tessComment);

  k.heading("tags — an overflow split renumbers; a deleted page is removed");
  const content = await contentOf(k, c.issue.id);
  const split = { ...content.pages[1]!, id: randomUUID() };
  await writePages(k, c.issue.id, [
    ...content.pages.slice(0, 2),
    split,
    ...content.pages.slice(2),
  ]);
  const r = await tagReader(k, c.tom, n, size);
  await openShell(k, r.page);
  list = await chips(r.page);
  let old = list.find((x) => x.page === p3);
  k.ok(
    old?.text === "Page 4" && old.label === "Go to page 4",
    `after a split before it, the old chip reads “${old?.text}”`,
  );
  await r.page.locator(`#comment-${tessComment} [data-page-chip]`).click();
  k.ok(
    (await dock(r.page))?.startsWith("4–5"),
    "and goes to page 4, where the page now is",
  );
  await r.ctx.close();
  const now = await contentOf(k, c.issue.id);
  await writePages(
    k,
    c.issue.id,
    now.pages.filter((p) => p.id !== p3),
  );
  const g = await tagReader(k, c.tom, n, size);
  await openShell(k, g.page);
  list = await chips(g.page);
  old = list.find((x) => x.page === p3);
  k.ok(
    old?.text === "Page removed" && old.disabled && old.label === null,
    "after the page is deleted, “Page removed”, disabled",
  );
  const at = await dock(g.page);
  await g.page
    .locator(`#comment-${tessComment} [data-page-chip]`)
    .click({ force: true });
  k.ok((await dock(g.page)) === at, "and pressing it goes nowhere");
  const [kept] =
    await k.sql`select page_id from comments where id = ${tessComment}`;
  k.ok(kept?.page_id === p3, "the comment keeps its tag (no cascade)");
  await g.ctx.close();

  k.heading("tags — a page the issue no longer has is refused");
  const x = await tagReader(k, c.tom, n, size);
  await x.page.keyboard.press("ArrowRight");
  await openShell(k, x.page);
  const gone = (await contentOf(k, c.issue.id)).pages;
  const doomed = gone[2]!.id;
  await writePages(
    k,
    c.issue.id,
    gone.filter((p) => p.id !== doomed),
  );
  await openPicker(x.page);
  await pick(x.page, "Page 3");
  await x.page.fill("#discussion-composer", "check-304 on a page just deleted");
  await x.page.click("form:has(#discussion-composer) button[type=submit]");
  const refusal = x.page.locator(
    "form:has(#discussion-composer) p[role=alert]",
  );
  await refusal.waitFor({ timeout: 15_000 });
  k.ok(
    (await refusal.textContent()) === "That page is no longer in this issue.",
    `the action refuses it: “${await refusal.textContent()}”`,
  );
  const [none] = await k.sql`select count(*)::int as n from comments
    where body = 'check-304 on a page just deleted'`;
  k.ok(none?.n === 0, "and nothing was stored");
  await x.ctx.close();

  await composerLook(k);
}
