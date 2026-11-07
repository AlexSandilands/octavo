// Dev-only: issue #132 in a real browser against a running server. Each place a
// member types in the discussion — the main comment (with its page tag, and a
// first post's new name), a reply, an edit and a report — is answered the way a
// newer build answers a page that outlived a deploy (404 + x-nextjs-action-not-
// found). The notice must say the words are kept; after a reload the box must
// reopen with them, the cursor in it and one line saying so; a second reload
// must restore nothing. Storage that throws keeps the old "copy" wording;
// expired or orphaned drafts are dropped. Nothing is ever written.
//
// Scratch rows are prefixed check-302-draft and removed; the settings row is
// restored exactly as found (or removed if it did not exist).
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-stale-draft-gate.mts <base-url> [shots-dir]
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";
import { reportsFixtures } from "./fixtures/reports-fixtures.mts";

process.loadEnvFile?.(".env.local");
const [base, shotsArg] = process.argv.slice(2);
if (!base)
  throw new Error("usage: dev-stale-draft-gate.mts <base-url> [shots]");
const shots = shotsArg ?? ".data/stale-draft-gate";
mkdirSync(shots, { recursive: true });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const f = reportsFixtures(sql, "draft");
let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) console.log(`  ok — ${msg}`);
  else {
    failures++;
    console.log(`  FAIL — ${msg}`);
  }
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const [settingsAsFound] = await sql`select * from settings where id = 1`;
const count = async (table: string) =>
  Number((await sql`select count(*)::int as n from ${sql(table)}`)[0]!.n);

const NOTICE = "[data-stale-action]";
const KEPT = "what you wrote will still be there";
const COPY = "Copy what you wrote";
const RESTORED = "We kept what you were writing";

/** Answers every Server Action POST the way a newer build does. */
async function arm(page: Page) {
  await page.route("**/*", (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) {
      return route.fallback();
    }
    return route.fulfill({
      status: 404,
      headers: { "x-nextjs-action-not-found": "1" },
      body: "Server action not found.",
    });
  });
}

const browser = await chromium.launch();
let enabledSettings = false;
try {
  if (settingsAsFound) {
    await sql`update settings set comments_enabled = true where id = 1`;
  } else {
    await sql`insert into settings (id, comments_enabled) values (1, true)`;
  }
  enabledSettings = true;

  const alice = await f.user(`${f.stamp} Alice`);
  const bob = await f.user(`${f.stamp} Bob`);
  const dora = await f.user(`${f.stamp} Dora`); // no posting name yet
  const aliceName = await f.name(alice.id, `${f.stamp} Alice name`);
  const bobName = await f.name(bob.id, `${f.stamp} Bob name`);
  const issueId = await f.issue();
  const number = (
    await sql`select number from issues where id = ${issueId}`
  )[0]!.number as number;
  const key = `octavo:stale-draft:${number}`;
  const aliceComment = await f.comment(
    issueId,
    alice,
    aliceName,
    "Alice’s words",
    5,
  );
  const bobComment = await f.comment(issueId, bob, bobName, "Bob’s words", 4);
  const bobReply = await f.comment(issueId, bob, bobName, "Bob’s reply", 3);
  await sql`update comments set parent_id = ${aliceComment} where id = ${bobReply}`;
  const commentsBefore = await count("comments");
  const reportsBefore = await count("comment_reports");

  const ctxFor = async (user: { id: string }, width = 1280) => {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await f.signIn(ctx, base, user.id);
    return ctx;
  };
  const open = async (ctx: BrowserContext) => {
    const page = await ctx.newPage();
    await page.goto(`${base}/read/${number}?discussion=1`);
    await page.waitForSelector("#discussion-composer", { timeout: 60_000 });
    return page;
  };
  const reloadThread = async (page: Page) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.reload();
    await page.waitForSelector("#discussion-composer", { timeout: 60_000 });
    await page.waitForTimeout(400);
  };
  const stored = (page: Page) =>
    page.evaluate((k) => sessionStorage.getItem(k), key);
  const focusedId = (page: Page) =>
    page.evaluate(() => document.activeElement?.id ?? "");
  const caretAtEnd = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLTextAreaElement | null;
      return !!el && el.selectionStart === el.value.length;
    });
  const live = (page: Page) =>
    page.locator("p[aria-live=polite]").last().innerText();
  const card = (page: Page, id: string) => page.locator(`#comment-${id}`);
  const expectKept = async (page: Page, scope: string, what: string) => {
    const notice = page.locator(scope).locator(NOTICE).first();
    await notice.waitFor({ timeout: 10_000 }).catch(() => {});
    const text = (await notice.textContent().catch(() => "")) ?? "";
    ok(text.includes(KEPT), `${what}: the notice says the words are kept`);
    ok(!text.includes(COPY), `${what}: and no longer says to copy them`);
    ok((await stored(page)) !== null, `${what}: a draft is in sessionStorage`);
  };
  const expectLine = async (page: Page, scope: string, what: string) => {
    ok(
      (await page.locator(scope).innerText()).includes(RESTORED),
      `${what}: the restored line shows by the box`,
    );
    ok((await live(page)).includes(RESTORED), `${what}: and is announced`);
    ok((await stored(page)) === null, `${what}: the draft is used up`);
  };

  // ── main comment, with a page tag ───────────────────────────────────────
  heading("main comment");
  const aliceCtx = await ctxFor(alice);
  {
    const page = await open(aliceCtx);
    await page.getByRole("button", { name: "Tag a page" }).click();
    await page.getByRole("menuitemradio", { name: /^Page 2/ }).click();
    await page.fill("#discussion-composer", "Kept across the deploy");
    await arm(page);
    await page.click("form:has(#discussion-composer) button[type=submit]");
    await expectKept(page, "form:has(#discussion-composer)", "comment");
    await page.screenshot({ path: `${shots}/comment-kept.png` });

    await reloadThread(page);
    ok(
      (await page.inputValue("#discussion-composer")) ===
        "Kept across the deploy",
      "comment: the words are back in the box",
    );
    ok(
      (await page
        .getByRole("button", { name: /^Tagged to page 2/i })
        .count()) === 1,
      "comment: still tagged to page 2",
    );
    ok(
      (await focusedId(page)) === "discussion-composer",
      "comment: the cursor is in the box",
    );
    ok(await caretAtEnd(page), "comment: at the end of the words");
    await expectLine(page, "form:has(#discussion-composer)", "comment");
    await page.screenshot({ path: `${shots}/comment-restored.png` });
    await page.keyboard.type("!");
    ok(
      !(
        await page.locator("form:has(#discussion-composer)").innerText()
      ).includes(RESTORED),
      "comment: the line goes on the next keystroke",
    );

    await reloadThread(page);
    ok(
      (await page.inputValue("#discussion-composer")) === "",
      "comment: a second reload restores nothing",
    );
    await page.close();
  }

  // ── reply ───────────────────────────────────────────────────────────────
  heading("reply");
  {
    const page = await open(aliceCtx);
    await card(page, bobComment)
      .getByRole("button", { name: /^Reply to/ })
      .click();
    const box = `#reply-${bobComment}`;
    await page.fill(box, "A reply that outlived the build");
    await arm(page);
    await page.click(`form:has(${box}) button[type=submit]`);
    await expectKept(page, `form:has(${box})`, "reply");

    await reloadThread(page);
    ok(
      (await page.locator(box).count()) === 1 &&
        (await page.inputValue(box)) === "A reply that outlived the build",
      "reply: the reply box is open under its comment with the words",
    );
    ok((await focusedId(page)) === box.slice(1), "reply: the cursor is in it");
    ok(await caretAtEnd(page), "reply: at the end of the words");
    await expectLine(page, `form:has(${box})`, "reply");
    await page.screenshot({ path: `${shots}/reply-restored.png` });

    await reloadThread(page);
    ok((await page.locator(box).count()) === 0, "reply: not again");
    await page.close();
  }

  // ── edit (of a top-level comment) ───────────────────────────────────────
  heading("edit");
  {
    const page = await open(aliceCtx);
    await card(page, aliceComment)
      .getByRole("button", { name: "Edit your comment" })
      .click();
    const box = `#edit-${aliceComment}`;
    await page.fill(box, "Alice’s words, improved");
    await arm(page);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expectKept(page, `form:has(${box})`, "edit");

    await reloadThread(page);
    ok(
      (await page.locator(box).count()) === 1 &&
        (await page.inputValue(box)) === "Alice’s words, improved",
      "edit: the edit box is open with the edited words",
    );
    ok((await focusedId(page)) === box.slice(1), "edit: the cursor is in it");
    await expectLine(page, `form:has(${box})`, "edit");
    await page.screenshot({ path: `${shots}/edit-restored.png` });

    await reloadThread(page);
    ok((await page.locator(box).count()) === 0, "edit: not again");
    await page.close();
  }

  // ── report (of a reply, folded on load) ─────────────────────────────────
  heading("report");
  {
    const page = await open(aliceCtx);
    // Alice reports Bob's comment, then the same on the reply is checked by
    // a stored draft below.
    await card(page, bobComment)
      .getByRole("button", { name: /^Report/ })
      .click();
    const dialog = page.getByRole("dialog", { name: "Report this comment" });
    await dialog.getByRole("radio", { name: /spam/i }).check();
    await dialog.locator("textarea").fill("Posted three times");
    await arm(page);
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expectKept(
      page,
      "[role=dialog]:not(:has([role=dialog])):has(input[type=radio])",
      "report",
    );

    await reloadThread(page);
    const back = page.getByRole("dialog", { name: "Report this comment" });
    await back.waitFor({ timeout: 10_000 }).catch(() => {});
    ok((await back.count()) === 1, "report: the dialog is open again");
    ok(
      await back.getByRole("radio", { name: /spam/i }).isChecked(),
      "report: with its reason",
    );
    ok(
      (await back.locator("textarea").inputValue()) === "Posted three times",
      "report: and its note",
    );
    ok(
      await page.evaluate(() => document.activeElement?.tagName === "TEXTAREA"),
      "report: the cursor is in the note",
    );
    await expectLine(
      page,
      "[role=dialog]:not(:has([role=dialog])):has(input[type=radio])",
      "report",
    );
    await page.screenshot({ path: `${shots}/report-restored.png` });

    await reloadThread(page);
    ok(
      (await page
        .getByRole("dialog", { name: "Report this comment" })
        .count()) === 0,
      "report: not again",
    );
    await page.close();
  }

  // ── stored drafts on a reply's target, and ones to drop ─────────────────
  heading("drafts on a folded reply, and drafts dropped");
  {
    const page = await open(aliceCtx);
    const plant = (draft: object, ageMs = 0) =>
      page.evaluate(
        ([k, d, age]) =>
          sessionStorage.setItem(
            k as string,
            JSON.stringify({ savedAt: Date.now() - (age as number), draft: d }),
          ),
        [key, draft, ageMs] as const,
      );

    await plant({
      kind: "report",
      commentId: bobReply,
      reason: "other",
      note: "On a reply",
    });
    await reloadThread(page);
    ok(
      (await page
        .getByRole("dialog", { name: "Report this comment" })
        .count()) === 1,
      "a report on a folded reply reopens (its parent unfolded)",
    );
    ok(
      (await page.locator(`#comment-${bobReply}`).count()) === 1,
      "the reply is showing under its parent",
    );
    await page.keyboard.press("Escape");

    const dropped: [string, object, number][] = [
      [
        "a draft older than 30 minutes",
        { kind: "edit", commentId: aliceComment, body: "Too late" },
        31 * 60_000,
      ],
      [
        "an edit of someone else's comment",
        { kind: "edit", commentId: bobComment, body: "Not mine" },
        0,
      ],
      [
        "a reply to a comment that has gone",
        {
          kind: "reply",
          parentId: "00000000-0000-4000-8000-000000000000",
          body: "Orphan",
          newName: null,
        },
        0,
      ],
      [
        "a report of your own comment",
        { kind: "report", commentId: aliceComment, reason: "spam", note: "" },
        0,
      ],
      ["a malformed record", { kind: "comment" }, 0],
    ];
    for (const [what, draft, age] of dropped) {
      await plant(draft, age);
      await reloadThread(page);
      const opened =
        (await page
          .locator(`#edit-${aliceComment}, #edit-${bobComment}`)
          .count()) +
        (await page.locator("[id^=reply-]").count()) +
        (await page
          .getByRole("dialog", { name: "Report this comment" })
          .count());
      ok(opened === 0, `${what}: nothing reopens`);
      ok(
        !(await page.locator("body").innerText()).includes(RESTORED),
        `${what}: no restored line`,
      );
      ok((await stored(page)) === null, `${what}: removed from storage`);
    }
    await page.close();
  }
  await aliceCtx.close();

  // ── a first post: the new posting name comes back too (phone width) ────
  heading("first post, phone sheet");
  {
    const ctx = await ctxFor(dora, 390);
    const page = await open(ctx);
    await page.fill("#discussion-composer", "My very first comment");
    await page.fill("#discussion-composer-name", "Dora Gatekeeper");
    await arm(page);
    await page.click("form:has(#discussion-composer) button[type=submit]");
    await expectKept(page, "form:has(#discussion-composer)", "first post");
    await page.screenshot({ path: `${shots}/phone-first-post-kept.png` });

    await reloadThread(page);
    ok(
      (await page.inputValue("#discussion-composer")) ===
        "My very first comment",
      "first post: the words are back",
    );
    ok(
      (await page.inputValue("#discussion-composer-name")) ===
        "Dora Gatekeeper",
      "first post: and the name typed for it",
    );
    await expectLine(page, "form:has(#discussion-composer)", "first post");
    await page.screenshot({ path: `${shots}/phone-first-post-restored.png` });
    ok(
      (
        await sql`select count(*)::int as n from member_names where user_id = ${dora.id}`
      )[0]!.n === 0,
      "first post: no name was created",
    );
    await ctx.close();
  }

  // ── storage that throws keeps the old wording ────────────────────────────
  heading("no storage");
  {
    const ctx = await ctxFor(bob);
    await ctx.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      };
    });
    const page = await open(ctx);
    await page.fill("#discussion-composer", "Nowhere to keep this");
    await arm(page);
    await page.click("form:has(#discussion-composer) button[type=submit]");
    const notice = page
      .locator("form:has(#discussion-composer)")
      .locator(NOTICE)
      .first();
    await notice.waitFor({ timeout: 10_000 }).catch(() => {});
    const text = (await notice.textContent()) ?? "";
    ok(text.includes(COPY), "no storage: still says to copy the words");
    ok(!text.includes(KEPT), "no storage: never promises to keep them");
    await page.screenshot({ path: `${shots}/no-storage.png` });
    await ctx.close();
  }

  heading("nothing written");
  ok((await count("comments")) === commentsBefore, "no comment written");
  ok((await count("comment_reports")) === reportsBefore, "no report written");
  ok(
    (await sql`select body from comments where id = ${aliceComment}`)[0]!
      .body === "Alice’s words",
    "the edited comment is unchanged",
  );
} finally {
  await browser.close();
  await f.cleanup();
  if (enabledSettings) {
    if (settingsAsFound) {
      await sql`update settings set comments_enabled = ${settingsAsFound.comments_enabled} where id = 1`;
    } else {
      await sql`delete from settings where id = 1`;
    }
  }
  const [left] = await sql`select
    (select count(*) from users where email like 'check-302-draft-%')::int
    + (select count(*) from issues where title like 'check-302-draft-%')::int as n`;
  ok(Number(left!.n) === 0, "scratch rows removed");
  await sql.end();
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
