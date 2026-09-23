// The discussion's dialogs (issue #301) under the shared dialog contract, for
// dev-dialog-a11y-gate.mts: the desktop drawer and the phone sheet (the gate's
// own checks — each is the only dialog open), then the report dialog and the
// delete confirmation, which open *inside* the drawer and so are checked here
// as the topmost of two: named, focused, trapped, everything else inert (the
// drawer included), and Escape or the backdrop closes only them, handing focus
// back to the button in the drawer. An admin's Delete confirmation (#302) gets
// the same checks in the drawer and the sheet. Its own check-301 rows (or
// GATE_PREFIX), removed before it returns.
import type { Page } from "playwright";
import type postgres from "postgres";
import { discussionKit, type Kit } from "./discussion-gate-kit.mts";

type Deps = {
  page: Page;
  sql: postgres.Sql;
  base: string;
  heading: (name: string) => void;
  checkOpenDialog: (page: Page, name: string) => Promise<void>;
  checkEscapeRestores: (page: Page, trigger: string) => Promise<void>;
  checkBackdropRestores: (page: Page, trigger: string) => Promise<void>;
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// The topmost dialog: the last in the document, i.e. the one opened inside.
const top = (page: Page) =>
  page.evaluate((selector) => {
    const dialogs = document.querySelectorAll<HTMLElement>("[role=dialog]");
    const panel = dialogs[dialogs.length - 1]!;
    const overlay = panel.parentElement!;
    const label = document.getElementById(
      panel.getAttribute("aria-labelledby") ?? "",
    );
    const leaked = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter(
        (el) =>
          !overlay.contains(el) &&
          el.getClientRects().length > 0 &&
          el.closest("[inert]") == null,
      )
      .map((el) =>
        (el.getAttribute("aria-label") ?? el.textContent ?? "")
          .trim()
          .slice(0, 30),
      );
    return {
      count: dialogs.length,
      modal: panel.getAttribute("aria-modal"),
      name: label?.textContent?.trim(),
      heading: label?.tagName.toLowerCase(),
      focusInside: panel.contains(document.activeElement),
      leaked,
      focusables: Array.from(
        panel.querySelectorAll<HTMLElement>(selector),
      ).filter((el) => el.getClientRects().length > 0).length,
    };
  }, FOCUSABLE);

const inTop = (page: Page) =>
  page.evaluate(() => {
    const dialogs = document.querySelectorAll("[role=dialog]");
    return dialogs[dialogs.length - 1]!.contains(document.activeElement);
  });

const focused = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");

async function checkNested(k: Kit, page: Page, name: string) {
  const s = await top(page);
  k.ok(s.count === 2, `it opens over the discussion (${s.count} dialogs)`);
  k.ok(
    s.modal === "true" && s.heading === "h2" && s.name === name,
    `a modal named by its heading “${name}”`,
  );
  k.ok(s.focusInside, "focus starts inside it");
  k.ok(
    s.leaked.length === 0,
    `everything else is inert, the discussion included${s.leaked.length ? ` — reachable: ${s.leaked.join(", ")}` : ""}`,
  );
  let escaped = false;
  for (let i = 0; i <= s.focusables; i++) {
    await page.keyboard.press("Tab");
    if (!(await inTop(page))) escaped = true;
  }
  k.ok(!escaped, `Tab stays inside it (${s.focusables + 1} presses)`);
  await page.keyboard.press("Shift+Tab");
  k.ok(await inTop(page), "and so does Shift+Tab");
}

async function closesToTrigger(
  k: Kit,
  page: Page,
  how: "Escape" | "backdrop",
  trigger: string,
) {
  if (how === "Escape") await page.keyboard.press("Escape");
  else await page.mouse.click(8, 8);
  await page.waitForFunction(
    () => document.querySelectorAll("[role=dialog]").length === 1,
  );
  k.ok(true, `${how} closes it and leaves the discussion open`);
  const landed = await focused(page);
  k.ok(landed === trigger, `focus is back on “${trigger}” (${landed})`);
}

// Escape inside an inline box cancels only that box, putting focus back on
// its comment; the drawer stays open.
async function escapeCancels(
  k: Kit,
  page: Page,
  opener: string,
  comment: string,
) {
  await page.click(`[role=dialog] button[aria-label="${opener}"]`);
  const box = page.locator("[role=dialog] form[data-owns-escape] textarea");
  await box.waitFor();
  await box.fill("check-301 words to throw away");
  await page.keyboard.press("Escape");
  await box.waitFor({ state: "detached" });
  k.ok(true, `Escape in the “${opener}” box cancels it`);
  await page
    .waitForFunction(
      (want) => document.activeElement?.getAttribute("aria-label") === want,
      comment,
      { timeout: 2000 },
    )
    .catch(() => {});
  k.ok(
    (await focused(page)) === comment,
    `focus lands on the comment (${await focused(page)})`,
  );
  k.ok(await page.isVisible("[role=dialog]"), "the drawer is still open");
}

export async function checkDiscussionDialogs(d: Deps) {
  const browser = d.page.context().browser()!;
  const k = discussionKit({
    sql: d.sql,
    base: d.base,
    browser,
    out: ".data/discussion-review",
  });
  try {
    const reader = await k.member("dialogs-reader", { name: "Dee Reader" });
    const readerName = await k.name(reader.id, "Dee Reader");
    const admin = await k.member("dialogs-admin", {
      admin: true,
      name: "Fay Admin",
    });
    const author = await k.member("dialogs-author", { name: "Eve Author" });
    const authorName = await k.name(author.id, "Eve Author");
    const issue = await k.issue(true, 50);
    await k.comment(issue.id, author, authorName, "check-301 words to report");
    await k.comment(issue.id, reader, readerName, "check-301 my own words");
    const title = `Discussion · Issue ${issue.number}`;

    d.heading("Discussion drawer — desktop");
    let r = await k.reader(reader, issue.number!);
    const dock = "[data-discussion-button]";
    await r.page.click(dock);
    await k.waitThread(r.page);
    await d.checkOpenDialog(r.page, title);
    await d.checkEscapeRestores(r.page, "Discussion");
    await r.page.click(dock);
    await k.waitThread(r.page);
    await d.checkBackdropRestores(r.page, "Discussion");

    d.heading("Report dialog — over the drawer");
    await r.page.click(dock);
    await k.waitThread(r.page);
    const report = "Report Eve Author’s comment";
    await r.page.click(`button[aria-label="${report}"]`);
    await r.page.waitForSelector("[role=dialog] [role=dialog]");
    await checkNested(k, r.page, "Report this comment");
    await closesToTrigger(k, r.page, "Escape", report);
    await r.page.click(`button[aria-label="${report}"]`);
    await r.page.waitForSelector("[role=dialog] [role=dialog]");
    await closesToTrigger(k, r.page, "backdrop", report);

    d.heading("ConfirmDialog — deleting your comment, over the drawer");
    const del = "Delete your comment";
    await r.page.click(`button[aria-label="${del}"]`);
    await r.page.waitForSelector("[role=dialog] [role=dialog]");
    await checkNested(k, r.page, "Delete your comment?");
    await closesToTrigger(k, r.page, "Escape", del);

    d.heading("Discussion drawer — Escape in the edit and reply boxes");
    await escapeCancels(
      k,
      r.page,
      "Edit your comment",
      "Comment by Dee Reader",
    );
    await escapeCancels(
      k,
      r.page,
      "Reply to Eve Author’s comment",
      "Comment by Eve Author",
    );
    await r.page.keyboard.press("Escape");
    await r.page.waitForSelector("[role=dialog]", { state: "detached" });
    k.ok(true, "a second Escape closes the drawer");
    await r.ctx.close();

    d.heading("ConfirmDialog — an admin deleting a comment, over the drawer");
    const moderate = "Delete Eve Author’s comment";
    r = await k.reader(admin, issue.number!, { query: "?discussion=1" });
    await k.waitThread(r.page);
    await r.page.click(`button[aria-label="${moderate}"]`);
    await r.page.waitForSelector("[role=dialog] [role=dialog]");
    await checkNested(k, r.page, "Delete this comment?");
    await closesToTrigger(k, r.page, "Escape", moderate);
    await r.page.click(`button[aria-label="${moderate}"]`);
    await r.page.waitForSelector("[role=dialog] [role=dialog]");
    await closesToTrigger(k, r.page, "backdrop", moderate);
    await r.ctx.close();

    d.heading("ConfirmDialog — an admin deleting a comment, over the sheet");
    r = await k.reader(admin, issue.number!, {
      width: 390,
      height: 844,
      query: "?discussion=1",
    });
    await k.waitThread(r.page);
    await r.page.waitForTimeout(350);
    await r.page.click(`button[aria-label="${moderate}"]`);
    await r.page.waitForSelector("[role=dialog] [role=dialog]");
    await checkNested(k, r.page, "Delete this comment?");
    await closesToTrigger(k, r.page, "Escape", moderate);
    await r.ctx.close();

    d.heading("Discussion sheet — phone");
    r = await k.reader(reader, issue.number!, { width: 390, height: 844 });
    const fab = "[data-discussion-button]";
    await r.page.click(fab);
    await k.waitThread(r.page);
    await d.checkOpenDialog(r.page, title);
    const fabLabel = (await r.page.getAttribute(fab, "aria-label"))!;
    await d.checkEscapeRestores(r.page, fabLabel);
    await r.page.click(fab);
    await k.waitThread(r.page);
    await r.page.waitForTimeout(350);
    await d.checkBackdropRestores(r.page, fabLabel);
    await r.page.click(fab);
    await k.waitThread(r.page);
    await r.page.click(`button[aria-label="${report}"]`);
    await r.page.waitForSelector("[role=dialog] [role=dialog]");
    d.heading("Report dialog — over the sheet");
    await checkNested(k, r.page, "Report this comment");
    await closesToTrigger(k, r.page, "Escape", report);
    await r.ctx.close();
  } finally {
    const left = await k.cleanup();
    if (left !== 0) throw new Error(`${k.prefix} rows left behind: ${left}`);
    if (k.failures() > 0)
      throw new Error(`FAIL: ${k.failures()} discussion dialog check(s)`);
  }
}
