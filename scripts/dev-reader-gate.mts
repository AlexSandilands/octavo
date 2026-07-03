// Dev-only: verifies the reader/library gate (issue #5) headless against a
// running dev server — redirect-with-return-path, open-redirect rejection,
// and the member header. Requires member@example.com (dev-auth-check.mts)
// and a published issue number 3 (the seed provides it).
// Run: npx tsx scripts/dev-reader-gate.mts <base-url> <dev-log-path>
import { readFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";

process.loadEnvFile?.(".env.local");
const [base, logPath] = process.argv.slice(2);
if (!base || !logPath)
  throw new Error("usage: dev-reader-gate.mts <base-url> <dev-log>");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const browser = await chromium.launch();

// The dev transport logs each link under "[auth] magic link for <email>:".
// Wait for a link newer than `after` so parallel/prior runs can't confuse us.
async function magicLink(email: string, after: number) {
  const re = new RegExp(
    `\\[auth\\] magic link for ${email.replace(/[.@]/g, "\\$&")}:\\n\\[auth\\] {3}(http\\S+)`,
    "g",
  );
  for (let i = 0; i < 40; i++) {
    const links = [...(await readFile(logPath!, "utf8")).matchAll(re)];
    if (links.length > after) return links.at(-1)![1]!;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no new magic link for ${email}`);
}

async function requestLink(page: Page, email: string) {
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.waitForURL("**/signin/sent");
}

let linkCount = 0;

// 1. Signed out, straight to an issue → /signin carries the destination.
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${base}/read/3`);
await page.waitForURL("**/signin?next=%2Fread%2F3");
ok(true, "signed out: /read/3 → /signin?next=%2Fread%2F3");
await page.goto(`${base}/`);
await page.waitForURL((u) => u.pathname === "/signin");
ok(true, "signed out: / → /signin");

// 2. Sign in from the carried-destination form → land on the issue.
await page.goto(`${base}/signin?next=%2Fread%2F3`);
await requestLink(page, "member@example.com");
await page.goto(await magicLink("member@example.com", linkCount++));
await page.waitForLoadState();
ok(
  new URL(page.url()).pathname === "/read/3",
  "sign-in via ?next lands on /read/3",
);

// 3. Member header: Sign out visible, no Admin; sign out re-gates.
await page.goto(`${base}/`);
ok(!(await page.isVisible("nav >> text=Admin")), "member: no Admin button");
await page.click("nav button:has-text('Sign out')");
await page.waitForURL("**/signin**");
await page.goto(`${base}/`);
await page.waitForURL((u) => u.pathname === "/signin");
ok(true, "after sign-out the library is gated again");
await ctx.close();

// 4. Open-redirect attempts fall back to the library.
for (const evil of ["https://evil.example", "//evil.example", "/\\evil"]) {
  const c = await browser.newContext();
  const p = await c.newPage();
  await p.goto(`${base}/signin?next=${encodeURIComponent(evil)}`);
  await requestLink(p, "member@example.com");
  await p.goto(await magicLink("member@example.com", linkCount++));
  await p.waitForLoadState();
  const landed = new URL(p.url());
  ok(
    landed.origin === base && landed.pathname === "/",
    `crafted next=${evil} falls back to ${base}/`,
  );
  await c.close();
}

await browser.close();
console.log("\nall checks passed");
