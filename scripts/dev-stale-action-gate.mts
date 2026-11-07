// Dev-only: issue #403 in a real browser against a running server — every
// client site that catches its own Server Action rejection, answered the way a
// newer build answers a page that outlived a deploy (404 + x-nextjs-action-not-
// found). Each must show the inline reload notice (never a retry or a thank-
// you), write nothing, and log nothing to the console (the Sentry path). A
// control run answers 500 instead and must keep each site's old copy.
//
// Scratch rows are prefixed check-302-stale and removed; the settings row is
// restored exactly as found (or removed if it did not exist).
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-stale-action-gate.mts <base-url> [shots-dir]
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";
import { reportsFixtures } from "./fixtures/reports-fixtures.mts";

process.loadEnvFile?.(".env.local");
const [base, shotsArg] = process.argv.slice(2);
if (!base)
  throw new Error("usage: dev-stale-action-gate.mts <base-url> [shots]");
const shots = shotsArg ?? ".data/stale-action-gate";
mkdirSync(shots, { recursive: true });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const f = reportsFixtures(sql, "stale");
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

type Kind = "stale" | "control";
const NOTICE = "[data-stale-action]";
const NOTICE_TEXT = "A new version went live while this page was open";

/** Answers the next Server Action POSTs the way a newer build (or a broken one). */
async function arm(page: Page, kind: Kind) {
  let hits = 0;
  await page.route("**/*", (route) => {
    const req = route.request();
    if (req.method() !== "POST" || !req.headers()["next-action"]) {
      return route.fallback();
    }
    hits++;
    return kind === "stale"
      ? route.fulfill({
          status: 404,
          headers: { "x-nextjs-action-not-found": "1" },
          body: "Server action not found.",
        })
      : route.fulfill({ status: 500, body: "boom" });
  });
  return () => hits;
}

const browser = await chromium.launch();
let enabledSettings = false;
try {
  // Discussion has to be on for the thread; put the row back afterwards.
  if (settingsAsFound) {
    await sql`update settings set comments_enabled = true where id = 1`;
  } else {
    await sql`insert into settings (id, comments_enabled) values (1, true)`;
  }
  enabledSettings = true;

  const admin = await f.user(`${f.stamp} Admin`, true);
  const alice = await f.user(`${f.stamp} Alice`);
  const bob = await f.user(`${f.stamp} Bob`);
  await f.name(admin.id, `${f.stamp} Admin name`);
  const aliceName = await f.name(alice.id, `${f.stamp} Alice name`);
  const bobName = await f.name(bob.id, `${f.stamp} Bob name`);
  const issueId = await f.issue();
  const [{ number }] =
    await sql`select number from issues where id = ${issueId}`;
  const aliceComment = await f.comment(
    issueId,
    alice,
    aliceName,
    "Alice’s words",
  );
  const bobComment = await f.comment(issueId, bob, bobName, "Bob’s words");
  const bobReply = await f.comment(
    issueId,
    bob,
    bobName,
    "Bob replies to Alice",
  );
  await sql`update comments set parent_id = ${aliceComment} where id = ${bobReply}`;
  await sql`insert into notifications (id, user_id, comment_id)
    values (gen_random_uuid(), ${alice.id}, ${bobReply}),
           (gen_random_uuid(), ${alice.id}, ${bobComment})`;

  const ctxFor = async (user: { id: string }, width = 1280) => {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await f.signIn(ctx, base, user.id);
    return ctx;
  };

  // The page's console (where a Sentry-bound error would also be logged).
  const watch = (page: Page) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text())) {
        errors.push(m.text());
      }
    });
    return errors;
  };

  const thread = async (ctx: BrowserContext) => {
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(`${base}/read/${number}?discussion=1`);
    await page.waitForSelector("#discussion-composer", { timeout: 60_000 });
    return { page, errors };
  };
  const commentCard = (page: Page, text: string) =>
    page.locator("li, article, div").filter({ hasText: text }).last();

  for (const kind of ["stale", "control"] as const) {
    const stale = kind === "stale";
    const label = stale ? "stale (404 not-found)" : "control (500)";
    const notice = (page: Page) => page.locator(NOTICE);
    const expectOutcome = async (
      page: Page,
      errors: string[],
      what: string,
      oldCopy: RegExp | null,
      shot: string,
    ) => {
      if (stale) {
        await page.waitForSelector(NOTICE, { timeout: 10_000 }).catch(() => {});
        ok(
          (await notice(page).count()) > 0,
          `${what}: the reload notice shows`,
        );
        ok(
          ((await notice(page).first().textContent()) ?? "").includes(
            NOTICE_TEXT,
          ),
          `${what}: in the #402 wording`,
        );
        ok(
          (await notice(page)
            .first()
            .getByRole("button", { name: "Reload page" })
            .count()) === 1,
          `${what}: with a Reload page button`,
        );
        ok(errors.length === 0, `${what}: nothing logged to the console`);
      } else {
        await page.waitForTimeout(1500);
        ok((await notice(page).count()) === 0, `${what}: no reload notice`);
        if (oldCopy) {
          ok(
            oldCopy.test(await page.locator("body").innerText()),
            `${what}: keeps its old failure copy`,
          );
        }
      }
      await page.screenshot({ path: `${shots}/${kind}-${shot}.png` });
    };

    // ── member discussion ───────────────────────────────────────────────────
    heading(`${label} — composer, edit, delete, report (member)`);
    const aliceCtx = await ctxFor(alice);
    const commentsBefore = await count("comments");
    {
      const { page, errors } = await thread(aliceCtx);
      const hits = await arm(page, kind);

      await page.fill("#discussion-composer", "A new comment from an old page");
      await page.click("form:has(#discussion-composer) button[type=submit]");
      await expectOutcome(
        page,
        errors,
        "composer",
        /That didn’t go through/,
        "composer",
      );
      ok(hits() >= 1, "composer: the action was called");
      if (stale) {
        ok(
          ((await notice(page).first().textContent()) ?? "").includes(
            "Copy what you wrote",
          ),
          "composer: says to copy the text first",
        );
        ok(
          (await page.inputValue("#discussion-composer")) ===
            "A new comment from an old page",
          "composer: the typed words are still there",
        );
      }
      errors.length = 0;

      // Edit your own comment.
      await commentCard(page, "Alice’s words")
        .getByRole("button", { name: "Edit your comment" })
        .click();
      await page.keyboard.press("End");
      await page.keyboard.type(" edited");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expectOutcome(
        page,
        errors,
        "edit",
        /That didn’t go through/,
        "edit",
      );
      await page.getByRole("button", { name: "Cancel" }).last().click();
      errors.length = 0;

      // Delete your own comment.
      await commentCard(page, "Alice’s words")
        .getByRole("button", { name: "Delete your comment" })
        .click();
      await page.getByRole("button", { name: "Delete comment" }).click();
      await expectOutcome(
        page,
        errors,
        "delete",
        /That didn’t go through/,
        "delete",
      );
      await page.getByRole("button", { name: "Cancel" }).last().click();
      errors.length = 0;

      // Report someone else's comment.
      await commentCard(page, "Bob’s words")
        .getByRole("button", { name: /^Report/ })
        .first()
        .click();
      await page.locator("input[name=reason]").first().check();
      await page.getByRole("button", { name: "Send report" }).click();
      await expectOutcome(
        page,
        errors,
        "report",
        /That didn’t go through/,
        "report",
      );
      ok(
        (await page
          .getByText("Thanks — an admin will take a look.")
          .count()) === 0,
        "report: never thanks when nothing was sent",
      );
      await page.close();
    }
    ok(
      (await count("comments")) === commentsBefore,
      "nothing was written or deleted",
    );
    ok((await count("comment_reports")) === 0, "no report was filed");
    await aliceCtx.close();

    // ── bell ────────────────────────────────────────────────────────────────
    heading(`${label} — notification bell (member)`);
    {
      const ctx = await ctxFor(alice);
      const page = await ctx.newPage();
      const errors = watch(page);
      await page.goto(`${base}/`);
      await page.waitForSelector('header button[aria-haspopup="menu"]', {
        timeout: 60_000,
      });
      await arm(page, kind);
      await page.click('header button[aria-haspopup="menu"]');
      await page.getByRole("menuitem", { name: "Mark all read" }).click();
      if (stale) {
        await page.waitForSelector("[role=menu] [role=alert]");
        ok(
          (
            (await page.locator("[role=menu] [role=alert]").textContent()) ?? ""
          ).includes(NOTICE_TEXT),
          "mark all: the menu foot says to reload",
        );
        ok(
          (await page
            .getByRole("menuitem", { name: "Reload page" })
            .count()) === 1,
          "mark all: the foot item becomes Reload page",
        );
        await page.screenshot({ path: `${shots}/${kind}-bell.png` });
      } else {
        await page.waitForTimeout(1500);
        ok(
          (await page.locator("[role=menu] [role=alert]").count()) === 0,
          "mark all: no reload notice",
        );
      }
      ok(errors.length === 0, "mark all: nothing logged to the console");

      // Choosing a reply still opens it; an outdated page does it with a full
      // load rather than a client navigation.
      await page.reload();
      await page.waitForSelector('header button[aria-haspopup="menu"]');
      await page.click('header button[aria-haspopup="menu"]');
      let fullLoads = 0;
      page.on("load", () => fullLoads++);
      await page.locator("[role=menu] a[role=menuitem]").first().click();
      await page.waitForURL(/discussion=1/, { timeout: 15_000 });
      ok(true, "mark read: the reply opens");
      if (stale) ok(fullLoads >= 1, "mark read: by a full page load");
      await ctx.close();
    }

    // ── admin: moderation in the thread ─────────────────────────────────────
    heading(`${label} — hide and delete in the thread (admin)`);
    {
      const ctx = await ctxFor(admin);
      const { page, errors } = await thread(ctx);
      await arm(page, kind);
      const hidden =
        await sql`select hidden_at from comments where id = ${bobComment}`;
      await commentCard(page, "Bob’s words")
        .getByRole("button", { name: /^Hide/ })
        .first()
        .click();
      await expectOutcome(
        page,
        errors,
        "hide",
        /That didn’t go through/,
        "moderation-hide",
      );
      errors.length = 0;
      await commentCard(page, "Bob’s words")
        .getByRole("button", { name: /^Delete/ })
        .first()
        .click();
      await page.getByRole("button", { name: /Delete comment/ }).click();
      await expectOutcome(
        page,
        errors,
        "moderation delete",
        /That didn’t go through/,
        "moderation-delete",
      );
      const after =
        await sql`select hidden_at, deleted_at from comments where id = ${bobComment}`;
      ok(
        after[0]!.hidden_at === hidden[0]!.hidden_at && !after[0]!.deleted_at,
        "the comment is untouched",
      );
      await ctx.close();
    }

    // ── admin: issues list ──────────────────────────────────────────────────
    heading(`${label} — delete issue, bulk delete count (admin)`);
    {
      const ctx = await ctxFor(admin);
      const page = await ctx.newPage();
      const errors = watch(page);
      await page.goto(`${base}/admin?q=${encodeURIComponent(f.stamp)}`);
      await page.waitForSelector(`[aria-label^="Select "]`, {
        timeout: 60_000,
      });
      await arm(page, kind);

      await page.locator(`button[aria-label^="Delete "]`).first().click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete issue" })
        .click();
      await expectOutcome(
        page,
        errors,
        "delete issue",
        /That didn’t work/,
        "delete-issue",
      );
      await page.getByRole("button", { name: "Cancel" }).last().click();
      errors.length = 0;

      await page.locator(`[aria-label^="Select "]`).first().check();
      await page.getByRole("button", { name: "Delete selected" }).click();
      if (stale) {
        await page.waitForSelector(NOTICE, { timeout: 10_000 }).catch(() => {});
        ok((await notice(page).count()) > 0, "bulk delete: the notice shows");
        ok(
          (await page.getByRole("dialog").count()) === 0,
          "bulk delete: no confirm opened with “0 comments”",
        );
        ok(errors.length === 0, "bulk delete: nothing logged to the console");
        await page.screenshot({ path: `${shots}/${kind}-bulk.png` });
      } else {
        await page.waitForSelector("[role=dialog]", { timeout: 10_000 });
        ok(true, "bulk delete: the control opens the confirm as before");
      }
      ok(
        (await sql`select 1 from issues where id = ${issueId}`).length === 1,
        "the issue is still there",
      );
      await ctx.close();
    }

    // ── admin: magazine settings ────────────────────────────────────────────
    heading(`${label} — magazine settings save (admin)`);
    {
      const ctx = await ctxFor(admin);
      const page = await ctx.newPage();
      const errors = watch(page);
      await page.goto(`${base}/admin/magazine`);
      await page.locator("#magazine-name").waitFor({ timeout: 60_000 });
      await arm(page, kind);
      await page
        .getByLabel("Tagline", { exact: true })
        .fill(`${f.stamp} tagline`);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expectOutcome(
        page,
        errors,
        "settings",
        /Couldn.t save/,
        "settings",
      );
      const [s] = await sql`select tagline from settings where id = 1`;
      ok(s?.tagline !== `${f.stamp} tagline`, "settings: nothing saved");
      await ctx.close();
    }

    // ── admin: members removal note ─────────────────────────────────────────
    heading(`${label} — member removal comment count (admin)`);
    {
      const ctx = await ctxFor(admin);
      const page = await ctx.newPage();
      await page.goto(
        `${base}/admin/members?q=${encodeURIComponent(bob.email)}`,
      );
      await page
        .getByRole("button", { name: /^Show details for/ })
        .first()
        .click({ timeout: 60_000 });
      await arm(page, kind);
      await page
        .getByRole("button", { name: /^Remove / })
        .first()
        .click();
      await page.waitForSelector("[data-removal-comments]", {
        timeout: 10_000,
      });
      await page.waitForTimeout(1500);
      const text = await page.locator("[data-removal-comments]").innerText();
      if (stale) {
        ok(
          /Reload the page before removing/.test(text),
          "removal: says to reload before removing",
        );
      } else {
        ok(
          /couldn’t be counted just now/.test(text),
          "removal: keeps its old failure copy",
        );
      }
      await page.screenshot({ path: `${shots}/${kind}-removal.png` });
      await ctx.close();
    }
  }
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
    (select count(*) from users where email like 'check-302-stale-%')::int
    + (select count(*) from issues where title like 'check-302-stale-%')::int as n`;
  ok(Number(left!.n) === 0, "scratch rows removed");
  await sql.end();
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
