// dev-discussion-gate.mts, the thread's filter panel: the funnel in the header
// and its changed-count, the search over words and names (marks, replies
// opened by a match, Escape clearing it), the three orders, "My comments",
// one chosen page asked of the server, Show all, a post or an edit the view
// would hide clearing it, the view surviving a close, and the phone sheet's
// fit, with the keyboard up too.
import type { Page } from "playwright";
import type { Issue, Kit, Member } from "./discussion-gate-kit.mts";
import { heard, said } from "./discussion-gate-desktop.mts";
import {
  FILTER_TOGGLE,
  chooseShow,
  filterState,
} from "./discussion-gate-filter-kit.mts";
import {
  TAGS_OUT,
  closeShell,
  openShell,
  tagReader,
} from "./discussion-gate-tags.mts";

export type FilterCast = {
  issue: Issue;
  /** The issue's page ids, in order. */
  pages: string[];
  fay: Member;
  /** Top-level comments, oldest first; the second has the replies. */
  tops: [string, string, string];
  /** Fay's reply under the second, the one that says "roses". */
  fayReply: string;
};

const SEARCH = "#discussion-filters input[type=search]";

/** The top-level comments listed, in order, by id. */
const order = (page: Page) =>
  page.$$eval("[role=dialog] ol[aria-label=Comments] > li > article", (els) =>
    els.map((el) => el.id.replace(/^comment-/, "")),
  );

async function sort(page: Page, label: string) {
  await page
    .locator("#discussion-filters button[aria-haspopup=menu]", {
      hasText: "Sort:",
    })
    .click();
  await page
    .locator('[role=menu][aria-label="Sort"] [role=menuitemradio]', {
      hasText: label,
    })
    .click();
  await page.waitForTimeout(100);
}

export async function filterGate(k: Kit, c: FilterCast) {
  const n = c.issue.number!;
  const [c1, c2, c3] = c.tops;
  const same = (a: string[], b: string[]) => a.join() === b.join();

  k.heading("filter — the funnel, search, sort, show");
  const d = await tagReader(k, c.fay, n, { width: 1280, height: 860 });
  await openShell(k, d.page);
  const toggle = d.page.locator(FILTER_TOGGLE);
  const shut = await d.page.evaluate(() => ({
    hidden: document.getElementById("discussion-filters")?.hidden,
    badge: document.querySelector("[data-filter-badge]") !== null,
  }));
  k.ok(
    (await toggle.getAttribute("aria-expanded")) === "false" &&
      shut.hidden === true &&
      !shut.badge,
    "the funnel starts shut, the panel hidden, no badge",
  );
  k.ok(same(await order(d.page), [c1, c2, c3]), "oldest first by default");
  const box = await toggle.boundingBox();
  k.ok(
    box !== null && box.width >= 44 && box.height >= 44,
    `the funnel is a 44px target (${box?.width}×${box?.height})`,
  );

  await toggle.click();
  k.ok(
    (await toggle.getAttribute("aria-expanded")) === "true" &&
      (await d.page.locator(SEARCH).isVisible()),
    "pressing it opens the panel",
  );
  await d.page.fill(SEARCH, "ROSES");
  await d.page.waitForTimeout(100);
  let f = await filterState(d.page);
  const marks = await d.page.$$eval("[role=dialog] article mark", (els) =>
    els.map((el) => el.textContent),
  );
  k.ok(
    same(await order(d.page), [c1, c2]) &&
      f.count === "2 comments matching “ROSES”",
    `a search keeps the comments it is in, case-blind: “${f.count}”`,
  );
  k.ok(
    (await d.page.locator(`#comment-${c.fayReply}`).isVisible()) &&
      marks.length === 2 &&
      marks.every((m) => m === "roses"),
    `the reply that matched is opened, each match marked (${marks.join(", ")})`,
  );
  k.ok(
    f.toggle === "Filter and sort comments, 1 changed" &&
      (await d.page.textContent("[data-filter-badge]")) === "1",
    "the funnel says one setting is changed",
  );
  await d.page.fill(SEARCH, "Fay Finder");
  await d.page.waitForTimeout(100);
  k.ok(
    same(await order(d.page), [c2, c3]) &&
      (await d.page
        .locator("[role=dialog] article mark")
        .first()
        .textContent()) === "Fay Finder",
    "a name finds its comments (and the thread a reply of theirs is in), marked",
  );
  await d.page.keyboard.press("Tab");
  k.ok(
    (await k.activeLabel(d.page)) === "Clear the search",
    "Tab moves on to Clear the search",
  );
  await d.page.keyboard.press("Enter");
  k.ok(
    (await d.page.inputValue(SEARCH)) === "" &&
      (await d.page.evaluate(
        () => (document.activeElement as HTMLInputElement | null)?.type,
      )) === "search",
    "pressing it empties the box and puts focus back in it",
  );
  await d.page.fill(SEARCH, "roses");
  await d.page.keyboard.press("Tab");
  await d.page.keyboard.press("Escape");
  await d.page.waitForTimeout(100);
  k.ok(
    (await d.page.inputValue(SEARCH)) === "" &&
      (await d.page.locator("[role=dialog]").count()) === 1,
    "Escape on the clear button clears too, the drawer stays",
  );
  await d.page.fill(SEARCH, "roses");
  await d.page.focus(SEARCH);
  await d.page.keyboard.press("Escape");
  await d.page.waitForTimeout(100);
  f = await filterState(d.page);
  k.ok(
    (await d.page.inputValue(SEARCH)) === "" &&
      (await d.page.locator("[role=dialog]").count()) === 1 &&
      f.count === "" &&
      f.comments === 3,
    "Escape in the search clears it and leaves the drawer open",
  );

  await sort(d.page, "Newest first");
  k.ok(same(await order(d.page), [c3, c2, c1]), "Newest first reverses it");
  await sort(d.page, "Most replies");
  k.ok(same(await order(d.page), [c2, c1, c3]), "Most replies leads with c2");

  await chooseShow(d.page, "My comments", false);
  f = await filterState(d.page);
  k.ok(
    same(await order(d.page), [c2, c3]) && f.count === "2 comments by you",
    `My comments: her own and the one she replied under (“${f.count}”)`,
  );
  const asked = d.lists.length;
  await chooseShow(d.page, "Page 2");
  f = await filterState(d.page);
  k.ok(
    d.lists.length === asked + 1 &&
      d.lists.at(-1)!.includes(`page=${c.pages[1]}`) &&
      f.show === "Show: Page 2" &&
      f.count === "1 comment on page 2" &&
      same(await order(d.page), [c1]),
    `Show → Page 2 asks the server for it: “${f.count}”`,
  );
  await d.page.screenshot({ path: `${TAGS_OUT}/filter-desktop.png` });
  await d.page.getByRole("button", { name: "Show all" }).click();
  await d.page.waitForTimeout(300);
  f = await filterState(d.page);
  k.ok(
    f.show === "Show: All" &&
      f.count === "" &&
      (await d.page.evaluate(
        () =>
          document.activeElement?.getAttribute("aria-controls") ===
          "discussion-filters",
      )),
    "Show all brings every comment back and focus to the funnel",
  );

  k.heading("filter — a post the view would hide clears it");
  await d.page.fill(SEARCH, "nothing-here-xyz");
  await d.page.waitForTimeout(100);
  f = await filterState(d.page);
  k.ok(
    f.count === "No comments matching “nothing-here-xyz”" && f.comments === 0,
    `nothing matches: “${f.count}”`,
  );
  await d.page.fill("#discussion-composer", "check-filter a fresh comment");
  const before = await said(d.page);
  await d.page.click("form:has(#discussion-composer) button[type=submit]");
  k.ok(
    await heard(
      d.page,
      "Your comment is posted. Showing every comment.",
      before,
    ),
    "posting says the filter is cleared",
  );
  f = await filterState(d.page);
  k.ok(
    (await d.page.inputValue(SEARCH)) === "" && f.comments === 4,
    "the search is empty and all four comments show",
  );

  k.heading("filter — an edit the search no longer finds clears it");
  await d.page.fill(SEARCH, "own note");
  await d.page.waitForTimeout(100);
  await d.page.locator(`#comment-${c3} button`, { hasText: "Edit" }).click();
  await d.page.fill(`#edit-${c3}`, "check-filter different words now");
  const edited = await said(d.page);
  await d.page.locator(`#comment-${c3} button`, { hasText: "Save" }).click();
  k.ok(
    await heard(
      d.page,
      "Your comment is updated. Showing every comment.",
      edited,
    ),
    "saving says the search is cleared",
  );
  k.ok(
    (await d.page.inputValue(SEARCH)) === "" &&
      (await d.page.evaluate(
        (id) => document.activeElement?.id === `comment-${id}`,
        c3,
      )),
    "the box is empty and focus is on the edited comment",
  );
  await closeShell(d.page);
  await openShell(k, d.page);
  f = await filterState(d.page);
  k.ok(
    f.toggle === "Filter and sort comments, 1 changed" &&
      (await order(d.page))[0] === c2,
    "the order survives closing (Most replies, the badge still on)",
  );
  await d.ctx.close();

  k.heading("filter — phone");
  const m = await tagReader(k, c.fay, n, { width: 360, height: 740 });
  await openShell(k, m.page);
  const list = "[role=dialog] .overflow-y-auto:has(ol[aria-label=Comments])";
  await m.page.$eval(list, (el) => el.scrollTo({ top: el.scrollHeight }));
  await m.page.click(FILTER_TOGGLE);
  k.ok(
    (await m.page.$eval(list, (el) => el.scrollTop)) === 0 &&
      (await m.page.locator(SEARCH).isVisible()),
    "in the sheet the funnel scrolls the list up to the panel",
  );
  await m.page
    .locator("#discussion-filters button[aria-haspopup=menu]", {
      hasText: "Show:",
    })
    .click();
  await m.page.waitForTimeout(200);
  const menuFits = await m.page.evaluate((sel) => {
    const menu = document
      .querySelector('[role=menu][aria-label="Show"]')!
      .getBoundingClientRect();
    const box = document.querySelector(sel)!.getBoundingClientRect();
    return menu.top >= box.top - 0.5 && menu.bottom <= box.bottom + 0.5;
  }, list);
  k.ok(menuFits, "the Show menu opens whole inside the list, not clipped");
  await m.page.keyboard.press("Escape");
  await m.page.$eval(list, (el) => el.scrollTo({ top: 0 }));
  await m.page.fill(SEARCH, "roses");
  await m.page.waitForTimeout(150);
  const fit = await m.page.evaluate(() => {
    const panel = document
      .querySelector("[role=dialog]")!
      .getBoundingClientRect();
    const boxes = [
      ...document.querySelectorAll(
        '#discussion-filters button:not([aria-label="Clear the search"]), #discussion-filters [role=group] > div:first-child, [aria-controls="discussion-filters"], [aria-label="Close discussion"]',
      ),
    ].map((el) => el.getBoundingClientRect());
    // The clear button is 36px in the 44px box; its hit area reaches 4px out.
    const clear = document
      .querySelector('[aria-label="Clear the search"]')!
      .getBoundingClientRect();
    const hit = document.elementFromPoint(
      clear.left + clear.width / 2,
      clear.top - 3,
    );
    return {
      inside: boxes.every(
        (r) => r.left >= panel.left - 0.5 && r.right <= panel.right + 0.5,
      ),
      short: boxes.filter((r) => r.height < 44).length,
      heights: boxes.map((r) => Math.round(r.height)).join(","),
      clearHit: hit?.getAttribute("aria-label") === "Clear the search",
    };
  });
  k.ok(fit.inside, "at 360px every control stays inside the sheet");
  k.ok(fit.short === 0, `and each is 44px tall (${fit.heights})`);
  k.ok(fit.clearHit, "the clear button answers a press just above it");
  await m.page.screenshot({ path: `${TAGS_OUT}/filter-phone-360.png` });

  // The keyboard up (the visual viewport shrinks, as in the mobile gate): the
  // panel scrolls with the list, so the box being typed in and Post both show.
  await m.page.focus(SEARCH);
  const keyboardTop = Math.round(740 * 0.52);
  await m.page.setViewportSize({ width: 360, height: keyboardTop });
  await m.page.waitForTimeout(300);
  const up = await m.page.evaluate(() => {
    const [search, post] = [
      "#discussion-filters input[type=search]",
      "form:has(#discussion-composer) button[type=submit]",
    ].map((sel) => document.querySelector(sel)!.getBoundingClientRect());
    return {
      search: search!.top >= 0 && search!.bottom <= innerHeight,
      post: post!.bottom <= innerHeight + 1,
      h: innerHeight,
    };
  });
  k.ok(
    up.search && up.post,
    `with the keyboard up the search box and Post both show (${up.h}px)`,
  );
  await m.page.keyboard.press("Enter");
  k.ok(
    await m.page.evaluate(
      () => document.activeElement?.hasAttribute("data-thread-count") ?? false,
    ),
    "Enter in the search puts the keyboard away onto the status line",
  );
  await m.page.screenshot({ path: `${TAGS_OUT}/filter-phone-keyboard.png` });
  await m.ctx.close();
}
