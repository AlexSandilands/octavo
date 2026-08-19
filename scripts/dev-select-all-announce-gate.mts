// Dev-only: proves the members bulk bar announces a landed "Select all N
// matching" (issue #132) headless against a running dev server.
//
// The bug: only the failure path wrote to the always-mounted live region.
// Success flipped the button label back to itself and bumped a count that
// lives in a (non-live) checkbox label, so a screen reader said nothing —
// leaving the admin about to press "Remove selected" with no way to hear that
// the selection had landed.
//
// A MutationObserver on the region is the assertion, not a text snapshot: it
// records what actually changed inside the live region, which is what a screen
// reader reacts to.
//
// With --expect-fail it asserts the failure branch instead, which the UI can't
// reach on its own (both of the action's ok:false causes — an over-long query
// and an unknown filter — are already validated away by the page), so that run
// is driven by a temporary local edit to the bar's `ok` and is not part of the
// normal gate.
//
// It mints its own scratch admin, session and members and removes them again
// in the finally block — it never seeds and never touches existing rows.
// Run: npx tsx scripts/dev-select-all-announce-gate.mts <base-url> [--expect-fail]
import postgres from "postgres";
import { chromium, type Locator, type Page } from "playwright";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base)
  throw new Error("usage: dev-select-all-announce-gate.mts <base-url>");
const expectFail = process.argv.includes("--expect-fail");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const sql = postgres(process.env.DATABASE_URL!);

const tag = "a11y132";
const adminId = crypto.randomUUID();
const token = crypto.randomUUID();
const adminEmail = `${tag}-000@example.test`;
// More than one page of them (ADMIN_LIST_PAGE_SIZE is 25), so the reach-past-
// the-page button is on screen at all.
const memberEmails = Array.from(
  { length: 30 },
  (_, i) => `${tag}-${String(i + 1).padStart(3, "0")}@example.test`,
);
const total = memberEmails.length + 1;

// Everything the live region has said since the observer was attached, in
// order. Recorded from mutations rather than polled, so a message that arrives
// and is replaced still shows up.
const startWatching = (region: Locator) =>
  region.evaluate((el) => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    new MutationObserver(() => {
      const text = el.textContent?.trim() ?? "";
      if (text && text !== w.__said.at(-1)) w.__said.push(text);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });

const said = (page: Page) =>
  page.evaluate(() => (window as unknown as { __said: string[] }).__said);

const heard = async (page: Page, text: string) => {
  try {
    await page.waitForFunction(
      (t) =>
        (window as unknown as { __said: string[] }).__said.some((s) =>
          s.includes(t),
        ),
      text,
      { timeout: 15_000 },
    );
  } catch {
    throw new Error(
      `FAIL: never announced “${text}” (heard: ${JSON.stringify(await said(page))})`,
    );
  }
};

const browser = await chromium.launch();
try {
  // ── Scratch fixtures ──────────────────────────────────────────────────────
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${adminId}, ${adminEmail}, true, true, now())`;
  await sql`insert into users ${sql(
    memberEmails.map((email) => ({
      id: crypto.randomUUID(),
      email,
      is_admin: false,
      subscribed: true,
      email_verified: new Date(),
    })),
  )}`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${adminId}, now() + interval '1 day')`;
  console.log(`scratch admin ${adminEmail} + ${memberEmails.length} members`);

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

  // Only the scratch rows are in view, so every count below is exact.
  await page.goto(`${base}/admin/members?q=${tag}`);
  await page.waitForSelector(`text=${adminEmail}`, { timeout: 20_000 });

  // The two always-mounted regions of the bulk bar, in DOM order: the cap note
  // then the result line. (The list's own count region carries role=status.)
  const regions = page.locator('p[aria-live="polite"]:not([role])');
  ok(
    (await regions.count()) === 2,
    "the bulk bar's two live regions are mounted",
  );
  const result = regions.nth(1);
  ok(
    (await result.textContent())?.trim() === "",
    "the result region starts empty (mounted before it has anything to say)",
  );

  const selectAll = page.getByRole("button", {
    name: `Select all ${total} matching`,
  });
  await selectAll.waitFor({ timeout: 15_000 });
  ok(true, `the reach-past-the-page button offers all ${total} matches`);

  await startWatching(result);

  if (expectFail) {
    // ── Failure path (temporary local edit forces ok = false) ───────────────
    await selectAll.click();
    await heard(page, "That didn’t go through");
    ok(true, "a refused select-all still announces the failure");
    const cls = (await result.getAttribute("class")) ?? "";
    ok(!cls.includes("sr-only"), "the failure stays visible as well as spoken");
    ok(cls.includes("text-warn"), "the failure keeps its warning colour");
    console.log(`\nheard: ${JSON.stringify(await said(page))}`);
    console.log("\nPASS — the failure path announces as before");
  } else {
    // ── 1. Success announces ───────────────────────────────────────────────
    await selectAll.click();
    await heard(page, `${total} members selected.`);
    ok(true, `the landed select-all announced “${total} members selected.”`);

    const cls = (await result.getAttribute("class")) ?? "";
    ok(
      cls.includes("sr-only"),
      "the selection is announced for screen readers only (the count is already on screen)",
    );
    ok(
      await page.locator(`text=${total} selected`).first().isVisible(),
      `the sighted count reads “${total} selected”`,
    );

    // ── 2. A bulk action's result still announces, and replaces it ─────────
    await page.getByRole("button", { name: "Unsubscribe" }).first().click();
    await heard(page, `${total} members unsubscribed`);
    ok(true, "the following bulk action still announces its own result");
    const after = await result.textContent();
    ok(
      !after?.includes("selected."),
      "the bulk result replaces the selection line rather than joining it",
    );
    ok(
      !((await result.getAttribute("class")) ?? "").includes("sr-only"),
      "the bulk result is visible again, as it was before",
    );

    // ── 3. Clearing the selection takes the line with it ───────────────────
    await startWatching(result); // a fresh log, so this is its own assertion
    await selectAll.click();
    await heard(page, `${total} members selected.`);
    ok(true, "select-all announces again after a bulk action");

    await page.getByRole("button", { name: "Clear" }).first().click();
    await page.waitForFunction(
      (el) => (el as HTMLElement).textContent?.trim() === "",
      await result.elementHandle(),
      { timeout: 15_000 },
    );
    ok(
      true,
      "clearing the selection empties the region rather than leaving a stale count",
    );

    console.log(`\nheard: ${JSON.stringify(await said(page))}`);
    console.log("\nPASS — a landed select-all is announced");
  }

  await ctx.close();
} finally {
  await browser.close();
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where email like ${`${tag}-%@example.test`}`;
  const left = await sql`
    select count(*)::int as count from users where email like ${`${tag}-%`}`;
  console.log(`scratch rows removed (${left[0]!.count} left)`);
  await sql.end();
}
