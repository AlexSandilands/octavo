// Dev-only: proves the CSV import announces its result and keeps keyboard focus
// (issue #133), headless against a running dev server.
//
// The bug: when the import resolved, the block holding the Import button
// unmounted — dropping focus onto <body> — and the summary swapped in as a
// plain <p> with no live region. Silence and nowhere to stand, at the moment
// the highest-stakes action on the page lands. This checks:
//   a. the live region is mounted from the moment the dialog opens, and empty
//      (a region that arrives together with its text is announced unreliably),
//   b. its text changes when the result lands — the announcement — and carries
//      the essential counts,
//   c. …without reciting the refused addresses, which are on screen to be read,
//   d. focus is inside the dialog immediately afterwards, with no key pressed,
//   e. #144's flow is intact: preview counts, the visible summary, and the
//      refused address listed in full.
//
// The CSV mixes three kinds of row on purpose: two importable, one the file
// itself yields no address from (counted while parsing), and one whose name is
// longer than the server's 200-char limit — which the browser preview accepts
// and the server refuses, the only way to exercise #144's server-side skip
// report from the UI.
//
// It mints its own scratch admin + session and removes them, and every member
// it imports, in the finally block — it never seeds.
// Run: npx tsx scripts/dev-import-announce-gate.mts <base-url>
import postgres from "postgres";
import { chromium } from "playwright";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: dev-import-announce-gate.mts <base-url>");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};

const sql = postgres(process.env.DATABASE_URL!);

const userId = crypto.randomUUID();
const token = crypto.randomUUID();
const adminEmail = `a11y133-admin-${userId.slice(0, 8)}@example.test`;

// Two importable rows, one unreadable row, one the server will refuse.
const LONG_NAME = "N".repeat(250);
const CSV = [
  "email,name",
  "a11y133-001@example.test,Valid One",
  `a11y133-002@example.test,${LONG_NAME}`,
  "not-an-address,Broken Row",
  "a11y133-003@example.test,Valid Three",
].join("\n");

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${userId}, ${adminEmail}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${userId}, now() + interval '1 day')`;
  console.log(`scratch admin ${adminEmail}`);

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

  await page.goto(`${base}/admin/members`);
  await page.waitForSelector("button:has-text('Import CSV')");
  await page.click("button:has-text('Import CSV')");
  await page.waitForSelector("[role=dialog]");

  // ── a. the region is mounted before anything has happened ─────────────────
  const initial = await page.evaluate(() => {
    const region = document.querySelector<HTMLElement>(
      "[role=dialog] [role=status][aria-live=polite]",
    );
    return region && { text: region.textContent ?? "", polite: true };
  });
  ok(
    initial != null,
    "a polite live region is in the dialog before the import",
  );
  ok(
    initial!.text.trim() === "",
    `…and it is empty, so the announcement will be a text change rather than a new region (got "${initial!.text}")`,
  );

  // Watch it the way a screen reader would: record every text change, and where
  // focus was standing at the moment each one landed.
  await page.evaluate(() => {
    const w = window as unknown as {
      __a11y133: { text: string; at: string }[];
    };
    w.__a11y133 = [];
    const region = document.querySelector<HTMLElement>(
      "[role=dialog] [role=status][aria-live=polite]",
    )!;
    new MutationObserver(() => {
      const el = document.activeElement as HTMLElement | null;
      w.__a11y133.push({
        text: region.textContent ?? "",
        at: !el || el === document.body ? "<body>" : el.tagName.toLowerCase(),
      });
    }).observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });

  // ── e. #144's preview still counts what it always did ─────────────────────
  await page.setInputFiles(
    "[role=dialog] input[type=file]",
    { name: "a11y133.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) },
    { force: true },
  );
  await page.waitForSelector("[role=dialog] button:has-text('Import 3')");
  ok(true, "the preview counts the 3 importable rows (#144 unregressed)");

  // Press it with the keyboard, standing on it — the exact case that dropped
  // focus to <body> when the block unmounted.
  const importBtn = page.locator("[role=dialog] button:has-text('Import 3')");
  await importBtn.focus();
  ok(
    await page.evaluate(
      () =>
        (document.activeElement as HTMLElement | null)?.textContent?.includes(
          "Import 3",
        ) ?? false,
    ),
    "focus is on the Import button when it is pressed",
  );
  await page.keyboard.press("Enter");

  // ── b. the announcement ───────────────────────────────────────────────────
  await page.waitForFunction(
    () =>
      (
        document.querySelector("[role=dialog] [role=status][aria-live=polite]")
          ?.textContent ?? ""
      ).trim().length > 0,
    undefined,
    { timeout: 20_000 },
  );
  const announced = (
    await page.evaluate(
      () =>
        document.querySelector("[role=dialog] [role=status][aria-live=polite]")
          ?.textContent ?? "",
    )
  ).trim();
  console.log(`\n  announced: "${announced}"\n`);
  ok(
    announced.includes("2 added"),
    "the announcement leads with what the import did — 2 added",
  );
  ok(
    announced.includes("1 invalid row skipped"),
    "…and carries the parse-time skip count",
  );
  ok(
    announced.includes("1 address couldn’t be used"),
    "…and the server's refused count",
  );
  // c. the refused addresses are to be read, not recited in one breath.
  ok(
    !announced.includes("a11y133-002@example.test"),
    "the announcement does not recite the refused address list",
  );

  const records = await page.evaluate(
    () => (window as unknown as { __a11y133: { text: string }[] }).__a11y133,
  );
  ok(
    records.length > 0 && records.some((r) => r.text.includes("2 added")),
    `the region's text CHANGED in place (${records.length} mutation${
      records.length === 1 ? "" : "s"
    } observed) — it was not mounted together with its text`,
  );

  // ── d. focus, with nothing pressed since Enter ────────────────────────────
  const landed = await page.evaluate(() => {
    const panel = document.querySelector("[role=dialog]");
    const el = document.activeElement as HTMLElement | null;
    return {
      inside: !!panel && !!el && panel.contains(el),
      isBody: !el || el === document.body,
      description:
        !el || el === document.body
          ? "<body>"
          : `${el.tagName.toLowerCase()}[${el.textContent?.trim().slice(0, 20)}]`,
    };
  });
  ok(!landed.isBody, `focus is not on <body> (it is on ${landed.description})`);
  ok(
    landed.inside,
    `focus is on a control inside the dialog, with no Tab pressed (${landed.description})`,
  );
  ok(
    landed.description.includes("Done"),
    `…specifically the Done button (${landed.description})`,
  );

  // ── e. the visible summary still reports everything #144 reported ─────────
  const summaryText = (await page.textContent("[role=dialog]")) ?? "";
  ok(summaryText.includes("2 added"), "the visible summary reports 2 added");
  ok(
    summaryText.includes("1 invalid row"),
    "the visible summary reports the invalid row",
  );
  ok(
    summaryText.includes("a11y133-002@example.test"),
    "the refused address is still listed in full on screen (#144 unregressed)",
  );

  // The two importable rows really were written.
  const written =
    await sql`select email from users where email like ${"a11y133-00%"} order by email`;
  ok(
    written.length === 2,
    `the import wrote exactly the 2 valid rows (${written.map((r) => r.email).join(", ")})`,
  );

  await ctx.close();
  console.log(
    "\nPASS — the import announces its result and keeps focus (#133)",
  );
} finally {
  await browser.close();
  await sql`delete from sessions where session_token = ${token}
              or user_id in (select id from users
                             where email like ${"a11y133-%"})`;
  await sql`delete from users where email like ${"a11y133-%"}`;
  console.log("scratch rows removed");
  await sql.end();
}
