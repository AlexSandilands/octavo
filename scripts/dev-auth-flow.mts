// Dev-only: drives the full magic-link flow headless against a running dev
// server (issue #3 verification). Not part of the app.
// Run: npx tsx scripts/dev-auth-flow.mts <base-url> <dev-log-path>
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const [base, logPath] = process.argv.slice(2);
if (!base || !logPath)
  throw new Error("usage: dev-auth-flow.mts <base-url> <dev-log>");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const counts = async () => {
  const [row] = await sql`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from sessions) as sessions,
      (select count(*)::int from verification_tokens) as tokens`;
  return row as { users: number; sessions: number; tokens: number };
};

const lastMagicLink = async () => {
  const log = await readFile(logPath, "utf8");
  const links = [...log.matchAll(/\[auth\] {3}(http\S+)/g)].map((m) => m[1]);
  return links.at(-1);
};

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const before = await counts();

// 1. Member requests a link → neutral sent page, token created.
await page.goto(`${base}/signin`);
await page.fill("#email", "member@example.com");
await page.click("button[type=submit]");
await page.waitForURL("**/signin/sent");
ok(true, "member request lands on /signin/sent");
let now = await counts();
ok(now.tokens === before.tokens + 1, "verification token created for member");

// 2. The console-logged link signs the member in with a database session.
const link = await lastMagicLink();
ok(link, "magic link appeared in the dev log");
await page.goto(link!);
await page.waitForLoadState();
ok(new URL(page.url()).pathname === "/", "magic link lands on the library (/)");
const session = await (
  await ctx.request.get(`${base}/api/auth/session`)
).json();
ok(
  session?.user?.email === "member@example.com",
  "session established for member",
);
ok(session?.user?.isAdmin === false, "session exposes isAdmin");
ok(
  Object.keys(session).sort().join() === "expires,user" &&
    Object.keys(session.user).sort().join() === "email,id,isAdmin,name",
  "session JSON is curated (no sessionToken/userId/full row leak)",
);
now = await counts();
ok(now.sessions === before.sessions + 1, "session row created");
ok(now.tokens === before.tokens, "token consumed on use");

// 3. Session survives a "browser restart" (fresh context, same cookies).
const state = await ctx.storageState();
const cookie = state.cookies.find((c) => c.name.includes("session-token"));
ok(cookie, "session cookie set");
const days = ((cookie!.expires as number) * 1000 - Date.now()) / 86400000;
ok(
  days > 85 && days < 95,
  `session cookie lives ~90 days (${days.toFixed(1)})`,
);
const ctx2 = await browser.newContext({ storageState: state });
const session2 = await (
  await ctx2.request.get(`${base}/api/auth/session`)
).json();
ok(
  session2?.user?.email === "member@example.com",
  "session persists in a fresh context",
);
await ctx2.close();

// 4. Reusing the link → expired-link re-request screen, still signed-out ctx.
const ctx3 = await browser.newContext();
const page3 = await ctx3.newPage();
await page3.goto(link!);
await page3.waitForURL("**/signin?error=Verification**");
const banner = await page3.textContent("[role=alert]");
ok(
  /expired/i.test(banner ?? ""),
  "used link shows expired + re-request message",
);
await page3.locator("#email").waitFor(); // throws if the form isn't there
ok(true, "re-request form is right there");

// 5. Unknown email → identical UX, nothing written to the DB.
await page3.goto(`${base}/signin`);
await page3.fill("#email", "stranger@example.com");
await page3.click("button[type=submit]");
await page3.waitForURL("**/signin/sent");
ok(true, "unknown email lands on the same /signin/sent");
const after = await counts();
ok(after.users === now.users, "no user created for unknown email");
ok(after.tokens === now.tokens, "no token created for unknown email");
const strangerLink = await lastMagicLink();
ok(strangerLink === link, "no magic link logged for unknown email");

// 6. Malformed email server-side guard renders its banner.
await page3.goto(`${base}/signin?error=invalid-email`);
ok(
  /doesn't look like an email/i.test(
    (await page3.textContent("[role=alert]")) ?? "",
  ),
  "invalid-email banner renders",
);
await ctx3.close();

await browser.close();
await sql.end();
console.log("\nall checks passed");
