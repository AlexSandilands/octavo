// dev-discussion-gate.mts, desktop half (issue #301): the drawer by mouse and
// by keyboard, every write, posting as each of two names, the admin's read,
// the badge, the first post that brings its own name, and the rate limit.
import type { Page } from "playwright";
import type { Issue, Kit, Member } from "./discussion-gate-kit.mts";

export type Cast = {
  issue: Issue;
  alice: Member;
  aliceNames: [string, string];
  carol: Member;
  ada: Member;
  adaName: string;
  adaComment: string;
};

const spreadBox = (page: Page) =>
  page.evaluate(() => {
    const r = document
      .querySelector("[data-reader-block]")
      ?.getBoundingClientRect();
    return r ? `${r.x},${r.y},${r.width},${r.height}` : null;
  });

const dockLabel = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("span")]
        .map((s) => s.textContent ?? "")
        .find((t) => /^\d+(–\d+)? \/ \d+$/.test(t)) ?? null,
  );

const said = (page: Page) =>
  page.locator("[role=dialog] p[aria-live=polite]").first().textContent();

// The thread's live region, as a screen reader would hear it. Repeating a
// sentence changes the text (a trailing space toggles), so `before` — what it
// said before the action — tells a new announcement from the last one.
async function heard(page: Page, text: string, before?: string | null) {
  try {
    await page.waitForFunction(
      ([want, prior]) => {
        const now = document.querySelector(
          "[role=dialog] p[aria-live=polite]",
        )?.textContent;
        return now?.includes(want!) && now !== prior;
      },
      [text, before ?? null] as const,
      { timeout: 15_000 },
    );
    return true;
  } catch {
    return false;
  }
}

/** Posts from the main box; returns what the live region said before. */
async function post(page: Page, body: string) {
  const before = await said(page);
  await page.fill("#discussion-composer", body);
  await page.click("form:has(#discussion-composer) button[type=submit]");
  return before;
}

export async function desktopGate(k: Kit, c: Cast) {
  const n = c.issue.number!;
  k.heading("desktop — lazy fetch, open by mouse, the spread stays put");
  const { page, ctx, listCalls } = await k.reader(c.alice, n);
  const html = await (
    await fetch(`${k.base}/read/${n}`, {
      headers: { cookie: `authjs.session-token=${c.alice.token}` },
    })
  ).text();
  k.ok(
    !html.includes("check-301 from Ada") && !html.includes("Posting as"),
    "the issue page's HTML carries no comment markup",
  );
  await page.waitForTimeout(800);
  k.ok(listCalls() === 0, "the thread is not fetched until it is opened");
  const trigger = page.locator('button[title="Discussion"]');
  const label = await trigger.getAttribute("aria-label");
  k.ok(label === "Discussion, 1 comment", `the dock control is “${label}”`);
  const spreadBefore = await spreadBox(page);
  await trigger.click();
  await k.waitThread(page);
  // Dev's StrictMode runs the opening effect twice; a build fetches once.
  k.ok(
    listCalls() >= 1 && listCalls() <= 2,
    `opening fetched the list (${listCalls()} request(s))`,
  );
  k.ok(
    (await k.shell(page).getAttribute("aria-modal")) === "true" &&
      (await page
        .locator("#" + (await k.shell(page).getAttribute("aria-labelledby")))
        .textContent()) === `Discussion · Issue ${n}`,
    "the drawer is a modal dialog named “Discussion · Issue N”",
  );
  const box = await k.shell(page).boundingBox();
  k.ok(
    box && box.x + box.width > 1260 && box.x > 700,
    "the drawer sits on the right",
  );
  k.ok(
    (await spreadBox(page)) === spreadBefore,
    "the spread did not move or resize",
  );
  k.ok(
    await page.evaluate(
      () =>
        document
          .querySelector('[aria-label="Zoom page"]')
          ?.closest("[inert]") != null,
    ),
    "the reader behind the drawer is inert",
  );
  await k.shot(page, "desktop-drawer");

  k.heading("desktop — what a member sees");
  const ada = page.locator(`article[aria-label="Comment by Ada Editor"]`);
  k.ok(
    await ada.locator("text=Admin").isVisible(),
    "a badged admin's comment shows the Admin badge",
  );
  k.ok(
    (await ada.locator("time").getAttribute("title"))?.match(/\d{4}/) != null &&
      (await ada.locator("time").textContent()) === "3 days ago",
    "relative time with the full date as its title",
  );
  k.ok(
    (await ada.locator('button[aria-label^="Report"]').count()) === 1 &&
      (await ada.locator('button[aria-label="Edit your comment"]').count()) ===
        0,
    "another member's comment offers Report, not Edit/Delete",
  );
  k.ok(
    (await page.locator("text=Account:").count()) === 0,
    "a member never sees the account behind a name",
  );

  k.heading("desktop — posting as each of two names");
  const menu = page.locator('button[aria-label^="Posting as"]');
  k.ok(
    (await menu.getAttribute("aria-label")) === "Posting as Alice Reader",
    "the composer starts on the first name (no comments yet)",
  );
  await menu.click();
  await page.click('[role=menuitemradio]:has-text("A. Reader")');
  let before = await post(page, "check-301 under the second name");
  k.ok(
    await heard(page, "Your comment is posted.", before),
    "the post is announced",
  );
  const second = page.locator('article[aria-label="Comment by A. Reader"]');
  k.ok(await second.isVisible(), "the new comment shows under “A. Reader”");
  k.ok(
    (await page.evaluate(() => document.activeElement?.id)) ===
      "discussion-composer" &&
      (await page.inputValue("#discussion-composer")) === "",
    "the box is cleared and keeps focus",
  );
  const [row] = await k.sql`select author_name_id from comments
    where author_id = ${c.alice.id} order by created_at desc limit 1`;
  k.ok(row?.author_name_id === c.aliceNames[1], "stored under the chosen name");
  await menu.click();
  await page.click('[role=menuitemradio]:has-text("Alice Reader")');
  before = await post(page, "check-301 under the first name");
  await heard(page, "Your comment is posted.", before);
  k.ok(
    await page
      .locator('article[aria-label="Comment by Alice Reader"]')
      .isVisible(),
    "and another under “Alice Reader”",
  );
  k.ok(
    (await page
      .locator('button[title="Discussion"]')
      .getAttribute("aria-label")) === "Discussion, 3 comments",
    "the dock's count follows the posts",
  );
  k.ok(
    (await page
      .locator(
        'article[aria-label="Comment by Alice Reader"] button[aria-label^="Report"]',
      )
      .count()) === 0,
    "Report is absent on your own comment",
  );

  k.heading("desktop — reply, edit, delete, report");
  await ada.locator('button[aria-label^="Reply to"]').click();
  const replyBox = page.locator(`#reply-${c.adaComment}`);
  k.ok(
    (await replyBox.isVisible()) && (await replyBox.inputValue()) === "",
    "Reply opens an empty box under the parent",
  );
  await replyBox.fill("check-301 a reply to Ada");
  before = await said(page);
  await page.click(`form:has(#reply-${c.adaComment}) button[type=submit]`);
  k.ok(
    await heard(page, "Your reply is posted.", before),
    "the reply is posted and announced",
  );
  const reply = page.locator('article[aria-label="Reply by Alice Reader"]');
  k.ok(await reply.isVisible(), "the reply sits indented under Ada's comment");
  k.ok(
    (await reply.locator('button[aria-label^="Reply to"]').count()) === 0,
    "replying to a reply is not offered",
  );

  await second.locator('button[aria-label="Edit your comment"]').click();
  const editId = await second.getAttribute("id");
  const editBox = page.locator(`#edit-${editId!.replace("comment-", "")}`);
  await editBox.fill("check-301 edited words");
  before = await said(page);
  await page.click(
    `form:has(#${await editBox.getAttribute("id")}) button:has-text("Save")`,
  );
  k.ok(
    await heard(page, "Your comment is updated.", before),
    "the edit is saved and announced",
  );
  k.ok(
    await page
      .locator('article[aria-label="Comment by A. Reader"] >> text=(edited)')
      .isVisible(),
    "the edited comment shows “(edited)”",
  );

  const first = page.locator('article[aria-label="Comment by Alice Reader"]');
  await first.locator('button[aria-label="Delete your comment"]').click();
  await page.waitForSelector("[role=dialog] [role=dialog]");
  k.ok(
    (await page.locator("[role=dialog] [role=dialog] h2").textContent()) ===
      "Delete your comment?",
    "Delete asks first, in a dialog over the drawer",
  );
  before = await said(page);
  await page.click(
    '[role=dialog] [role=dialog] button:has-text("Delete comment")',
  );
  k.ok(
    await heard(page, "Your comment is deleted.", before),
    "the delete is announced",
  );
  k.ok((await first.count()) === 0, "the comment is gone");

  await ada.locator('button[aria-label^="Report"]').click();
  await page.waitForSelector("[role=dialog] [role=dialog]");
  await page.click('[role=dialog] [role=dialog] label:has-text("Spam")');
  await page.fill("[role=dialog] [role=dialog] textarea", "check-301 a note");
  await page.click(
    '[role=dialog] [role=dialog] button:has-text("Send report")',
  );
  await page.waitForSelector("text=Thanks — an admin will take a look.");
  k.ok(true, "the report thanks the reporter");
  await page.click('[role=dialog] [role=dialog] button:has-text("Done")');
  await ada.locator('button[aria-label^="Report"]').click();
  await page.click('[role=dialog] [role=dialog] label:has-text("Other")');
  await page.click(
    '[role=dialog] [role=dialog] button:has-text("Send report")',
  );
  await page.waitForSelector("text=Thanks — an admin will take a look.");
  k.ok(true, "a second report of the same comment thanks them too");
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog] [role=dialog]", {
    state: "detached",
  });
  const reports = await k.sql`select reason, note from comment_reports
    where comment_id = ${c.adaComment} and reporter_id = ${c.alice.id}`;
  k.ok(
    reports.length === 1 &&
      reports[0]!.reason === "spam" &&
      reports[0]!.note === "check-301 a note",
    `one report stored, the first (${reports.length})`,
  );
  k.ok(
    await k.shell(page).isVisible(),
    "Escape in the report dialog left the drawer open",
  );

  await page.click('button[aria-label="Close discussion"]');
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  k.ok(
    (await k.activeLabel(page)).startsWith("Discussion"),
    "closing puts focus back on the dock control",
  );
  await ctx.close();

  await keyboardPass(k, c);
  await otherViewers(k, c);
}

// Keyboard only: reach the control, open, type (arrows stay in the box), post,
// close — and the flipbook's arrow keys still turn pages afterwards.
async function keyboardPass(k: Kit, c: Cast) {
  k.heading("desktop — keyboard only");
  const { page, ctx } = await k.reader(c.alice, c.issue.number!);
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    await page.keyboard.press("Tab");
    found = (await k.activeLabel(page)).startsWith("Discussion");
  }
  k.ok(found, "Tab reaches the Discussion control");
  await page.keyboard.press("Enter");
  await k.waitThread(page);
  k.ok(
    (await k.activeLabel(page)) === "Close discussion",
    "focus moves into the drawer",
  );
  const label = await dockLabel(page);
  await page.focus("#discussion-composer");
  await page.keyboard.type("check-301 typed by keyboard");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  k.ok(
    (await dockLabel(page)) === label,
    "arrow keys in the box don't turn pages",
  );
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowRight");
  k.ok(
    (await dockLabel(page)) === label,
    "nor on another control in the drawer",
  );
  await page.focus("#discussion-composer");
  let onPost = false;
  for (let i = 0; i < 6 && !onPost; i++) {
    await page.keyboard.press("Tab");
    onPost = (await k.activeLabel(page)) === "Post";
  }
  k.ok(onPost, "Tab reaches Post");
  const quiet = await said(page);
  await page.keyboard.press("Enter");
  k.ok(await heard(page, "Your comment is posted.", quiet), "Enter posts it");
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  k.ok(
    (await k.activeLabel(page)).startsWith("Discussion"),
    "Escape closes, focus back on the control",
  );
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  k.ok(
    (await dockLabel(page)) !== label,
    "the arrows turn pages again once it is closed",
  );
  await ctx.close();
}

// Another member and an admin reading the same thread.
async function otherViewers(k: Kit, c: Cast) {
  k.heading("desktop — another member, the admin's read, the badge");
  let r = await k.reader(c.carol, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  const byA = r.page.locator('article[aria-label="Comment by A. Reader"]');
  k.ok(
    await byA.isVisible(),
    "another member sees the comment under “A. Reader”",
  );
  const img = await byA.locator("img").first().getAttribute("src");
  k.ok(img?.includes("check-301/"), `and that name's avatar (${img})`);
  await r.ctx.close();

  r = await k.reader(c.ada, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  const account = await r.page
    .locator('article[aria-label="Comment by A. Reader"] >> text=Account:')
    .textContent();
  k.ok(
    account === "Account: Alice Check",
    `an admin sees the account behind it (“${account}”)`,
  );
  k.ok(
    (await r.page
      .locator('[role=dialog] button[aria-label^="Report"]')
      .count()) === 0,
    "an admin gets no Report (their actions come with #302)",
  );
  await r.ctx.close();

  await k.sql`update users set is_admin = false where id = ${c.ada.id}`;
  r = await k.reader(c.carol, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  k.ok(
    (await r.page
      .locator('article[aria-label="Comment by Ada Editor"] >> text=Admin')
      .count()) === 0,
    "the badge goes once the account is no longer an admin",
  );
  await r.ctx.close();
  await k.sql`update users set is_admin = true where id = ${c.ada.id}`;
}

export { heard, post, said };
