// Dev-only: proves the MenuSelect focus contract (issue #136) headless against
// a running dev server, on the two surfaces named in the issue — the editor
// header's theme menu (re-rendered by autosave) and the members filter (re-
// rendered by the list refresh).
//
// The bug: the open-time focus effect listed `items`, which hosts rebuild with
// `.map` on every render, so any parent re-render while the menu was open
// dragged focus back to the checked option mid-arrow-navigation.
//
// It mints its own scratch admin + session + draft issue and removes them again
// in the finally block — it never seeds and never touches existing rows.
// Run: npx tsx scripts/dev-menu-focus-gate.mts <base-url>
import postgres from "postgres";
import { chromium, type Page } from "playwright";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: dev-menu-focus-gate.mts <base-url>");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const sql = postgres(process.env.DATABASE_URL!);

const userId = crypto.randomUUID();
const issueId = crypto.randomUUID();
const token = crypto.randomUUID();
const email = `scratch-136-${userId.slice(0, 8)}@example.invalid`;
const issueNumber = 91360 + Math.floor(Math.random() * 500);

// The focused element, described the way the assertions read it: the option
// label for a menu item, else a tag/role sketch.
const active = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "<none>";
    if (el.getAttribute("role") === "menuitemradio")
      return `menuitem:${el.textContent?.trim()}`;
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`;
  });

const menuOpen = (page: Page, label: string) =>
  page.isVisible(`[role=menu][aria-label="${label}"]`);

// Drive a React-controlled input without touching focus or the pointer: React
// listens for the native input event, so setting the value through the
// prototype setter and dispatching one is a genuine keystroke as far as the
// host is concerned — and, crucially, it leaves focus inside the open menu.
const typeElsewhere = (page: Page, selector: string, value: string) =>
  page.evaluate(
    ([sel, val]) => {
      const el = document.querySelector(sel!) as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [selector, value] as const,
  );

const browser = await chromium.launch();
try {
  // ── Scratch fixtures ──────────────────────────────────────────────────────
  const [srcIssue] = await sql`
    select content from issues order by number limit 1`;
  if (!srcIssue) throw new Error("no issue to copy a content document from");

  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${userId}, ${email}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${userId}, now() + interval '1 day')`;
  await sql`insert into issues (id, number, title, theme, status, content)
            values (${issueId}, ${issueNumber}, ${"Scratch 136"}, 'classic',
                    'draft', ${sql.json(srcIssue.content)})`;
  console.log(`scratch issue ${issueId} (no. ${issueNumber}), user ${email}`);

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

  // ── 1. Editor header: the theme menu survives an autosave ────────────────
  await page.goto(`${base}/admin/issues/${issueId}/edit`);
  await page.waitForSelector("button:has-text('Theme:')");
  ok(true, "editor loaded with the theme menu present");

  // Opening still lands on the checked option.
  await page.click("button:has-text('Theme:')");
  await page.waitForSelector('[role=menu][aria-label="Layout theme"]');
  ok(
    (await active(page)) === "menuitem:Classic",
    `opening focuses the checked option (got ${await active(page)})`,
  );

  // Arrows still move focus.
  await page.keyboard.press("ArrowDown");
  ok(
    (await active(page)) === "menuitem:Modern",
    `ArrowDown moves to the next option (got ${await active(page)})`,
  );
  await page.keyboard.press("ArrowUp");
  ok((await active(page)) === "menuitem:Classic", "ArrowUp moves back");
  await page.keyboard.press("End");
  ok(
    (await active(page)) === "menuitem:Modern",
    "End moves to the last option",
  );
  await page.keyboard.press("Home");
  ok(
    (await active(page)) === "menuitem:Classic",
    "Home moves to the first option",
  );

  // Now the regression: arrow to a *non-checked* option, then make the host
  // re-render underneath the open menu. Editing the title re-renders the header
  // immediately and arms the 800ms meta autosave, whose "Saving…"→"Saved"
  // transitions re-render it twice more.
  await page.keyboard.press("ArrowDown");
  ok((await active(page)) === "menuitem:Modern", "focus parked on Modern");

  await typeElsewhere(
    page,
    "input[placeholder='Untitled issue']",
    "Scratch 136 edited",
  );
  await page.waitForSelector("header >> text=Saving…");
  ok(true, "the title edit re-rendered the header (autosave armed)");
  ok(
    (await active(page)) === "menuitem:Modern",
    `focus held through the re-render (got ${await active(page)})`,
  );

  await page.waitForSelector("header >> text=Saved", { timeout: 15_000 });
  ok(true, "the autosave round trip completed while the menu was open");
  ok(await menuOpen(page, "Layout theme"), "the menu is still open");
  ok(
    (await active(page)) === "menuitem:Modern",
    `focus held through the autosave (got ${await active(page)})`,
  );

  // The consequence the issue reports: Enter must select what focus is on.
  await page.keyboard.press("Enter");
  await page.waitForSelector("button:has-text('Theme: Modern')");
  ok(true, "Enter selected the arrowed-to option (Theme: Modern)");

  // Escape still closes and returns focus to the trigger.
  await page.click("button:has-text('Theme:')");
  await page.waitForSelector('[role=menu][aria-label="Layout theme"]');
  await page.keyboard.press("Escape");
  ok(!(await menuOpen(page, "Layout theme")), "Escape closes the menu");
  ok((await active(page)) === "button", "Escape returns focus to the trigger");

  // ── 2. Members filter: the menu survives a list refresh ──────────────────
  await page.goto(`${base}/admin/members`);
  await page.waitForSelector("button:has-text('Filter:')");

  await page.click("button:has-text('Filter:')");
  await page.waitForSelector('[role=menu][aria-label="Filter members"]');
  ok(
    (await active(page)) === "menuitem:All",
    `opening focuses the checked option (got ${await active(page)})`,
  );

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  ok(
    (await active(page)) === "menuitem:Subscribed",
    `two ArrowDowns reach Subscribed (got ${await active(page)})`,
  );

  // A search keystroke lands in the URL 250ms later and refreshes the list from
  // the server — the members-side re-render the issue names.
  await typeElsewhere(
    page,
    "input[aria-label='Search all members by name or email']",
    "scratch-136",
  );
  await page.waitForURL("**/admin/members?q=scratch-136", { timeout: 15_000 });
  // The scratch admin is the one member that matches, so its row appearing is
  // proof the server re-rendered the list under the open menu.
  await page.waitForSelector(`text=${email}`, { timeout: 15_000 });
  ok(true, "the list refreshed from the server (?q= landed, rows replaced)");
  ok(await menuOpen(page, "Filter members"), "the filter menu is still open");
  ok(
    (await active(page)) === "menuitem:Subscribed",
    `focus held through the list refresh (got ${await active(page)})`,
  );

  await page.keyboard.press("Enter");
  await page.waitForURL("**filter=subscribed**", { timeout: 15_000 });
  ok(true, "Enter selected the arrowed-to filter (?filter=subscribed)");

  await ctx.close();
  console.log("\nPASS — MenuSelect keeps focus across host re-renders");
} finally {
  await browser.close();
  await sql`delete from issues where id = ${issueId}`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${userId}`;
  console.log("scratch rows removed");
  await sql.end();
}
