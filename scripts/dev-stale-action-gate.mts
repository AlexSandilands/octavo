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
import {
  chromium,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright";
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
  const number = (
    await sql`select number from issues where id = ${issueId}`
  )[0]!.number as number;
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
    // Each check looks only inside its own site, so an earlier site's
    // leftover notice or error can't satisfy it.
    const notice = (scope: Locator) => scope.locator(NOTICE);
    const expectOutcome = async (
      page: Page,
      errors: string[],
      what: string,
      scope: Locator,
      oldCopy: RegExp | null,
      shot: string,
    ) => {
      if (stale) {
        await scope
          .locator(NOTICE)
          .first()
          .waitFor({ timeout: 10_000 })
          .catch(() => {});
        ok(
          (await notice(scope).count()) > 0,
          `${what}: the reload notice shows`,
        );
        ok(
          ((await notice(scope).first().textContent()) ?? "").includes(
            NOTICE_TEXT,
          ),
          `${what}: in the #402 wording`,
        );
        ok(
          (await notice(scope)
            .first()
            .getByRole("button", { name: "Reload page" })
            .count()) === 1,
          `${what}: with a Reload page button`,
        );
        ok(errors.length === 0, `${what}: nothing logged to the console`);
      } else {
        await page.waitForTimeout(1500);
        ok((await notice(scope).count()) === 0, `${what}: no reload notice`);
        if (oldCopy) {
          ok(
            oldCopy.test(await scope.innerText()),
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
        page.locator("form:has(#discussion-composer)"),
        /That didn’t go through/,
        "composer",
      );
      ok(hits() >= 1, "composer: the action was called");
      if (stale) {
        ok(
          (
            (await notice(page.locator("form:has(#discussion-composer)"))
              .first()
              .textContent()) ?? ""
          ).includes("Copy what you wrote"),
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
        page.locator("form[data-owns-escape]:not(:has(#discussion-composer))"),
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
        page.getByRole("dialog").last(),
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
        page.getByRole("dialog").last(),
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

    if (stale) {
      heading(`${label} — composer notice at phone width (member)`);
      const ctx = await ctxFor(alice, 390);
      const { page, errors } = await thread(ctx);
      await arm(page, kind);
      await page.fill("#discussion-composer", "A comment from an old page");
      await page.click("form:has(#discussion-composer) button[type=submit]");
      await page.waitForSelector(NOTICE, { timeout: 10_000 });
      ok(errors.length === 0, "phone: nothing logged to the console");
      ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        "phone: no horizontal scroll",
      );
      await page.screenshot({ path: `${shots}/${kind}-composer-phone.png` });
      await ctx.close();
    }

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
        await page.waitForSelector("[role=menu] p");
        ok(
          ((await page.locator("[role=menu] p").textContent()) ?? "").includes(
            NOTICE_TEXT,
          ),
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
          (await page.locator("[role=menu] p").count()) === 0,
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
        commentCard(page, "Bob’s words"),
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
        page.getByRole("dialog").last(),
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
        page.getByRole("dialog").last(),
        /That didn’t work/,
        "delete-issue",
      );
      await page.getByRole("button", { name: "Cancel" }).last().click();
      errors.length = 0;

      await page.locator(`[aria-label^="Select "]`).first().check();
      await page.getByRole("button", { name: "Delete selected" }).click();
      if (stale) {
        await page.waitForSelector(NOTICE, { timeout: 10_000 }).catch(() => {});
        ok(
          (await notice(page.locator("body")).count()) > 0,
          "bulk delete: the notice shows",
        );
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
        page.locator("body"),
        /Couldn.t save/,
        "settings",
      );
      const [s] = await sql`select tagline from settings where id = 1`;
      ok(s?.tagline !== `${f.stamp} tagline`, "settings: nothing saved");
      await ctx.close();
    }

    // ── admin: logo rename and sponsor dialogs ──────────────────────────────
    heading(`${label} — logo rename, new sponsor (admin)`);
    {
      const ctx = await ctxFor(admin);
      const page = await ctx.newPage();
      const errors = watch(page);
      await page.goto(`${base}/admin/magazine`);
      await page
        .getByRole("button", { name: /^Rename / })
        .first()
        .waitFor({ timeout: 60_000 });
      const logoBefore = (
        await sql`select name from logos order by created_at limit 1`
      )[0]!.name as string;
      await arm(page, kind);
      await page
        .getByRole("button", { name: /^Rename / })
        .first()
        .click();
      await page.locator("#logo-name").fill(`${f.stamp} renamed`);
      await page.getByRole("button", { name: "Save name" }).click();
      await expectOutcome(
        page,
        errors,
        "logo rename",
        page.getByRole("dialog").last(),
        /Could not save/,
        "logo",
      );
      ok(
        (await sql`select name from logos where name = ${`${f.stamp} renamed`}`)
          .length === 0,
        "logo rename: nothing saved",
      );
      ok(
        (await sql`select 1 from logos where name = ${logoBefore}`).length >= 1,
        "logo rename: the logo is as it was",
      );
      await page.close();

      const sponsors = await ctx.newPage();
      const sponsorErrors = watch(sponsors);
      await sponsors.goto(`${base}/admin/sponsors`);
      await sponsors
        .getByRole("button", { name: /^Add (your first )?sponsor/ })
        .first()
        .waitFor({ timeout: 60_000 });
      const sponsorsBefore = await count("sponsors");
      await arm(sponsors, kind);
      await sponsors
        .getByRole("button", { name: /^Add (your first )?sponsor/ })
        .first()
        .click();
      await sponsors.locator("#sponsor-name").fill(`${f.stamp} sponsor`);
      await sponsors.getByRole("button", { name: "Save sponsor" }).click();
      await expectOutcome(
        sponsors,
        sponsorErrors,
        "sponsor",
        sponsors.getByRole("dialog").last(),
        /Could not save/,
        "sponsor",
      );
      ok((await count("sponsors")) === sponsorsBefore, "sponsor: none added");
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
