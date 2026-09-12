// Dev-only: proves the issue number is allocated at publish, not at create
// (issue #270), headless against a running dev server.
//
// What it covers, in order:
//   1. creating a draft through the dashboard allocates nothing — the row's
//      `number` is NULL, the editor chip says "Draft" with no number, the
//      dashboard row shows no "No. …", and the canvas running head previews
//      the number publishing would propose,
//   2. publishing under the proposed number,
//   3. publishing under an edited number,
//   4. a non-positive / non-integer / already-taken number is refused with a
//      legible message and the modal stays open, the issue still a draft,
//   5. deleting a published issue frees its number — the next publish proposes
//      it again,
//   6. ordering: a lower number published last does not become "latest", on
//      the home page or in the archive,
//   7. two publishes racing the same number: one wins, the other is told.
//
// It mints its own admin, session and issues — numbered far above whatever the
// database holds so every proposal below is deterministic — and deletes them
// again by tracked id in the finally block. It never seeds and never touches an
// existing row.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-issue-number-gate.mts <base-url>
import { randomUUID } from "node:crypto";
import { chromium, type Browser, type Page } from "playwright";
import postgres from "postgres";
import { emptyIssueContent } from "../src/lib/blocks.ts";
import { nextIssueNumber, publishIssue } from "../src/server/issues.ts";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: dev-issue-number-gate.mts <base-url>");

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

// Every row this run creates is stamped and deleted by its tracked id, so two
// runs against the same dev database can't select or clean up each other's.
const stamp = randomUUID().slice(0, 8);
const tag = `i270 ${stamp}`;
const adminId = randomUUID();
const token = randomUUID();
const adminEmail = `i270-${stamp}@example.invalid`;
const scratchIds: string[] = [];

const rowOf = async (id: string) => {
  const [row] = await sql<{ number: number | null; status: string }[]>`
    select number, status from issues where id = ${id}`;
  return row ?? null;
};

/** A draft minted straight into the database, titled so the lists can find it. */
const mintDraft = async (title: string) => {
  const id = randomUUID();
  await sql`insert into issues (id, title, status, content)
            values (${id}, ${title}, 'draft', ${sql.json(emptyIssueContent())})`;
  scratchIds.push(id);
  return id;
};

// ── Browser helpers ─────────────────────────────────────────────────────────

const PUBLISH_TRIGGER = "header button:text-is('Publish')";
const NUMBER_FIELD = '[role=dialog] input[type="number"]';

/** Open the editor's publish modal and answer with the number it proposes. */
async function openPublishModal(page: Page, issueId: string) {
  await page.goto(`${base}/admin/issues/${issueId}/edit`);
  await page.waitForSelector(PUBLISH_TRIGGER);
  await page.click(PUBLISH_TRIGGER);
  await page.waitForSelector("[role=dialog]");
  return Number(await page.inputValue(NUMBER_FIELD));
}

/**
 * Clear the email opt-in. A first publish defaults it ON, and on a shared dev
 * database that is a real blast at every subscribed member. It also settles the
 * publish button's label, which follows the tickbox.
 */
async function clearEmail(page: Page) {
  const optIn = page.locator("[role=dialog] input[type=checkbox]");
  if (await optIn.isChecked()) await optIn.uncheck();
  ok(
    !(await optIn.isChecked()),
    "the email opt-in is cleared — this publish sends nothing",
  );
}

async function pressPublish(page: Page) {
  await clearEmail(page);
  await page.click("[role=dialog] button:text-is('Publish')");
}

/** The modal's text, for asserting on the refusal it shows. */
const dialogText = (page: Page) => page.locator("[role=dialog]").innerText();

/** The issue numbers the shelf at `url` lists, in the order it lists them. */
const shelfNumbers = async (page: Page, url: string) => {
  await page.goto(url);
  await page.waitForSelector("main");
  return page.evaluate(() =>
    [...document.querySelectorAll("main a[href^='/read/']")]
      .map((a) => Number(a.getAttribute("href")!.split("/read/")[1]))
      .filter((n) => Number.isInteger(n)),
  );
};

let browser: Browser | undefined;
try {
  // ── Scratch fixtures ──────────────────────────────────────────────────────
  heading("fixtures");
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${adminId}, ${adminEmail}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${adminId}, now() + interval '1 day')`;

  // One published issue numbered clear of everything the database holds, so
  // every proposal below is `high + 1` and nothing here depends on the data.
  const [top] = await sql<{ n: number }[]>`
    select coalesce(max(number), 0)::int as n from issues where status = 'published'`;
  const high = top!.n + 1000;
  const anchorId = randomUUID();
  await sql`insert into issues (id, number, title, status, published_at, content)
            values (${anchorId}, ${high}, ${`${tag} Anchor`}, 'published', now(),
                    ${sql.json(emptyIssueContent())})`;
  scratchIds.push(anchorId);
  ok(
    (await nextIssueNumber()) === high + 1,
    `the anchor is No. ${high}, so nextIssueNumber() proposes No. ${high + 1}`,
  );

  browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await ctx.newPage();

  // ── 1. Creating a draft allocates nothing ─────────────────────────────────
  heading("a draft has no number");
  await page.goto(`${base}/admin`);
  // The create is a server action that redirects into the editor. Wait on the
  // editor itself rather than a navigation event: under a production build the
  // redirect arrives as a router transition, with no page load to wait for.
  await page.click("button:has-text('Create new issue')");
  await page.waitForSelector(PUBLISH_TRIGGER, { timeout: 60_000 });
  const firstId = page.url().match(/\/issues\/([^/]+)\/edit/)![1]!;
  scratchIds.push(firstId);
  ok((await rowOf(firstId))!.number === null, "createIssue wrote no number");

  // Titled here rather than through the editor so the lists below can find this
  // row among however many "Untitled draft"s the database already holds.
  await sql`update issues set title = ${`${tag} Proposed`} where id = ${firstId}`;
  await page.reload();
  await page.waitForSelector(PUBLISH_TRIGGER);
  const chip = await page.locator("header").innerText();
  ok(chip.includes("Draft"), "the editor chip reads Draft");
  ok(!chip.includes("No. "), `the chip names no number (header: ${chip})`);
  // textContent, not innerText: the masthead is set in small caps by CSS, and
  // innerText would report the transformed text.
  ok(
    (
      await page.locator("[data-page-masthead]").first().textContent()
    )?.includes(`No. ${high + 1}`),
    `the canvas running head previews the proposed No. ${high + 1}`,
  );

  await page.goto(`${base}/admin?q=${stamp}`);
  await page.waitForSelector(`text=${tag} Proposed`);
  const list = await page.locator("main").innerText();
  // The row prints "No. …" immediately after its title, so what follows the
  // draft's title is where a number would be if it had one.
  ok(
    !list.split(`${tag} Proposed`)[1]!.trimStart().startsWith("No."),
    "the draft's dashboard row shows no number",
  );
  ok(list.includes(`No. ${high}`), "the published row still shows its number");
  ok(
    list.indexOf(`${tag} Proposed`) < list.indexOf(`${tag} Anchor`),
    "the dashboard lists the draft above the published issue",
  );

  // ── 2. Publishing under the proposed number ───────────────────────────────
  heading("publish under the proposed number");
  const proposed = await openPublishModal(page, firstId);
  ok(proposed === high + 1, `the modal proposes No. ${high + 1}`);
  await pressPublish(page);
  await page.waitForSelector("[role=dialog] button:has-text('Done')", {
    timeout: 30_000,
  });
  ok(
    (await page.locator("[role=dialog] h2").innerText()) ===
      `Issue No. ${high + 1} is live.`,
    `the result names No. ${high + 1}`,
  );
  const firstRow = await rowOf(firstId);
  ok(
    firstRow!.number === high + 1 && firstRow!.status === "published",
    `the row is published as No. ${high + 1}`,
  );
  await page.click("[role=dialog] button:has-text('Done')");
  ok(
    (await page.locator("header").innerText()).includes(`No. ${high + 1}`),
    "the editor chip now names the allocated number",
  );

  // The number it was published under is its public address.
  const read = await page.goto(`${base}/read/${high + 1}`);
  ok(read!.status() === 200, `/read/${high + 1} serves the published issue`);

  // ── 3. Publishing under an edited number ──────────────────────────────────
  heading("publish under an edited number");
  const editedId = await mintDraft(`${tag} Edited`);
  ok(
    (await openPublishModal(page, editedId)) === high + 2,
    `the modal proposes No. ${high + 2}`,
  );
  await page.fill(NUMBER_FIELD, String(high + 7));
  await pressPublish(page);
  await page.waitForSelector("[role=dialog] button:has-text('Done')", {
    timeout: 30_000,
  });
  ok(
    (await page.locator("[role=dialog] h2").innerText()) ===
      `Issue No. ${high + 7} is live.`,
    `the result names the typed No. ${high + 7}`,
  );
  ok(
    (await rowOf(editedId))!.number === high + 7,
    `the row is published as the typed No. ${high + 7}`,
  );

  // ── 4. Refusals ───────────────────────────────────────────────────────────
  heading("refusals");
  const reuseId = await mintDraft(`${tag} Reuse`);
  ok(
    (await openPublishModal(page, reuseId)) === high + 8,
    `the modal proposes No. ${high + 8} (past the edited one)`,
  );

  await clearEmail(page);
  for (const bad of ["0", "-3", "2.5"]) {
    await page.fill(NUMBER_FIELD, bad);
    await page.click("[role=dialog] button:text-is('Publish')");
    await page.waitForTimeout(200);
    ok(
      (await dialogText(page)).includes("whole number between 1 and"),
      `"${bad}" is refused with a legible message`,
    );
    ok(
      await page.isVisible("[role=dialog]"),
      `the modal stayed open for "${bad}"`,
    );
  }
  ok(
    (await rowOf(reuseId))!.status === "draft",
    "a refused number published nothing",
  );

  // The duplicate: a number already carried by a published issue.
  await page.fill(NUMBER_FIELD, String(high + 7));
  await pressPublish(page);
  await page.waitForSelector(`text=No. ${high + 7} is already published`, {
    timeout: 30_000,
  });
  ok(true, `No. ${high + 7} is refused as already published`);
  ok(
    (await page.inputValue(NUMBER_FIELD)) === String(high + 8),
    `the field is re-offered the free No. ${high + 8}`,
  );
  const reuseRow = await rowOf(reuseId);
  ok(
    reuseRow!.status === "draft" && reuseRow!.number === null,
    "the duplicate left the issue an unnumbered draft",
  );

  // ── 5. Deleting a published issue frees its number ────────────────────────
  // A mistaken publication, taken at the top of the sequence and deleted from
  // the dashboard: the number it held is the one the next publish proposes.
  heading("delete frees the number");
  const mistakeId = await mintDraft(`${tag} Mistake`);
  ok(
    (await openPublishModal(page, mistakeId)) === high + 8,
    `the mistaken publication takes the proposed No. ${high + 8}`,
  );
  await pressPublish(page);
  await page.waitForSelector("[role=dialog] button:has-text('Done')", {
    timeout: 30_000,
  });
  ok(
    (await nextIssueNumber()) === high + 9,
    `No. ${high + 8} is taken, so the proposal moves on to No. ${high + 9}`,
  );

  await page.goto(`${base}/admin?q=${stamp}`);
  await page.click(`button[aria-label="Delete ${tag} Mistake"]`);
  await page.waitForSelector("[role=dialog] button:has-text('Delete issue')");
  await page.click("[role=dialog] button:has-text('Delete issue')");
  await page.waitForSelector(`text=${tag} Mistake`, { state: "detached" });
  ok((await rowOf(mistakeId)) === null, "the mistaken publication is gone");
  ok(
    (await nextIssueNumber()) === high + 8,
    `the freed No. ${high + 8} is proposed again`,
  );
  ok(
    (await openPublishModal(page, reuseId)) === high + 8,
    `the modal proposes the freed No. ${high + 8}`,
  );
  await pressPublish(page);
  await page.waitForSelector("[role=dialog] button:has-text('Done')", {
    timeout: 30_000,
  });
  ok(
    (await rowOf(reuseId))!.number === high + 8,
    "the freed number was reused for a different issue",
  );

  // ── 6. A lower number published last is not "latest" ──────────────────────
  heading("ordering");
  const backId = await mintDraft(`${tag} Back issue`);
  await openPublishModal(page, backId);
  await page.fill(NUMBER_FIELD, String(high + 3));
  await pressPublish(page);
  await page.waitForSelector("[role=dialog] button:has-text('Done')", {
    timeout: 30_000,
  });
  ok(
    (await rowOf(backId))!.number === high + 3,
    `No. ${high + 3} was published after No. ${high + 7} exists`,
  );

  const home = await shelfNumbers(page, `${base}/`);
  ok(
    home[0] === high + 8,
    `the home page still features No. ${high + 8} as latest (got No. ${home[0]})`,
  );
  const archive = await shelfNumbers(page, `${base}/archive?q=${stamp}`);
  ok(
    archive.join(",") ===
      [high + 8, high + 7, high + 3, high + 1, high].join(","),
    `the archive orders by number, not by publication date (got ${archive.join(", ")})`,
  );

  // ── 7. Two publishes racing the same number ───────────────────────────────
  heading("concurrent publishes");
  const raceA = await mintDraft(`${tag} Race A`);
  const raceB = await mintDraft(`${tag} Race B`);
  const contested = high + 20;
  const [a, b] = await Promise.all([
    publishIssue(raceA, contested),
    publishIssue(raceB, contested),
  ]);
  const winners = [a, b].filter((r) => r.ok);
  const losers = [a, b].filter((r) => !r.ok);
  ok(winners.length === 1, `exactly one publish took No. ${contested}`);
  ok(
    losers.length === 1 && !losers[0]!.ok && losers[0]!.reason === "taken",
    `the other was told the number is taken (got ${JSON.stringify(losers[0])})`,
  );
  const [rA, rB] = [await rowOf(raceA), await rowOf(raceB)];
  ok(
    [rA, rB].filter((r) => r!.number === contested).length === 1,
    `only one row carries No. ${contested}`,
  );
  ok(
    [rA, rB].filter((r) => r!.status === "draft" && r!.number === null)
      .length === 1,
    "the loser is still an unnumbered draft",
  );

  console.log("\nALL CHECKS PASSED");
} finally {
  if (browser) await browser.close();
  if (scratchIds.length > 0) {
    await sql`delete from issues where id in ${sql(scratchIds)}`;
  }
  await sql`delete from issues where title like ${`${tag}%`}`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
  console.log("scratch rows removed");
}
process.exit(0);
