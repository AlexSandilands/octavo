// The assistant usage page's half of dev-admin-gate.mts (issue #314): admin
// only, its figures against the budget arithmetic, headings and table
// semantics, a keyboard walk from the month picker to the table, and the
// sidebar entry that shows only while the assistant is on.
//
// It seeds its own ledger in February 2001, a month nothing else writes, tags
// every row with a per-run id and deletes exactly those rows in the finally.
// The allowance is the server's AI_MONTHLY_BUDGET_USD: run the gate with the
// same value the dev server was started with (unset on both is 0).
import type { BrowserContext, Page } from "playwright";
import type postgres from "postgres";

type Deps = {
  sql: postgres.Sql;
  base: string;
  anon: BrowserContext;
  member: BrowserContext;
  adminPage: Page;
  ok: (cond: unknown, msg: string) => void;
};

const MONTH = "2001-02";
// The picker starts at the ledger's first month, so the empty one is after.
const EMPTY_MONTH = "2001-03";
const usd = (n: number) => `US$${n.toFixed(2)}`;
// The page's rounding (src/features/ai-usage/format.ts): spend up, what's left
// down, each from the ledger's millionths.
const hundredths = (n: number) => Math.round(n * 1_000_000) / 10_000;
const usdUp = (n: number) => usd(Math.ceil(hundredths(n)) / 100);
const usdDown = (n: number) => usd(Math.floor(hundredths(n)) / 100);

export async function checkAiUsagePage(d: Deps) {
  const { sql, base, adminPage: page, ok } = d;
  const tag = `admin-gate-${crypto.randomUUID()}`;
  try {
    // Three days; one run crosses midnight UTC, so the month has 3 runs, not
    // 4. The last day costs under a cent.
    const rows = [
      [`${tag}-a`, 10, 50_000, 2_000, 400, 0.041, "2001-02-03T10:00:00Z"],
      [`${tag}-a`, 5, 60_000, 0, 300, 0.023, "2001-02-03T23:59:59Z"],
      [`${tag}-b`, 7, 40_000, 100, 200, 0.019, "2001-02-04T00:00:00Z"],
      [`${tag}-a`, 3, 61_000, 0, 250, 0.022, "2001-02-04T00:00:30Z"],
      [`${tag}-c`, 1, 1_000, 0, 10, 0.004, "2001-02-05T09:00:00Z"],
    ] as const;
    for (const [run, prompt, read, write, out, cost, at] of rows) {
      await sql`insert into ai_usage (id, run_id, model, provider,
          prompt_tokens, cache_read_tokens, cache_write_tokens,
          completion_tokens, cost_usd, created_at)
        values (${crypto.randomUUID()}, ${run}, 'claude-sonnet-5', 'anthropic',
          ${prompt}, ${read}, ${write}, ${out}, ${cost}, ${at})`;
    }
    await sql`insert into ai_grants (id, amount_usd, note, created_at)
      values (${crypto.randomUUID()}, 4, ${tag}, '2001-02-10T00:00:00Z')`;
    const spent = rows.reduce((n, r) => n + r[5], 0);
    // One ledger row per request; Tokens is all four counts.
    const requests = rows.length;
    const tokens = rows.reduce((n, r) => n + r[1] + r[2] + r[3] + r[4], 0);
    const allowance = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 0);
    const remaining = Math.max(0, allowance + 4 - spent);

    // ── Admin only ──────────────────────────────────────────────────────────
    const anonPage = await d.anon.newPage();
    await anonPage.goto(`${base}/admin/ai`);
    await anonPage.waitForURL("**/signin");
    ok(true, "signed out: /admin/ai → /signin");
    const memberPage = await d.member.newPage();
    await memberPage.goto(`${base}/admin/ai?month=${MONTH}`);
    await memberPage.waitForURL((u) => u.pathname === "/");
    ok(true, "member: /admin/ai → / (library)");
    await Promise.all([anonPage.close(), memberPage.close()]);

    // ── Figures against the arithmetic ──────────────────────────────────────
    await page.goto(`${base}/admin/ai?month=${MONTH}`);
    await page.getByRole("heading", { name: "Day by day" }).waitFor();
    const text = (sel: string) =>
      page
        .locator(sel)
        .allInnerTexts()
        .then((t) => t.map((s) => s.trim()));
    ok(
      (await text("h1")).join() === "Assistant usage",
      "one h1: Assistant usage",
    );
    const h2s = await text("main h2");
    ok(
      h2s.includes("February 2001") && h2s.includes("Day by day"),
      `h2s name the month and the table (${h2s.join(" / ")})`,
    );
    const figures = await text("dl > div");
    ok(
      figures[0]?.startsWith("Used") && figures[0].includes(usdUp(spent)),
      `Used is ${usdUp(spent)} (${figures[0]})`,
    );
    ok(
      figures[1]?.includes(usdDown(remaining)),
      `left unused is ${usdDown(remaining)} (${figures[1]})`,
    );
    ok(
      figures[2]?.includes(usd(allowance + 4)) &&
        figures[2].includes(`including ${usd(4)} topped up`),
      `allowance is ${usd(allowance + 4)} including the grant (${figures[2]})`,
    );
    const enabled = Boolean(process.env.AI_PROVIDER);
    const offLine = page.getByText(
      "The assistant is not enabled on this site.",
    );
    ok(
      (await offLine.count()) === (enabled ? 0 : 1),
      `the "not enabled" line shows only while AI_PROVIDER is unset (${enabled ? "set" : "unset"})`,
    );

    // ── Table semantics ─────────────────────────────────────────────────────
    const table = page.locator("table");
    ok(
      (await table.locator("caption").count()) === 1,
      "the table has a caption",
    );
    const cols = await table.locator("thead th[scope=col]").allInnerTexts();
    ok(
      cols.map((c) => c.toLowerCase()).join() ===
        "day,runs,requests,tokens,cost",
      `column headers (${cols.join(", ")})`,
    );
    const days = await table.locator("tbody th[scope=row]").allInnerTexts();
    ok(
      days.length === 3 && days[0]!.includes("5 Feb"),
      `three day rows, newest first (${days.join(", ")})`,
    );
    const subCent = await table.locator("tbody tr").first().innerText();
    ok(
      subCent.includes("less than a cent"),
      `a day under a cent doesn't read as US$0.00 (${subCent.replace(/\s+/g, " ")})`,
    );
    const foot = await table.locator("tfoot tr").innerText();
    const allTokens = tokens.toLocaleString("en-NZ");
    ok(
      foot.includes("Month total") &&
        foot.split(/\s+/).includes("3") &&
        foot.includes(allTokens) &&
        foot.includes(usdUp(spent)),
      `the foot counts 3 runs once each, ${allTokens} tokens (all four counts) and ${usdUp(spent)} (${foot.replace(/\s+/g, " ")})`,
    );

    // ── The note under the figures ──────────────────────────────────────────
    const note = `In February 2001 the assistant answered 3 messages, about ${usd(spent / requests)} a request. When the month’s allowance is used up, the assistant stops until the next month; the site owner can raise it.`;
    ok(
      (await page.getByText(note, { exact: true }).count()) === 1,
      `the note reads as the owner asked`,
    );

    // ── Keyboard: month picker → table, then choose a month ────────────────
    await page.locator("body").focus();
    const trigger = page.getByRole("button", { name: /Month: February 2001/ });
    const region = page.getByRole("region", { name: /Use by day/ });
    const reached: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      if (await trigger.evaluate((el) => el === document.activeElement))
        reached.push("month");
      if (await region.evaluate((el) => el === document.activeElement)) {
        reached.push("table");
        break;
      }
    }
    ok(
      reached.join() === "month,table",
      `Tab reaches the month picker, then the table (${reached.join(", ")})`,
    );
    await trigger.focus();
    await page.keyboard.press("Enter");
    // The menu opens onto the checked month; newest first, so up is later.
    const checked = page.getByRole("menuitemradio", { checked: true });
    await checked.waitFor();
    await page.waitForFunction(
      () => document.activeElement?.getAttribute("aria-checked") === "true",
    );
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await page.waitForURL(`**/admin/ai?month=${EMPTY_MONTH}`);
    ok(true, "Enter, ArrowUp, Enter on the picker opens the month after");
    await page.getByRole("heading", { name: "March 2001" }).waitFor();
    ok(
      (await text("dl > div"))[0]?.includes(usd(0)) &&
        (await page.locator("table").count()) === 0 &&
        (await page.getByText("wasn’t used in March 2001").count()) === 1 &&
        (await page.getByText("No days to show.").count()) === 1,
      "an empty month shows US$0.00, says once it wasn't used, and has no days",
    );

    // A month before the ledger began reads as this one, keeping the picker
    // short however the address was typed.
    await page.goto(`${base}/admin/ai?month=0026-09`);
    const thisMonth = new Intl.DateTimeFormat("en-NZ", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date());
    await page.getByRole("heading", { name: "Day by day" }).waitFor();
    ok(
      (await text("main h2")).includes(thisMonth),
      `?month=0026-09 reads as ${thisMonth}`,
    );

    // ── In the sidebar, and linked from Magazine details, while it is on ────
    const navLink = page
      .locator("aside nav")
      .getByRole("link", { name: "Assistant", exact: true });
    ok(
      (await navLink.count()) === (enabled ? 1 : 0),
      `the sidebar has an Assistant entry only while it is on`,
    );
    if (enabled) {
      ok(
        (await navLink.getAttribute("href")) === "/admin/ai" &&
          (await navLink.getAttribute("aria-current")) === "page",
        "the Assistant entry goes to /admin/ai and is current there",
      );
    }
    await page.goto(`${base}/admin/magazine`);
    await page.getByRole("heading", { name: "Magazine details" }).waitFor();
    const link = page.locator('main a[href="/admin/ai"]');
    ok(
      (await link.count()) === (enabled ? 1 : 0),
      `Magazine details links to Assistant usage only while it is on`,
    );
  } finally {
    await sql`delete from ai_usage where run_id like ${`${tag}-%`}`;
    await sql`delete from ai_grants where note = ${tag}`;
  }
}
