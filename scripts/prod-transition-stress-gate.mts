// Production-build stress gate: the flows that leave a page through a client
// transition must always commit. Under Next 16.3.1-16.3.4 the CSP blocked a
// loading-boundary chunk (#319) and Create new issue, Sign out and the reader's
// "Sign in to join" link intermittently stayed put (#276, #296, #332, #335).
// Each trial is a fresh browser context; a trial is STUCK if the destination
// did not appear within 8 s. Flows: create (Create new issue -> editor),
// signout-library and signout-admin (Sign out -> /signin), and, against a
// NEXT_PUBLIC_DEMO_MODE=1 build, discussion (signed-out reader -> "Sign in").
//
// Run against a production server, AUTH_URL naming it so sign-out lands here:
//   rm -rf .next && npm run build     (add NEXT_PUBLIC_DEMO_MODE=1 for `discussion`)
//   R2_ACCOUNT_ID=dummy R2_ACCESS_KEY_ID=dummy R2_SECRET_ACCESS_KEY=dummy \
//   R2_BUCKET=dummy R2_PUBLIC_URL=http://localhost:19999 EMAIL_API_KEY=x \
//   EMAIL_FROM=x@example.invalid AUTH_URL=http://localhost:3319 \
//   APP_URL=http://localhost:3319 npx next start -p 3319
//   npx tsx --tsconfig scripts/tsconfig.json scripts/prod-transition-stress-gate.mts \
//     http://localhost:3319 [trials=30] [flows=create,signout-library,signout-admin,discussion]
import postgres from "postgres";
import { chromium, type Browser, type Page } from "playwright";
import { randomUUID } from "node:crypto";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: prod-transition-stress-gate.mts <base-url>");
const trials = Number(process.argv[3] ?? 30);
const flows = (
  process.argv[4] ?? "create,signout-library,signout-admin,discussion"
).split(",");
const WAIT = 8000;
// A flow that is plainly stuck stops early instead of timing out every trial.
const MAX_STUCK = 5;
// Click soon after load (prefetches still in flight, as #296 saw), or later.
const DELAYS = [0, 100, 400, 1500];

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const stamp = randomUUID().slice(0, 8);
const userId = `stress-${stamp}`;
const tokens: string[] = [];
const issueIds: string[] = [];
const since = new Date();

async function session(): Promise<string> {
  const token = `stress-tok-${randomUUID().slice(0, 12)}`;
  tokens.push(token);
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${userId}, now() + interval '1 day')`;
  return token;
}

async function context(browser: Browser, signedIn: boolean) {
  const ctx = await browser.newContext();
  if (signedIn)
    await ctx.addCookies([
      {
        name: "authjs.session-token",
        value: await session(),
        url: base!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  return ctx;
}

const seen = (page: Page, selector: string) =>
  page
    .waitForSelector(selector, { timeout: WAIT })
    .then(() => true)
    .catch(() => false);

type Trial = (page: Page, delay: number) => Promise<boolean>;

const flowTrials: Record<string, { signedIn: boolean; run: Trial }> = {
  create: {
    signedIn: true,
    run: async (page, delay) => {
      await page.goto(`${base}/admin`, { waitUntil: "load" });
      await page.waitForTimeout(delay);
      await page.click("button:has-text('Create new issue')");
      return seen(page, "header button:text-is('Publish')");
    },
  },
  "signout-library": {
    signedIn: true,
    run: async (page, delay) => {
      await page.goto(`${base}/`, { waitUntil: "load" });
      await page.waitForTimeout(delay);
      await page.locator("button:text-is('Sign out')").first().click();
      return seen(page, "input[type=email]");
    },
  },
  // After a click-through, as #335 reproduced it.
  "signout-admin": {
    signedIn: true,
    run: async (page, delay) => {
      await page.goto(`${base}/admin`, { waitUntil: "load" });
      await page.waitForTimeout(delay);
      await page.locator("a[href='/admin/members']").first().click();
      await page.waitForURL("**/admin/members");
      await page.locator("button:text-is('Sign out')").first().click();
      return seen(page, "input[type=email]");
    },
  },
  discussion: {
    signedIn: false,
    run: async (page, delay) => {
      await page.goto(`${base}/`, { waitUntil: "load" });
      await page.waitForTimeout(delay);
      await page.locator("a[href^='/read/']").first().click();
      await page.getByRole("button", { name: "Discussion" }).first().click();
      await page.getByText("Sign in to join the discussion").click();
      return seen(page, "input[type=email]");
    },
  },
};

const [settingsRow] = await sql<{ discussionWas: boolean }[]>`
  select comments_enabled as "discussionWas" from settings limit 1`;
const discussionWas = settingsRow!.discussionWas;
await sql`insert into users (id, email, is_admin, subscribed, email_verified)
          values (${userId}, ${`${userId}@example.invalid`}, true, false, now())`;
if (flows.includes("discussion"))
  await sql`update settings set comments_enabled = true`;

const browser = await chromium.launch();
const results: string[] = [];
let stuckTotal = 0;
try {
  for (const name of flows) {
    const flow = flowTrials[name];
    if (!flow) throw new Error(`unknown flow ${name}`);
    let stuck = 0;
    let ran = 0;
    for (let i = 0; i < trials && stuck < MAX_STUCK; i++, ran++) {
      const ctx = await context(browser, flow.signedIn);
      const page = await ctx.newPage();
      let ok = false;
      try {
        ok = await flow.run(page, DELAYS[i % DELAYS.length]!);
      } catch (e) {
        console.log(`  ${name} #${i}: ${(e as Error).message.split("\n")[0]}`);
      }
      if (!ok) {
        stuck++;
        console.log(`  ${name} #${i} STUCK at ${page.url()}`);
      }
      await ctx.close();
    }
    stuckTotal += stuck;
    results.push(
      `${name}: ${ran - stuck}/${ran} committed, ${stuck} stuck${ran < trials ? ` (stopped early, ${trials} planned)` : ""}`,
    );
    console.log(results.at(-1));
  }
} finally {
  await browser.close();
  const created = await sql<{ id: string }[]>`select id from issues
    where created_at >= ${since} and title = 'Untitled draft'`;
  issueIds.push(...created.map((r) => r.id));
  if (issueIds.length)
    await sql`delete from issues where id in ${sql(issueIds)}`;
  if (flows.includes("discussion"))
    await sql`update settings set comments_enabled = ${discussionWas}`;
  await sql`delete from sessions where user_id = ${userId}`;
  await sql`delete from users where id = ${userId}`;
  await sql.end();
}
console.log(`\n${results.join("\n")}`);
if (stuckTotal) {
  console.log(`\n${stuckTotal} stuck transition(s)`);
  process.exit(1);
}
console.log("\nok — every transition committed");
