// dev-discussion-gate.mts, page tags (issue #304): the open page(s) each
// reader exposes, the composer's checkbox and radio group, a tagged post's
// chip and where it goes (the drawer staying open on a computer, the sheet
// closing onto the section on a phone), keyboard only, "This page only" with
// its count and its refetch when the page changes, an overflow split
// renumbering the chip, a deleted page's "Page removed", and a page_id the
// issue no longer has refused through the action. The phone half lives in
// discussion-gate-tags-phone.mts.
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
import { phoneTags } from "./discussion-gate-tags-phone.mts";

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

/** The composer's page tag as it stands: the checkbox, or the radio group. */
export function tagControl(page: Page) {
  return page.evaluate(() => {
    const form = document
      .querySelector("#discussion-composer")
      ?.closest("form");
    const fieldset = form?.querySelector("fieldset");
    if (fieldset) {
      return {
        kind: "radios" as const,
        legend: fieldset.querySelector("legend")?.textContent?.trim() ?? "",
        choices: [...fieldset.querySelectorAll("label")].map((l) => ({
          text: l.textContent?.trim() ?? "",
          checked: l.querySelector("input")!.checked,
          h: l.getBoundingClientRect().height,
        })),
      };
    }
    const box = [...(form?.querySelectorAll("label") ?? [])].find((l) =>
      l.textContent?.trim().startsWith("Tag "),
    );
    return box
      ? {
          kind: "checkbox" as const,
          text: box.textContent?.trim() ?? "",
          checked: box.querySelector("input")!.checked,
          h: box.getBoundingClientRect().height,
        }
      : null;
  });
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

export function filterState(page: Page) {
  return page.evaluate(() => {
    const count = document.querySelector("[role=dialog] [data-page-count]");
    const box = count?.parentElement?.querySelector("label");
    return {
      label: box?.textContent?.trim() ?? null,
      on: box?.querySelector("input")?.checked ?? null,
      count: count?.textContent?.trim() ?? null,
      comments: document.querySelectorAll(
        '[role=dialog] article[aria-label^="Comment by"]',
      ).length,
    };
  });
}

/** Ticks or unticks the filter and waits for the list it asks for. */
export async function setFilter(page: Page, on: boolean) {
  const box = page.locator("[role=dialog] label:has-text('only') input");
  if ((await box.isChecked()) === on) return;
  await Promise.all([
    page.waitForResponse((r) => /\/comments/.test(r.url())),
    box.click(),
  ]);
  await page.waitForTimeout(150);
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

async function contentOf(k: Kit, issueId: string) {
  const [row] = await k.sql<{ content: { pages: { id: string }[] } }[]>`
    select content from issues where id = ${issueId}`;
  return row!.content;
}

async function writePages(k: Kit, issueId: string, pages: { id: string }[]) {
  const content = await contentOf(k, issueId);
  await k.sql`update issues set content = ${k.sql.json({ ...content, pages } as never)}
    where id = ${issueId}`;
}

export async function tagsGate(k: Kit, c: TagCast) {
  await mkdir(TAGS_OUT, { recursive: true });
  const n = c.issue.number!;
  const [, p2, p3, , p5] = c.pages;
  const size = { width: 1280, height: 860 };

  k.heading("tags — desktop: the cover, then a spread, keyboard only");
  const d = await tagReader(k, c.tess, n, size);
  await openShell(k, d.page);
  let tag = await tagControl(d.page);
  k.ok(
    tag?.kind === "checkbox" &&
      tag.text === "Tag the cover" &&
      !tag.checked &&
      tag.h >= 44,
    `on the cover, one checkbox “${tag && "text" in tag ? tag.text : "?"}”, off, 44px`,
  );
  let f = await filterState(d.page);
  k.ok(
    f.label === "This page only" && f.on === false && f.count === "",
    "“This page only” at the top, off, with no count",
  );
  await closeShell(d.page);
  await d.page.keyboard.press("ArrowRight");
  k.ok((await dock(d.page))?.startsWith("2–3"), "turned to pages 2–3");
  await d.page.focus(OPEN_BUTTON);
  await d.page.keyboard.press("Enter");
  await k.waitThread(d.page);
  tag = await tagControl(d.page);
  k.ok(
    tag?.kind === "radios" &&
      tag.legend === "Tag a page" &&
      tag.choices.map((x) => x.text).join(" · ") === "None · Page 2 · Page 3" &&
      tag.choices[0]!.checked &&
      tag.choices.every((x) => x.h >= 44),
    "on a spread, a fieldset “Tag a page”: None · Page 2 · Page 3, None chosen, 44px each",
  );
  f = await filterState(d.page);
  k.ok(f.label === "These pages only", "the filter reads “These pages only”");

  await d.page.keyboard.press("Tab"); // off the panel, to the first control
  k.ok(await tabTo(d.page, "#discussion-composer"), "Tab reaches the box");
  await d.page.keyboard.type("check-304 about page three");
  k.ok(
    await tabTo(d.page, "fieldset input:checked"),
    "Tab reaches the radio group, on None",
  );
  await d.page.keyboard.press("ArrowRight");
  await d.page.keyboard.press("ArrowRight");
  tag = await tagControl(d.page);
  k.ok(
    tag?.kind === "radios" && tag.choices[2]!.checked,
    "the arrow keys choose Page 3",
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
  tag = await tagControl(d.page);
  k.ok(
    tag?.kind === "radios" && tag.choices[2]!.checked,
    "the choice to tag stays for the next post",
  );
  await d.page
    .locator("form:has(#discussion-composer) fieldset")
    .scrollIntoViewIfNeeded();
  await d.page.screenshot({ path: `${TAGS_OUT}/desktop-radios-chip.png` });
  await closeShell(d.page);
  await openShell(k, d.page);
  tag = await tagControl(d.page);
  k.ok(
    tag?.kind === "radios" && tag.choices[2]!.checked,
    "and across closing and reopening",
  );
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
  tag = await tagControl(t.page);
  k.ok(
    tag?.kind === "radios" &&
      tag.choices.map((x) => x.text).join(" · ") === "None · Page 2 · Page 3",
    "and its composer now offers pages 2 and 3",
  );

  k.heading("tags — desktop: “These pages only”, its count, the refetch");
  const asked = t.lists.length;
  await setFilter(t.page, true);
  f = await filterState(t.page);
  k.ok(
    t.lists.length === asked + 1 &&
      t.lists.at(-1)!.includes(`page=${p2}`) &&
      t.lists.at(-1)!.includes(`page=${p3}`),
    "ticking it asks the server for pages 2 and 3",
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
    `unticked: every comment (${f.comments}), no count`,
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
  await x.page.locator("fieldset label:nth-of-type(3) input").check();
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
}
