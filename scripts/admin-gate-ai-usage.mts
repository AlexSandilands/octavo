// The assistant usage page's half of dev-admin-gate.mts (issue #314): admin
// only, its figures against the budget arithmetic, headings and table
// semantics, and a keyboard walk from the month picker to the table.
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
    // Two days; one run crosses midnight UTC, so the month has 2 runs, not 3.
    const rows = [
      [`${tag}-a`, 10, 50_000, 2_000, 400, 0.041, "2001-02-03T10:00:00Z"],
      [`${tag}-a`, 5, 60_000, 0, 300, 0.023, "2001-02-03T23:59:59Z"],
      [`${tag}-b`, 7, 40_000, 100, 200, 0.019, "2001-02-04T00:00:00Z"],
      [`${tag}-a`, 3, 61_000, 0, 250, 0.022, "2001-02-04T00:00:30Z"],
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
        "day,runs,requests,tokens,cached reads,cost",
      `column headers (${cols.join(", ")})`,
    );
    const days = await table.locator("tbody th[scope=row]").allInnerTexts();
    ok(
      days.length === 2 && days[0]!.includes("4 Feb"),
      `two day rows, newest first (${days.join(", ")})`,
    );
    const foot = await table.locator("tfoot tr").innerText();
    ok(
      foot.includes("Month total") &&
        foot.split(/\s+/).includes("2") &&
        foot.includes(usdUp(spent)),
      `the foot counts 2 runs once each and totals ${usdUp(spent)} (${foot.replace(/\s+/g, " ")})`,
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
        (await page.getByText("wasn’t used in March 2001").count()) === 1,
      "an empty month shows US$0.00 and says it wasn't used",
    );

    // ── Linked from Magazine details while the assistant is on ─────────────
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
