// Dev-only: issue #302 part 1 in a real browser against a running server —
// the reports inbox (filters and search in the URL, every row action, the
// snapshot beside the comment's current state, the nav and Issues counts, a
// keyboard walkthrough and the accessibility tree), the discussion settings on
// /admin/magazine, and both members removal confirmations (the comment count,
// what the setting does, and that removal carries it out and takes the
// member's avatar out of storage). Scratch rows are prefixed check-302 and
// removed; the settings row is restored exactly as found.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-reports-gate.mts <base-url> [shots-dir]
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Locator } from "playwright";
import postgres from "postgres";
import { reportsFixtures } from "./fixtures/reports-fixtures.mts";
import { checkSettingsAndRemoval } from "./reports-gate-admin.mts";

process.loadEnvFile?.(".env.local");
const { getObject } = await import("../src/lib/storage.ts");
const [base, shotsArg] = process.argv.slice(2);
if (!base) throw new Error("usage: dev-reports-gate.mts <base-url> [shots]");
const shots = shotsArg ?? ".data/reports-gate";
mkdirSync(shots, { recursive: true });

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const f = reportsFixtures(sql, "gate");
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));
const [settingsAsFound] = await sql`select * from settings where id = 1`;

const openCount = async () =>
  Number(
    (
      await sql`select count(*)::int as n from comment_reports where status = 'open'`
    )[0]!.n,
  );
const reportRow = async (id: string) =>
  (await sql`select * from comment_reports where id = ${id}`)[0]!;
const commentRow = async (id: string) =>
  (await sql`select * from comments where id = ${id}`)[0];

// Polls the database until `check` holds (or gives up after ~10s).
async function until(check: () => Promise<unknown>) {
  for (let i = 0; i < 40 && !(await check()); i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
}

const browser = await chromium.launch();
let failed = false;
try {
  // ── fixtures ──────────────────────────────────────────────────────────────
  const admin = await f.user(`${f.stamp} Admin`, true);
  const alice = await f.user(`${f.stamp} Alice`);
  const bob = await f.user(`${f.stamp} Bob`);
  const r = [
    await f.user(`${f.stamp} Reporter A`),
    await f.user(`${f.stamp} Reporter B`),
  ] as const;
  const issueId = await f.issue();
  const aliceAvatar = await f.avatar();
  const aliceName = await f.name(alice.id, "Alice Aye", aliceAvatar.id);
  const bobName = await f.name(bob.id, "Bob Bee");
  const c = {
    hide: await f.comment(issueId, alice, aliceName, "Words to hide", 9),
    resolve: await f.comment(issueId, bob, bobName, "Resolve me please", 8),
    del: await f.comment(issueId, bob, bobName, "Delete me please", 7),
    edited: await f.comment(issueId, alice, aliceName, "Before the edit", 6),
    long: await f.comment(
      issueId,
      alice,
      aliceName,
      `${"A long comment line. ".repeat(20)}\nsecond\nthird\nfourth\nfifth`,
      5,
    ),
    done: await f.comment(issueId, bob, bobName, "Settled long ago", 4),
  };
  const rep = {
    hideA: await f.report(c.hide, r[0].id, { note: "Rude to me" }),
    hideB: await f.report(c.hide, r[1].id, { reason: "harassment" }),
    resolve: await f.report(c.resolve, r[0].id, { reason: "spam" }),
    del: await f.report(c.del, r[1].id),
    edited: await f.report(c.edited, r[0].id),
    long: await f.report(c.long, r[1].id, { reason: "other" }),
    done: await f.report(c.done, r[0].id),
  };
  await sql`update comment_reports set status = 'resolved',
    resolved_by = ${admin.id}, resolved_at = now() where id = ${rep.done}`;
  // Edited, then deleted by its author (soft: it has an open report).
  await sql`update comments set body = 'After the edit', edited_at = now()
    where id = ${c.edited}`;
  await sql`update comments set body = '', deleted_at = now() where id = ${c.edited}`;

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await f.signIn(ctx, base, admin.id);
  const page = await ctx.newPage();
  const inbox = (query = "", filter = "") =>
    page.goto(
      `${base}/admin/reports?q=${encodeURIComponent(query || f.stamp)}${filter ? `&filter=${filter}` : ""}`,
    );
  const row = (text: string): Locator =>
    page.locator("article").filter({ hasText: text });
  const badge = () =>
    page.locator('aside a[href="/admin/reports"]').innerText();

  heading("counts: the nav and the Issues page");
  await page.goto(`${base}/admin`);
  const open = await openCount();
  ok(
    (await badge()).replace(/\s+/g, " ").includes(`${open} open`),
    `the nav's Reports entry carries the open count (${open})`,
  );
  ok(
    (await page.locator("main p.text-faint").first().innerText()).includes(
      `${open} open report`,
    ),
    "the Issues summary says how many reports are open, linking the inbox",
  );

  heading("the inbox: default filter, snapshot and current state");
  await inbox();
  await page.waitForSelector("h1:has-text('Reports')");
  ok(
    (await page.locator("article").count()) === 6,
    "open filter by default: six of this run's reports",
  );
  ok(
    !(await row("Settled long ago").count()),
    "the resolved report is not in it",
  );
  const hideRow = row("Rude to me");
  const hideText = await hideRow.innerText();
  ok(
    hideText.includes("Alice Aye") &&
      hideText.includes(`Account: ${alice.name}`) &&
      hideText.includes("Rude to me") &&
      hideText.includes(`${f.stamp} Reporter A`),
    "a row shows the posting name, the account, the note and the reporter",
  );
  const link = await hideRow.locator('a[href^="/read/"]').getAttribute("href");
  ok(
    link?.endsWith(`?discussion=1&comment=${c.hide}`),
    `the issue link is the discussion deep link (${link})`,
  );
  const editedRow = row("Before the edit");
  ok(
    (await editedRow.innerText()).includes("Deleted by its author since"),
    "edited then deleted by its author: the snapshot stands, marked 'Deleted by its author since'",
  );
  ok(
    !(await editedRow.locator('a[href*="comment="]').count()),
    "…and its issue link opens the issue alone",
  );
  const longRow = row("A long comment line.");
  const toggle = longRow.getByRole("button", { name: "Show all" });
  ok(
    (await toggle.getAttribute("aria-expanded")) === "false",
    "a long snapshot is clamped with a Show all toggle",
  );
  await toggle.click();
  ok(
    (await longRow
      .getByRole("button", { name: "Show less" })
      .getAttribute("aria-expanded")) === "true",
    "…which expands it",
  );
  await page.screenshot({ path: `${shots}/inbox-open.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${shots}/inbox-phone.png` });
  await page.setViewportSize({ width: 1280, height: 900 });
  writeFileSync(
    `${shots}/inbox-aria.yml`,
    await page.locator("main").ariaSnapshot(),
  );

  heading("search and filter live in the URL");
  await page
    .getByRole("textbox", { name: /Search all reports/ })
    .fill(`${f.stamp} Reporter B`);
  await page.waitForURL(
    (u) => u.searchParams.get("q") === `${f.stamp} Reporter B`,
  );
  await page.waitForFunction(
    () => document.querySelectorAll("article").length === 3,
  );
  ok(
    true,
    "searching by reporter narrows to their three open reports, ?q= in the URL",
  );
  await page.getByRole("button", { name: /^Show: / }).click();
  await page.getByRole("menuitemradio", { name: "Resolved" }).click();
  await page.waitForURL((u) => u.searchParams.get("filter") === "resolved");
  await inbox("", "resolved");
  ok(
    (await page.locator("article").count()) === 1 &&
      (await row("Settled long ago").innerText()).includes("Resolved"),
    "?filter=resolved shows the resolved report, marked Resolved and by whom",
  );
  await page.screenshot({
    path: `${shots}/inbox-resolved.png`,
    fullPage: true,
  });
  await inbox("", "all");
  ok(
    (await page.locator("article").count()) === 7,
    "?filter=all shows all seven",
  );

  heading("keyboard: into a row, a confirmation and back");
  await inbox();
  await page.getByRole("textbox", { name: /Search all reports/ }).focus();
  const order: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
      }),
    );
  }
  console.log(`    tab order: ${order.join(" → ")}`);
  ok(order[0]?.startsWith("Show:"), "Tab from the search reaches the filter");
  ok(
    order.includes("Hide comment by Alice Aye") &&
      order.includes("Delete comment by Alice Aye"),
    "…then the first row's actions, each named for the comment",
  );
  const delAlice = page
    .getByRole("button", { name: "Delete comment by Alice Aye" })
    .first();
  await delAlice.focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("[role=dialog]");
  ok(
    await page.evaluate(
      () => document.activeElement?.textContent?.trim() === "Cancel",
    ),
    "Enter opens the delete confirmation with focus on Cancel",
  );
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(
    await delAlice.evaluate((el) => el === document.activeElement),
    "Escape closes it and focus returns to Delete comment",
  );

  heading("row actions");
  const beforeHide = await openCount();
  await row("Words to hide")
    .first()
    .getByRole("button", { name: "Hide comment by Alice Aye" })
    .click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Words to hide"),
  );
  ok(
    (await reportRow(rep.hideA)).status === "resolved" &&
      (await reportRow(rep.hideB)).status === "resolved" &&
      (await reportRow(rep.hideB)).resolved_by === admin.id &&
      (await commentRow(c.hide))?.hidden_at,
    "Hide comment hides it and resolves both its open reports as this admin",
  );
  ok(
    (await page.locator("main [role=status]").innerText()).includes(
      "Comment hidden",
    ),
    "…the outcome is announced",
  );
  await page.waitForFunction(
    (n) =>
      document
        .querySelector('aside a[href="/admin/reports"]')
        ?.textContent?.includes(`${n} open`),
    beforeHide - 2,
  );
  ok(true, `the nav count drops to ${beforeHide - 2}`);

  await row("Resolve me please")
    .getByRole("button", { name: /^Resolve report/ })
    .click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Resolve me please"),
  );
  ok(
    (await reportRow(rep.resolve)).status === "resolved" &&
      !(await commentRow(c.resolve))?.hidden_at,
    "Resolve settles the report and leaves the comment alone",
  );

  await row("Delete me please")
    .getByRole("button", { name: "Delete comment by Bob Bee" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete comment" })
    .click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Delete me please"),
  );
  const deleted = await commentRow(c.del);
  ok(
    (await reportRow(rep.del)).status === "resolved" &&
      deleted?.deleted_at &&
      deleted.body === "",
    "Delete comment (confirmed) removes it and resolves its report",
  );
  await inbox("Delete me please", "all");
  ok(
    (await row("Delete me please").innerText()).includes(
      "Removed by an admin since",
    ),
    "…and the inbox says 'Removed by an admin since' over the snapshot",
  );
  ok(
    (await row("Delete me please")
      .getByRole("button", { name: "Hide comment by Bob Bee" })
      .getAttribute("aria-disabled")) === "true",
    "…with the comment's actions unavailable now it is gone",
  );

  await inbox("A long comment line");
  await row("A long comment line")
    .getByRole("button", { name: "Clear avatar for Alice Aye" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear avatar" })
    .click();
  await until(
    async () =>
      (
        await sql`select avatar_image_id from member_names where id = ${aliceName}`
      )[0]!.avatar_image_id === null,
  );
  const [nameRow] =
    await sql`select * from member_names where id = ${aliceName}`;
  ok(
    nameRow!.avatar_image_id === null &&
      (await getObject(aliceAvatar.key)) === null,
    "Clear avatar (confirmed) clears the name's picture and deletes the object",
  );
  await row("A long comment line")
    .getByRole("button", { name: "Retire name Alice Aye" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retire name" })
    .click();
  await page.waitForSelector("button:has-text('Name retired')");
  const [retired] =
    await sql`select retired_at from member_names where id = ${aliceName}`;
  ok(
    retired!.retired_at,
    "Retire name (confirmed) retires it; the button says so",
  );
  await page.screenshot({
    path: `${shots}/inbox-after-actions.png`,
    fullPage: true,
  });

  await checkSettingsAndRemoval({
    page,
    sql,
    f,
    base,
    shots,
    ok,
    heading,
    until,
    getObject,
    alice,
    issueId,
    longComment: c.long,
  });
} catch (err) {
  failed = true;
  console.error(err instanceof Error ? err.message : err);
} finally {
  await browser.close();
  await f.cleanup();
  await sql`delete from settings`;
  if (settingsAsFound) await sql`insert into settings ${sql(settingsAsFound)}`;
  const [after] = await sql`select * from settings where id = 1`;
  const same =
    JSON.stringify(after ?? null) === JSON.stringify(settingsAsFound ?? null);
  console.log(`\nsettings row restored as found: ${same ? "yes" : "NO"}`);
  if (!same) failed = true;
  await sql.end();
}
console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
