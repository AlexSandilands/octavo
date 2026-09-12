// Production-build gate: after a server action mutates an admin list, the
// row must actually leave the screen — under `next start`, where a React
// scheduling bug (see src/components/action-commit-rescue.tsx) intermittently
// wedged the revalidation re-render and left stale rows indefinitely. Each
// trial deletes a scratch row through the UI and fails if the row is still
// on screen 8s later; the bug fired on ~2/3 of trials, so a clean sweep of
// all twelve is a reliable detector. A last trial presses "Create new issue"
// and proves the browser reaches the new draft's editor — the server-action
// redirect that used to do it never landed under a production build (#276).
//
// Run against a production server:
//   rm -rf .next && npm run build
//   R2_ACCOUNT_ID=dummy R2_ACCESS_KEY_ID=dummy R2_SECRET_ACCESS_KEY=dummy \
//   R2_BUCKET=dummy R2_PUBLIC_URL=http://localhost:19999 PORT=3198 npm start
//   npx tsx --tsconfig scripts/tsconfig.json scripts/prod-action-refresh-gate.mts http://localhost:3198
import { chromium, type BrowserContext } from "playwright";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { emptyIssueContent } from "../src/lib/blocks.ts";

process.loadEnvFile?.(".env.local");
const base = process.argv[2] ?? "http://localhost:3000";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

// Run-stamped scratch rows, deleted by tracked id: concurrent runs against the
// shared dev database must not select each other's rows, nor clean them up.
const stamp = randomUUID().slice(0, 8);
const adminEmail = `i198-gate-${stamp}@example.test`;
const adminId = `i198-admin-${stamp}`;
const token = `i198-session-${stamp}`;
const sponsorIds: string[] = [];
const issueIds: string[] = [];
const memberIds: string[] = [];

const browser = await chromium.launch();

async function adminContext(): Promise<BrowserContext> {
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
  return ctx;
}

// One trial: open the page, delete the named row through its confirm dialog,
// and report whether the row left the screen within 8s. The DB is checked too
// so a stale row is always the client failing to refresh, never a failed
// action.
async function trial(
  path: string,
  deleteLabel: string,
  confirmText: string,
  dbGone: () => Promise<boolean>,
): Promise<boolean> {
  const ctx = await adminContext();
  const page = await ctx.newPage();
  await page.goto(`${base}${path}`);
  const rowButton = `button[aria-label="${deleteLabel}"]`;
  await page.waitForSelector(rowButton);
  await page.click(rowButton);
  await page.waitForSelector("[role=dialog]");
  await page.click(`[role=dialog] button:has-text("${confirmText}")`);
  let gone = true;
  try {
    await page.waitForSelector(rowButton, { state: "detached", timeout: 8000 });
  } catch {
    gone = false;
  }
  ok(await dbGone(), `the action itself committed (${deleteLabel})`);
  await ctx.close();
  return gone;
}

const failures: string[] = [];
async function sample(
  n: number,
  what: string,
  run: (i: number) => Promise<boolean>,
) {
  let passed = 0;
  for (let i = 1; i <= n; i++) {
    if (await run(i)) passed++;
    else failures.push(`${what} trial ${i}`);
  }
  console.log(`${what}: ${passed}/${n} trials refreshed the list in time`);
}

try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${adminId}, ${adminEmail}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${adminId}, now() + interval '1 day')`;

  // Sponsors — dated in the future so the scratch row opens page 1.
  await sample(6, "sponsor delete", async (i) => {
    const name = `i198 ${stamp} Sponsor ${i}`;
    const id = randomUUID();
    sponsorIds.push(id);
    await sql`insert into sponsors (id, name, created_at)
              values (${id}, ${name}, now() + interval '1 hour')`;
    return trial(
      "/admin/sponsors",
      `Delete ${name}`,
      "Delete sponsor",
      async () => {
        const [row] =
          await sql`select count(*)::int n from sponsors where id = ${id}`;
        return row!.n === 0;
      },
    );
  });

  // Issues — a fresh draft, which tops the dashboard: it lists drafts first,
  // most recently edited at the top (issue #270), and carries no number.
  await sample(3, "issue delete", async (i) => {
    const title = `i198 ${stamp} Issue ${i}`;
    const id = randomUUID();
    issueIds.push(id);
    await sql`insert into issues (id, title, content)
              values (${id}, ${title}, ${sql.json(emptyIssueContent())})`;
    return trial("/admin", `Delete ${title}`, "Delete issue", async () => {
      const [row] =
        await sql`select count(*)::int n from issues where id = ${id}`;
      return row!.n === 0;
    });
  });

  // Members — found via the search box's URL state, so paging is irrelevant.
  // The id must be a UUID: the remove action's zod gate refuses anything else.
  await sample(3, "member remove", async (i) => {
    const email = `i198-member-${stamp}-${i}@example.test`;
    const id = randomUUID();
    memberIds.push(id);
    await sql`insert into users (id, email, is_admin, subscribed, email_verified)
              values (${id}, ${email}, false, false, now())`;
    return trial(
      `/admin/members?q=${encodeURIComponent(email)}`,
      `Remove ${email}`,
      "Remove member",
      async () => {
        const [row] =
          await sql`select count(*)::int n from users where id = ${id}`;
        return row!.n === 0;
      },
    );
  });

  // Create — the action returns the new id for the button to navigate to.
  // Under a production build the redirect() it used to do never landed: the
  // router silently dropped it and the admin stayed on the dashboard (#276).
  {
    const ctx = await adminContext();
    const page = await ctx.newPage();
    const since = new Date();
    await page.goto(`${base}/admin`);
    await page.click("button:has-text('Create new issue')");
    let mounted = true;
    try {
      await page.waitForSelector("header button:text-is('Publish')", {
        timeout: 20_000,
      });
    } catch {
      mounted = false;
    }
    // Prefer the id in the URL; fall back to the newest row so a create that
    // never navigated is still cleaned up.
    const [row] = await sql`select id from issues where created_at >= ${since}
                            order by created_at desc limit 1`;
    const id = page.url().match(/\/issues\/([^/]+)\/edit/)?.[1] ?? row?.id;
    if (id) issueIds.push(id as string);
    ok(!!row, "the create action wrote a draft");
    ok(
      page.url() === `${base}/admin/issues/${row!.id}/edit`,
      `the browser landed on the new issue's editor (at ${page.url()})`,
    );
    ok(mounted, "the editor mounted after the create");
    await ctx.close();
  }

  ok(
    failures.length === 0,
    failures.length === 0
      ? "every list reflected its delete without a reload"
      : `stale rows after: ${failures.join(", ")}`,
  );
  console.log("\nall production action-refresh checks passed");
} finally {
  await browser.close();
  if (sponsorIds.length > 0)
    await sql`delete from sponsors where id in ${sql(sponsorIds)}`;
  if (issueIds.length > 0)
    await sql`delete from issues where id in ${sql(issueIds)}`;
  if (memberIds.length > 0)
    await sql`delete from users where id in ${sql(memberIds)}`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
}
process.exit(0);
