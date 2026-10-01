// dev-discussion-gate.mts, page tags on a phone (issue #304): the open page
// follows the scroll (the menu's "open now" row) and holds still while the
// sheet is up, a chip closing the sheet onto its section with focus there,
// and Show → This page asking again after a scroll. Screen-reader names are
// read from the accessibility tree.
import type { Page } from "playwright";
import type { Kit } from "./discussion-gate-kit.mts";
import { heard, said } from "./discussion-gate-desktop.mts";
import {
  TAGS_OUT,
  chips,
  closeShell,
  escapeMenu,
  openPicker,
  openShell,
  pick,
  pickerRows,
  tagPill,
  tagReader,
  type TagCast,
} from "./discussion-gate-tags.mts";
import { filterState, setFilter } from "./discussion-gate-filter-kit.mts";

/** Scrolls the column so a page's section starts at the top. */
async function scrollToPage(page: Page, pageId: string) {
  await page.evaluate((id) => {
    document.querySelector(`[data-reader-page="${id}"]`)!.scrollIntoView();
  }, pageId);
  await page.waitForTimeout(250);
}

/** The page(s) the menu marks open now; Escape closes the menu after. */
async function openNow(page: Page) {
  await openPicker(page);
  const rows = await pickerRows(page);
  // Escape closes the menu alone; were the sheet to go too, nothing matches.
  if (!(await escapeMenu(page))) return "the sheet closed";
  return [...new Set(rows.filter((r) => r.open).map((r) => r.text))].join();
}

export async function phoneTags(k: Kit, c: TagCast, tessComment: string) {
  const [, , p3, , p5] = c.pages;
  const size = { width: 390, height: 844 };
  k.heading("tags — phone 390×844: the current page follows the scroll");
  // Full motion: the landing is a smooth scroll.
  const m = await tagReader(k, c.tom, c.issue.number!, size, false);
  const { page } = m;
  await openShell(k, page);
  k.ok(
    (await openNow(page)) === "The cover",
    "at the top, the menu marks the cover open now (and Escape leaves the sheet up)",
  );
  await closeShell(page);
  await scrollToPage(page, p3!);
  await openShell(k, page);
  k.ok(
    (await openNow(page)) === "Page 3",
    "scrolled to page 3: page 3 is open now",
  );
  await closeShell(page);
  await scrollToPage(page, p5!);
  await openShell(k, page);
  k.ok((await openNow(page)) === "Page 5", "scrolled on: page 5");
  const moved = await page.evaluate(async () => {
    const from = window.scrollY;
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
    return from !== window.scrollY;
  });
  k.ok(
    moved && (await openNow(page)) === "Page 5",
    "the column moving under the open sheet changes nothing",
  );
  await closeShell(page);
  await scrollToPage(page, p5!);

  k.heading("tags — phone: a tagged post, and a chip that lands on its page");
  await openShell(k, page);
  await openPicker(page);
  await pick(page, "Page 5");
  k.ok((await tagPill(page)).text === "Page 5", "the pill reads “Page 5”");
  await page.fill("#discussion-composer", "check-304 from a phone on page 5");
  const before = await said(page);
  await page.click("form:has(#discussion-composer) button[type=submit]");
  k.ok(await heard(page, "Your comment is posted.", before), "posted");
  const posted = (await chips(page)).filter((x) => x.text === "Page 5");
  k.ok(posted.length === 2, "its chip reads “Page 5” (beside Ada's)");
  const tree = await k.shell(page).ariaSnapshot();
  k.ok(
    tree.includes('button "Tag a page"') &&
      tree.includes('button "Go to page 3"') &&
      tree.includes('button "Filter and sort comments"'),
    "a screen reader hears “Tag a page” (reset), “Go to page 3”, “Filter and sort comments”",
  );
  await page.locator(`#comment-${tessComment} [data-page-chip]`).click();
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  await page
    .waitForFunction(
      (id) => {
        const el = document.querySelector(`[data-reader-page="${id}"]`);
        return Math.abs(el!.getBoundingClientRect().top) <= 2;
      },
      p3!,
      { timeout: 5000 },
    )
    .catch(() => {});
  const landed = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      page: el?.getAttribute("data-reader-page") ?? null,
      role: el?.getAttribute("role") ?? null,
      name: el?.getAttribute("aria-label") ?? null,
      top: Math.round(el?.getBoundingClientRect().top ?? -1),
      locked: getComputedStyle(document.documentElement).overflow === "hidden",
      address: location.search,
    };
  });
  k.ok(!landed.locked, "the chip closes the sheet and unlocks the column");
  k.ok(
    landed.page === p3 && landed.role === "group" && landed.name === "Page 3",
    `focus lands on the section, heard as “${landed.name}, group”`,
  );
  k.ok(
    Math.abs(landed.top) <= 2,
    `scrolled so it starts at the top (${landed.top}px)`,
  );
  k.ok(
    !landed.address.includes("discussion"),
    "the address is the plain reader again",
  );

  k.heading("tags — phone: Show → This page, and again after a scroll");
  await openShell(k, page);
  k.ok(
    (await openNow(page)) === "Page 3",
    "the landing made page 3 the open page",
  );
  await setFilter(page, true);
  let f = await filterState(page);
  k.ok(
    f.count === "1 comment on this page" && f.comments === 1,
    `This page: “${f.count}”`,
  );
  await openPicker(page);
  await pick(page, "Page 3");
  await page.screenshot({ path: `${TAGS_OUT}/phone-390-filter.png` });
  await openPicker(page);
  await pick(page, "No page");
  await closeShell(page);
  await scrollToPage(page, p5!);
  const asked = m.lists.length;
  await openShell(k, page);
  await page.waitForTimeout(300);
  f = await filterState(page);
  k.ok(
    m.lists.length > asked && m.lists.at(-1)!.includes(`page=${p5}`),
    "reopened on page 5, it asks for page 5",
  );
  k.ok(
    f.on === true && f.count === "2 comments on this page" && f.comments === 2,
    `still on: “${f.count}”`,
  );
  await setFilter(page, false);
  await closeShell(page);
  await m.ctx.close();
}
