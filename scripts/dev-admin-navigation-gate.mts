// Issue #244: verify real client navigation, persistent chrome, history and auth.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-admin-navigation-gate.mts <base-url>
// Uses only its own scratch admin/session/issue and removes them on exit.
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import postgres from "postgres";
import { chromium, type Page } from "playwright";
import { emptyIssueContent } from "../src/lib/blocks.ts";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const base = process.argv[2] ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const stamp = crypto.randomUUID();
const userId = `nav-${stamp}`;
const token = crypto.randomUUID();
const issueId = crypto.randomUUID();
const browser = await chromium.launch();
const paths = [
  "/admin",
  "/admin/members",
  "/admin/sponsors",
  "/admin/magazine",
  "/admin/help",
];
const headings = ["Issues", "Members", "Sponsors", "Magazine details", "Guide"];
mkdirSync("test-results/admin-navigation", { recursive: true });

async function ready(page: Page, index: number) {
  await page.waitForURL((url) => url.pathname === paths[index]);
  await page
    .getByRole("heading", { name: headings[index], exact: true })
    .waitFor();
  await page.waitForFunction(
    (href) =>
      document
        .querySelector("aside nav a[aria-current=page]")
        ?.getAttribute("href") === href,
    paths[index],
  );
  assert.equal(await page.locator("main").count(), 1, "one main landmark");
}

try {
  await sql`insert into users (id, email, name, is_admin, subscribed, email_verified)
    values (${userId}, ${`nav-${stamp}@example.invalid`}, 'Navigation check', true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${userId}, now() + interval '1 hour')`;
  await sql`insert into issues (id, number, title, content)
    values (${issueId}, ${900000000 + Math.floor(Math.random() * 100000000)},
      ${`Navigation ${stamp}`}, ${sql.json(emptyIssueContent())})`;

  for (const mobile of [false, true]) {
    const ctx = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    });
    await ctx.addCookies([
      { name: "authjs.session-token", value: token, url: base },
    ]);
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/admin`);
    await ready(page, 0);
    const sidebar = await page.locator("aside").elementHandle();
    const main = await page.locator("#admin-main").elementHandle();
    const menu = await page
      .getByRole("button", { name: "Open admin menu", includeHidden: true })
      .elementHandle();
    let documents = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame())
        documents++;
    });

    async function persistent() {
      assert(
        await sidebar!.evaluate((el) => el === document.querySelector("aside")),
        "same sidebar DOM node",
      );
      assert(
        await main!.evaluate(
          (el) => el === document.querySelector("#admin-main"),
        ),
        "same content container",
      );
      assert(
        await menu!.evaluate((el) => el.isConnected),
        "same mobile menu trigger",
      );
      assert.equal(documents, 0, "no document requests during navigation");
    }
    async function navigate(index: number) {
      if (mobile)
        await page.getByRole("button", { name: "Open admin menu" }).click();
      const nav = mobile
        ? page.getByRole("dialog", { name: "Admin navigation" })
        : page.locator("aside");
      await nav.locator(`nav a[href="${paths[index]}"]`).click();
      await ready(page, index);
      if (mobile) {
        assert.equal(
          await page.getByRole("dialog").count(),
          0,
          "drawer closes on selection",
        );
        assert.equal(
          await page.locator("#admin-main").getAttribute("inert"),
          null,
          "main remains interactive",
        );
      }
      await persistent();
    }
    // Hold the first content request to exercise the in-flight layout, too.
    let releaseContent!: () => void;
    let markRequested!: () => void;
    const contentHeld = new Promise<void>((resolve) => {
      releaseContent = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      markRequested = resolve;
    });
    await page.route("**/admin/members?*", async (route) => {
      if (
        route.request().headers()["rsc"] &&
        !route.request().headers()["next-router-prefetch"]
      ) {
        markRequested();
        await contentHeld;
      }
      await route.continue();
    });
    const navigation = navigate(1);
    try {
      await Promise.race([
        requested,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("No content request")), 15000),
        ),
      ]);
      await persistent();
    } finally {
      releaseContent();
    }
    await navigation;
    await page.unroute("**/admin/members?*");
    for (let i = 2; i < paths.length; i++) await navigate(i);
    await page.goBack();
    await ready(page, 3);
    await persistent();
    await page.goForward();
    await ready(page, 4);
    await persistent();
    await page.screenshot({
      path: `test-results/admin-navigation/${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
      animations: "disabled",
    });

    // Opening the drawer then using browser history must also release inert.
    if (mobile) {
      await page.getByRole("button", { name: "Open admin menu" }).click();
      await page.goBack();
      await ready(page, 3);
      assert.equal(
        await page.getByRole("dialog").count(),
        0,
        "history closes drawer",
      );
      assert.equal(
        await page.locator("#admin-main").getAttribute("inert"),
        null,
      );
    }
    await navigate(4);
    await page.locator("#admin-main").evaluate((el) => {
      el.scrollTop = 700;
    });
    await navigate(3);
    assert.equal(
      await page.locator("#admin-main").evaluate((el) => el.scrollTop),
      0,
      "new page starts at the top",
    );
    // History must not carry the other section's scroll into the destination.
    await navigate(4);
    await navigate(3);
    await page.locator("#admin-main").evaluate((el) => {
      el.scrollTop = 700;
    });
    await page.goBack();
    await ready(page, 4);
    assert.equal(
      await page.locator("#admin-main").evaluate((el) => el.scrollTop),
      0,
      "Back starts the previous section at the top",
    );
    await persistent();
    await page.locator("#admin-main").evaluate((el) => {
      el.scrollTop = 700;
    });
    await page.goForward();
    await ready(page, 3);
    assert.equal(
      await page.locator("#admin-main").evaluate((el) => el.scrollTop),
      0,
      "Forward starts the next section at the top",
    );
    await persistent();
    for (let i = 0; i < paths.length; i++) {
      await page.goto(
        `${base}${paths[i]}${i === 1 ? "?q=nav-&filter=all&page=1" : ""}`,
      );
      await ready(page, i);
    }
    await page.goto(`${base}/admin/help#pdf`);
    await ready(page, 4);
    await page.waitForFunction(
      () => (document.querySelector("#admin-main")?.scrollTop ?? 0) > 0,
    );
    // The editor and preview keep their standalone layouts and use soft links.
    await page.goto(`${base}/admin?q=${stamp}`);
    await ready(page, 0);
    documents = 0;
    await page
      .locator(`#admin-main a[href="/admin/issues/${issueId}/edit"]`)
      .first()
      .click();
    await page.waitForURL(`**/admin/issues/${issueId}/edit`);
    await page.getByRole("link", { name: "Back to issues" }).waitFor();
    assert.equal(await page.locator("#admin-main").count(), 0);
    await page.getByRole("link", { name: "Back to issues" }).click();
    await ready(page, 0);
    assert.equal(documents, 0, "editor round trip stays client-side");
    await page.goto(`${base}/admin/issues/${issueId}/preview`);
    await page.getByRole("link", { name: "Back to the editor" }).waitFor();
    assert.equal(await page.locator("#admin-main").count(), 0);
    assert.deepEqual(errors, [], "no uncaught browser errors");
    console.log(
      `PASS ${mobile ? "mobile" : "desktop"}: persistent shell, active links, history, direct URLs, editor/preview`,
    );
    await ctx.close();
  }

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/admin/members`);
  await page.waitForURL("**/signin");
  await ctx.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  await page.goto(`${base}/admin`);
  await ready(page, 0);
  await sql`update users set is_admin = false where id = ${userId}`;
  await page.locator('aside a[href="/admin/members"]').click();
  await page.waitForURL((url) => url.pathname === "/");
  console.log(
    "PASS auth: signed-out direct link and revoked admin on soft navigation",
  );
  await ctx.close();
} finally {
  await browser.close();
  await sql`delete from issues where id = ${issueId}`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${userId}`;
  await sql.end();
}
