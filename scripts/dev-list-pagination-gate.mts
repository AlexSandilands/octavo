// Dev-only: verifies the admin lists page server-side against a running dev
// server — the issues dashboard and the sponsors list carry the members list's
// control, the page lives in the URL and survives a refresh, malformed and
// out-of-range ?page= degrade to a real page, and a delete from a later page
// leaves the admin on it.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-list-pagination-gate.mts <base-url>
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { emptyIssueContent } from "../src/lib/blocks.ts";

process.loadEnvFile?.(".env.local");
// After the env file: the data-access module builds its client on import.
const { listSponsors } = await import("../src/server/sponsors.ts");
const base = process.argv[2] ?? "http://localhost:3000";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const stamp = randomUUID().slice(0, 8);
const adminEmail = `i191-gate-${stamp}@example.test`;
const userId = `i191-user-${stamp}`;
const token = `i191-session-${stamp}`;
const PAGE_SIZE = 25;

// Enough extra issues that the top page is all ours and the next page starts
// with one too — the delete-from-a-later-page check needs a row it may remove.
const EXTRA_ISSUES = PAGE_SIZE + 1;

const count = async (table: "issues" | "sponsors") => {
  const [row] = await sql`select count(*)::int as n from ${sql(table)}`;
  return row!.n as number;
};

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${userId}, ${adminEmail}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${userId}, now() + interval '1 day')`;

  // Scratch rows, prefixed so they can't be confused with the seeded fixtures.
  // Issue numbers come off the current max and the sponsors are backdated, so
  // each lands where the check needs it (both lists are newest-first).
  const [maxRow] =
    await sql`select coalesce(max(number), 0)::int as n from issues`;
  const firstNumber = (maxRow!.n as number) + 1;
  for (let i = 0; i < EXTRA_ISSUES; i++) {
    await sql`insert into issues (id, number, title, content)
              values (${randomUUID()}, ${firstNumber + i},
                      ${`i191 Issue ${String(i + 1).padStart(2, "0")}`},
                      ${sql.json(emptyIssueContent())})`;
  }
  for (const [i, name] of ["i191 Sponsor A", "i191 Sponsor B"].entries()) {
    await sql`insert into sponsors (id, name, created_at)
              values (${randomUUID()}, ${name},
                      now() - make_interval(days => ${400 + i}))`;
  }

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
  const page: Page = await ctx.newPage();

  const nav = (label: string) => page.locator(`nav[aria-label="${label}"]`);
  const status = (label: string) => nav(label).locator("span[aria-live]");
  const summary = () => page.locator("main p.text-faint").first();

  // ── Issues dashboard ──────────────────────────────────────────────────────
  const issueRows = page.locator('a[aria-label^="Edit "]');
  const issueTotal = await count("issues");
  const issuePages = Math.ceil(issueTotal / PAGE_SIZE);

  await page.goto(`${base}/admin`);
  await page.waitForSelector("h1:has-text('Issues')");
  ok(
    (await issueRows.count()) === PAGE_SIZE,
    `/admin serves one page of ${PAGE_SIZE} issues (of ${issueTotal})`,
  );
  ok(
    (await status("Issue list pages").innerText()) ===
      `Page 1 of ${issuePages}`,
    `/admin reports "Page 1 of ${issuePages}"`,
  );
  const issueSummary = (await summary().innerText()).replace(/\s+/g, " ");
  ok(
    issueSummary.startsWith(`${issueTotal} issues ·`),
    `/admin summary counts the whole list, not the page (“${issueSummary}”)`,
  );

  ok(
    (await nav("Issue list pages")
      .getByText("Previous")
      .getAttribute("aria-disabled")) === "true",
    "Previous is unavailable on page 1 (still in the tab order, not disabled)",
  );

  const firstOnPage1 = await issueRows.first().getAttribute("aria-label");
  await nav("Issue list pages").getByText("Next").click();
  await page.waitForURL((u) => u.searchParams.get("page") === "2");
  await page.waitForSelector("h1:has-text('Issues')");
  ok(
    (await status("Issue list pages").innerText()) ===
      `Page 2 of ${issuePages}`,
    "Next turns to page 2 and puts ?page=2 in the URL",
  );
  ok(
    (await issueRows.first().getAttribute("aria-label")) !== firstOnPage1,
    "page 2 shows different issues from page 1",
  );
  ok(
    (await summary().innerText()).replace(/\s+/g, " ") === issueSummary,
    "the summary is the same whole-list line on page 2",
  );

  await page.reload();
  ok(
    (await status("Issue list pages").innerText()) ===
      `Page 2 of ${issuePages}`,
    "?page=2 survives a refresh",
  );

  for (const [param, expected] of [
    ["abc", 1],
    ["-3", 1],
    ["0", 1],
    ["1.5", 1],
    ["99999", issuePages],
    ["2&page=3", 1],
  ] as const) {
    await page.goto(`${base}/admin?page=${param}`);
    await page.waitForSelector("h1:has-text('Issues')");
    ok(
      (await status("Issue list pages").innerText()) ===
        `Page ${expected} of ${issuePages}`,
      `?page=${param} degrades to page ${expected}`,
    );
  }
  await page.goto(`${base}/admin?page=${issuePages}`);
  await page.waitForSelector("h1:has-text('Issues')");
  ok(
    (await nav("Issue list pages")
      .getByText("Next")
      .getAttribute("aria-disabled")) === "true",
    "Next is unavailable on the last page",
  );

  // A delete from page 2 leaves the admin on page 2 (the scratch issue that
  // opens that page is the one removed).
  await page.goto(`${base}/admin?page=2`);
  await page.waitForSelector("h1:has-text('Issues')");
  const doomed = (await issueRows.first().getAttribute("aria-label"))!.replace(
    /^Edit /,
    "",
  );
  ok(
    doomed.startsWith("i191 Issue"),
    `page 2 opens with a scratch issue (${doomed})`,
  );
  await page.click(`button[aria-label="Delete ${doomed}"]`);
  await page.waitForSelector("[role=dialog]");
  await page.click("button:has-text('Delete issue')");
  await page.waitForFunction(
    (title) =>
      !document.querySelector(`a[aria-label="Edit ${title}"]`) &&
      document.querySelectorAll('a[aria-label^="Edit "]').length > 0,
    doomed,
  );
  ok(
    new URL(page.url()).searchParams.get("page") === "2",
    "deleting from page 2 keeps the admin on page 2",
  );
  ok(
    (await summary().innerText()).includes(`${issueTotal - 1} issues`),
    "the summary drops to the new whole-list total after the delete",
  );

  // ── Sponsors ──────────────────────────────────────────────────────────────
  const sponsorRows = page.locator('button[aria-label^="Delete "]');
  const sponsorTotal = await count("sponsors");
  const sponsorPages = Math.ceil(sponsorTotal / PAGE_SIZE);

  await page.goto(`${base}/admin/sponsors`);
  await page.waitForSelector("h1:has-text('Sponsors')");
  ok(
    (await sponsorRows.count()) === PAGE_SIZE,
    `/admin/sponsors serves one page of ${PAGE_SIZE} sponsors (of ${sponsorTotal})`,
  );
  const sponsorSummary = (await summary().innerText()).replace(/\s+/g, " ");
  // The expired tally is counted in SQL now that the page holds 25 rows; it has
  // to agree with the per-row rule the list itself flags rows by.
  const jsExpired = (await listSponsors()).filter((s) => s.expired).length;
  ok(
    sponsorSummary === `${sponsorTotal} sponsors · ${jsExpired} expired`,
    `/admin/sponsors summary counts the whole list (“${sponsorSummary}”)`,
  );

  await page.goto(`${base}/admin/sponsors?page=${sponsorPages}`);
  await page.waitForSelector("h1:has-text('Sponsors')");
  ok(
    (await status("Sponsor list pages").innerText()) ===
      `Page ${sponsorPages} of ${sponsorPages}`,
    `?page=${sponsorPages} serves the last sponsors page`,
  );
  ok(
    (await summary().innerText()).replace(/\s+/g, " ") === sponsorSummary,
    "the sponsors summary is the same whole-list line on the last page",
  );
  await page.click('button[aria-label="Delete i191 Sponsor B"]');
  await page.waitForSelector("[role=dialog]");
  await page.click("button:has-text('Delete sponsor')");
  await page.waitForSelector('button[aria-label="Delete i191 Sponsor B"]', {
    state: "detached",
  });
  ok(
    new URL(page.url()).searchParams.get("page") === String(sponsorPages) &&
      (await page
        .locator('button[aria-label="Delete i191 Sponsor A"]')
        .count()) === 1,
    `deleting from page ${sponsorPages} keeps the admin on page ${sponsorPages}`,
  );

  // ── The shared control on a single page (the members list, unchanged) ─────
  await page.goto(`${base}/admin/members?q=${encodeURIComponent(adminEmail)}`);
  await page.waitForSelector("h1:has-text('Members')");
  ok(
    (await nav("Member list pages").count()) === 0,
    "a single page renders no pagination control (members, one match)",
  );

  // ── Mobile ────────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, label] of [
    ["/admin?page=2", "Issue list pages"],
    ["/admin/sponsors?page=2", "Sponsor list pages"],
  ] as const) {
    await page.goto(`${base}${path}`);
    await page.waitForSelector(`nav[aria-label="${label}"]`);
    const box = (await nav(label).boundingBox())!;
    const next = (await nav(label).getByText("Next").boundingBox())!;
    ok(
      box.x >= 0 && box.x + box.width <= 390 && next.height >= 44,
      `${path} at 390px: the control fits the viewport with a ${Math.round(next.height)}px tap target`,
    );
  }

  console.log("\nall list-pagination checks passed");
} finally {
  await browser.close();
  await sql`delete from issues where title like 'i191 %'`;
  await sql`delete from sponsors where name like 'i191 %'`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${userId}`;
  await sql.end();
}
// The imported data-access module holds a pool of its own open.
process.exit(0);
