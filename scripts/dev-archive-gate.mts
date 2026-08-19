// Dev-only: verifies the library's back catalogue against a running dev server
// — the home page serves a capped run of back-issues and offers the archive
// only when there are more, and /archive pages, searches and filters by year
// with all three living in the URL. Signed-out access is checked through the
// real magic-link flow, so the ?next= round trip is exercised end to end.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-archive-gate.mts <base-url> <dev-log-path>
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import { emptyIssueContent } from "../src/lib/blocks.ts";
import {
  ARCHIVE_PAGE_SIZE,
  HOME_ARCHIVE_MAX,
} from "../src/features/library/archive-limits.ts";

process.loadEnvFile?.(".env.local");
const [base, logPath] = process.argv.slice(2);
if (!base || !logPath)
  throw new Error("usage: dev-archive-gate.mts <base-url> <dev-log>");

// A real member the dev database always holds; the console transport logs its
// magic link, so no session has to be forged for this run.
const MEMBER = "member@example.com";

// The one row this run creates, stamped and deleted by its tracked id: two runs
// against the shared dev database must not select or clean up each other's.
const stamp = randomUUID().slice(0, 8);
const boundaryTitle = `i192 ${stamp} Boundary`;
let boundaryId: string | undefined;

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const lastMagicLink = async () => {
  const log = await readFile(logPath, "utf8");
  const links = [...log.matchAll(/\[auth\] {3}(http\S+)/g)].map((m) => m[1]);
  return links.at(-1);
};

// What the database says the shelf should hold, so nothing below is hardcoded
// against one snapshot of the dev data.
const published = async (where = sql``) => {
  const [row] = await sql`select count(*)::int as n from issues
                          where status = 'published' ${where}`;
  return row!.n as number;
};

const browser = await chromium.launch();
let sessionToken: string | undefined;
try {
  const ctx = await browser.newContext();
  const page: Page = await ctx.newPage();

  const cards = page.locator('main a[href^="/read/"]');
  const nav = page.locator('nav[aria-label="Archive pages"]');
  // The house MenuSelect names itself on its trigger ("Year: All years").
  const yearTrigger = page.getByRole("button", { name: /^Year:/ });

  // The two lines that say what the shelf is showing. Polled by textContent
  // rather than read once: a soft navigation changes the URL before the server
  // has streamed the new view back, and the live region is sr-only whenever
  // there are covers, so its text is the only thing to assert on.
  const STATUS = 'nav[aria-label="Archive pages"] span[aria-live]';
  const RESULT = 'p[role="status"]';
  const says = async (selector: string, text: string) => {
    try {
      await page.waitForFunction(
        (want) =>
          document.querySelector(want.selector)?.textContent === want.text,
        { selector, text },
        { timeout: 8000 },
      );
      return true;
    } catch {
      console.log(`   (saw “${await page.locator(selector).textContent()}”)`);
      return false;
    }
  };

  // ── Signed out: the edge gate carries the destination ─────────────────────
  await page.goto(`${base}/archive`);
  await page.waitForURL("**/signin**");
  ok(
    new URL(page.url()).searchParams.get("next") === "/archive",
    "signed-out /archive redirects to /signin?next=/archive",
  );

  // ── …and the magic link comes back to it ──────────────────────────────────
  await page.fill("#email", MEMBER);
  await page.click("button[type=submit]");
  await page.waitForURL("**/signin/sent");
  const link = await lastMagicLink();
  ok(link, "magic link appeared in the dev log");
  await page.goto(link!);
  await page.waitForLoadState();
  ok(
    new URL(page.url()).pathname === "/archive",
    "signing in returns the member to /archive",
  );
  sessionToken = (await ctx.cookies()).find(
    (c) => c.name === "authjs.session-token",
  )?.value;

  const total = await published();
  const archivePages = Math.ceil(total / ARCHIVE_PAGE_SIZE);

  // ── Home page: the featured issue plus a capped run ───────────────────────
  await page.goto(`${base}/`);
  await page.waitForSelector("main");
  // The hero's cover and its "Read this issue" both point at the same issue,
  // so the shelf is what is left once the featured issue's links are removed.
  const homeLinks = await cards.evaluateAll((els) =>
    els.map((e) => e.getAttribute("href")!),
  );
  const homeIssues = new Set(homeLinks);
  ok(
    homeIssues.size === HOME_ARCHIVE_MAX + 1,
    `the home page links ${HOME_ARCHIVE_MAX} back-issues below the featured one (of ${total} published)`,
  );
  const archiveLink = page.getByRole("link", { name: "View the full archive" });
  ok(
    (await archiveLink.count()) === 1 &&
      (await archiveLink.getAttribute("href")) === "/archive",
    "“View the full archive” is offered once the catalogue outgrows the shelf",
  );
  // The affordance is conditional on the same number: a catalogue of
  // HOME_ARCHIVE_MAX + 1 or fewer leaves nothing older, so an early tenant's
  // home page keeps every issue and no link.
  ok(
    total > HOME_ARCHIVE_MAX + 1,
    `the dev catalogue exercises the capped case (${total} published)`,
  );
  const box = (await archiveLink.boundingBox())!;
  ok(
    box.height >= 44,
    `the archive link is a ${Math.round(box.height)}px target`,
  );

  // ── /archive: one page of covers, and the whole catalogue behind it ───────
  await archiveLink.click();
  await page.waitForURL("**/archive");
  await page.waitForSelector("h1:has-text('The archive')");
  ok(
    (await cards.count()) === ARCHIVE_PAGE_SIZE,
    `/archive serves one page of ${ARCHIVE_PAGE_SIZE} covers`,
  );
  ok(
    await says(STATUS, `Page 1 of ${archivePages}`),
    `/archive reports "Page 1 of ${archivePages}"`,
  );
  ok(
    await says(RESULT, `Showing ${total} issues.`),
    `the live region counts the whole archive (${total})`,
  );

  const firstOnPage1 = await cards.first().getAttribute("href");
  await nav.getByText("Next").click();
  await page.waitForURL((u) => u.searchParams.get("page") === "2");
  ok(
    (await says(STATUS, `Page 2 of ${archivePages}`)) &&
      (await cards.first().getAttribute("href")) !== firstOnPage1,
    "Next turns to page 2, puts ?page=2 in the URL and serves different covers",
  );
  await page.reload();
  ok(
    await says(STATUS, `Page 2 of ${archivePages}`),
    "?page=2 survives a refresh",
  );
  await page.goBack();
  await page.waitForURL((u) => u.searchParams.get("page") === null);
  ok(await says(STATUS, `Page 1 of ${archivePages}`), "Back returns to page 1");

  for (const [param, expected] of [
    ["abc", 1],
    ["-3", 1],
    ["0", 1],
    ["1.5", 1],
    ["99999", archivePages],
    ["2&page=3", 1],
  ] as const) {
    await page.goto(`${base}/archive?page=${param}`);
    await page.waitForSelector("h1:has-text('The archive')");
    ok(
      await says(STATUS, `Page ${expected} of ${archivePages}`),
      `?page=${param} degrades to page ${expected}`,
    );
  }

  // ── Title search ──────────────────────────────────────────────────────────
  const term = "Test Issue 05";
  const matching = await published(sql`and title ilike ${`%${term}%`}`);
  ok(matching > 0, `the dev data has ${matching} issues matching “${term}”`);
  await page.goto(`${base}/archive?page=2`);
  await page.waitForSelector("h1:has-text('The archive')");
  await page.fill('input[aria-label^="Search every issue"]', term);
  await page.waitForURL((u) => u.searchParams.get("q") === term);
  ok(
    new URL(page.url()).searchParams.get("page") === null,
    "a new search drops ?page= and starts from the first page",
  );
  ok(
    (await cards.count()) === Math.min(matching, ARCHIVE_PAGE_SIZE) &&
      (await says(RESULT, `${matching} issues match “${term}”.`)),
    `searching “${term}” narrows the shelf to ${matching} and announces it`,
  );
  await page.reload();
  ok(
    (await page.inputValue('input[aria-label^="Search every issue"]')) === term,
    "the search box is restored from ?q= after a refresh",
  );

  // ── Year filter, composed with the search ─────────────────────────────────
  const [yearRow] = await sql`select extract(year from published_at)::int as y,
                                     count(*)::int as n
                              from issues where status = 'published'
                              group by 1 order by n desc limit 1`;
  const year = yearRow!.y as number;
  const inYear = yearRow!.n as number;
  const both = await published(
    sql`and title ilike ${`%${term}%`}
        and extract(year from published_at) = ${year}`,
  );

  await yearTrigger.click();
  await page
    .getByRole("menuitemradio", { name: String(year), exact: true })
    .click();
  await page.waitForURL((u) => u.searchParams.get("year") === String(year));
  ok(
    new URL(page.url()).searchParams.get("q") === term,
    "picking a year keeps the search in the URL",
  );
  ok(
    await says(RESULT, `${both} issues from ${year} match “${term}”.`),
    `the search and the year compose (${both} issues)`,
  );
  await page.goBack();
  await page.waitForURL((u) => u.searchParams.get("year") === null);
  ok(
    await says(RESULT, `${matching} issues match “${term}”.`),
    "Back undoes the year and leaves the search standing",
  );

  await page.goto(`${base}/archive?year=${year}`);
  await page.waitForSelector("h1:has-text('The archive')");
  ok(
    await says(RESULT, `Showing ${inYear} issues from ${year}.`),
    `?year=${year} alone shows that year's ${inYear} issues`,
  );
  ok(
    (await yearTrigger.textContent())!.includes(String(year)),
    "the filter's trigger names the active year",
  );
  await page.goto(`${base}/archive?year=1066`);
  await page.waitForSelector("h1:has-text('The archive')");
  ok(
    (await says(RESULT, `Showing ${total} issues.`)) &&
      (await yearTrigger.textContent())!.includes("All years"),
    "a year nothing was published in degrades to all years",
  );
  await page.goto(`${base}/archive?year=abc&q=${"z".repeat(400)}`);
  await page.waitForSelector("h1:has-text('The archive')");
  ok(
    (await page.locator(RESULT).textContent())!.startsWith("No issues match"),
    "a malformed ?year= and an overlong ?q= still render a valid view",
  );

  // ── Mobile ────────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/archive?page=2"] as const) {
    await page.goto(`${base}${path}`);
    await page.waitForSelector("main");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    ok(overflow <= 0, `${path} at 390px does not scroll horizontally`);
  }
  const trigger = (await yearTrigger.boundingBox())!;
  // The field is a <label>, so the whole box focuses the input — measure that,
  // not the input's own text line.
  const search = (await page
    .locator('label:has(input[aria-label^="Search every issue"])')
    .boundingBox())!;
  ok(
    trigger.height >= 44 &&
      trigger.x >= 0 &&
      trigger.x + trigger.width <= 390 &&
      search.height >= 44,
    `at 390px the search and the year filter are ${Math.round(search.height)}px and ${Math.round(trigger.height)}px targets inside the viewport`,
  );
  const nextBox = (await nav.getByText("Next").boundingBox())!;
  ok(
    nextBox.height >= 44 && nextBox.x + nextBox.width <= 390,
    `the page control keeps a ${Math.round(nextBox.height)}px target at 390px`,
  );
  await page.setViewportSize({ width: 1280, height: 900 });

  // ── One year, one clock ───────────────────────────────────────────────────
  // Postgres and Node need not share a session timezone, so an issue published
  // just after local New Year falls in one year for the SQL filter and the
  // other for the shelf's JS-grouped headings. Everything the archive says
  // about a year has to agree, whatever the two zones are. Left until last: the
  // scratch row moves the counts every check above is asserted against.
  const [maxRow] = await sql`select coalesce(max(number), 0)::int as n,
                                    coalesce(max(extract(year from published_at)), 0)::int as y
                             from issues`;
  const jsYear = (maxRow!.y as number) + 1;
  // 00:30 on 1 January, in *Node's* zone — the instant whose UTC year differs
  // wherever the machine is ahead of UTC.
  const at = new Date(jsYear, 0, 1, 0, 30);
  ok(at.getFullYear() === jsYear, `the scratch issue is ${jsYear} in Node`);
  boundaryId = randomUUID();
  await sql`insert into issues (id, number, title, status, published_at, content)
            values (${boundaryId}, ${(maxRow!.n as number) + 1},
                    ${boundaryTitle}, 'published', ${at},
                    ${sql.json(emptyIssueContent())})`;

  await page.goto(`${base}/archive?year=${jsYear}`);
  await page.waitForSelector("h1:has-text('The archive')");
  ok(
    await says(RESULT, `Showing 1 issue from ${jsYear}.`),
    `?year=${jsYear} finds the issue published just after local New Year`,
  );
  ok(
    (await page.getByText(boundaryTitle).count()) === 1,
    "the filtered shelf shows that issue",
  );
  // exact, so the filter's own "Year: <n>" trigger is not what matches.
  const heads = (year: number) =>
    page.locator("main").getByText(String(year), { exact: true }).count();
  ok(
    (await heads(jsYear)) > 0 && (await heads(jsYear - 1)) === 0,
    `the shelf heads it "${jsYear}" — the same year the filter matched on`,
  );
  ok(
    (await page.getByRole("button", { name: `Year: ${jsYear}` }).count()) === 1,
    `the year menu offers ${jsYear} and names it on the trigger`,
  );
  await page.goto(`${base}/archive?year=${jsYear - 1}`);
  await page.waitForSelector("h1:has-text('The archive')");
  ok(
    (await page.getByText(boundaryTitle).count()) === 0,
    `?year=${jsYear - 1} does not claim it — the UTC reading of the same instant`,
  );

  console.log("\nall archive checks passed");
} finally {
  await browser.close();
  // By tracked id, and only the session this run signed in with — other agents
  // share this database, and the member row itself is a fixture we never touch.
  if (boundaryId) await sql`delete from issues where id = ${boundaryId}`;
  if (sessionToken)
    await sql`delete from sessions where session_token = ${sessionToken}`;
  await sql.end();
}
