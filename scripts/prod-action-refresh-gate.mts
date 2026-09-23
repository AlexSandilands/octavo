// Production-build gate: after a server action mutates an admin list, the
// row must actually leave the screen — under `next start`, where a React
// scheduling bug (#198, fixed in #201) intermittently wedged the revalidation
// re-render and left stale rows indefinitely. Each trial deletes a scratch row
// through the UI and fails if the row is still on screen 8s later; the bug
// fired on ~2/3 of trials, so a clean sweep of all twelve is a reliable
// detector. Twenty more press "Create new issue" and must land in the editor,
// then find the draft on Back: that failure is intermittent (#276, #296), so
// one trial proves nothing. A last case checks a failed create reaches the
// error boundary rather than stranding the button. The reports inbox (#302)
// runs the same trial for Resolve, Hide comment and Delete comment.
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
import { expandMember } from "./check-member-disclosure.mts";
import { reportsFixtures } from "./fixtures/reports-fixtures.mts";

process.loadEnvFile?.(".env.local");
const base = process.argv[2] ?? "http://localhost:3000";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const reports = reportsFixtures(sql, "refresh");
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
  await page.waitForSelector(rowButton, { state: "attached" });
  if (path.startsWith("/admin/members")) {
    await expandMember(
      page.locator(".members-row").filter({ has: page.locator(rowButton) }),
    );
  }
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
  outcome = "refreshed the list in time",
) {
  let passed = 0;
  for (let i = 1; i <= n; i++) {
    if (await run(i)) passed++;
    else failures.push(`${what} trial ${i}`);
  }
  console.log(`${what}: ${passed}/${n} trials ${outcome}`);
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

  // Reports inbox (#302) — each trial reports a fresh comment and acts on it;
  // every action takes the row out of the Open view.
  const reportIssue = await reports.issue();
  const author = await reports.user(`${reports.stamp} Author`);
  const reporter = await reports.user(`${reports.stamp} Reporter`);
  const authorName = await reports.name(author.id, "Author Name");
  const actions = [
    ["Resolve report of the comment by Author Name", null],
    ["Hide comment by Author Name", null],
    ["Delete comment by Author Name", "Delete comment"],
  ] as const;
  await sample(6, "report action", async (i) => {
    const [button, confirmText] = actions[(i - 1) % actions.length]!;
    const body = `Refresh trial ${i}`;
    const comment = await reports.comment(
      reportIssue,
      author,
      authorName,
      body,
    );
    const reportId = await reports.report(comment, reporter.id);
    const ctx = await adminContext();
    const page = await ctx.newPage();
    await page.goto(
      `${base}/admin/reports?q=${encodeURIComponent(reports.stamp)}`,
    );
    const row = page.locator("article").filter({ hasText: body });
    await row.getByRole("button", { name: button }).click();
    if (confirmText) {
      await page
        .getByRole("dialog")
        .getByRole("button", { name: confirmText })
        .click();
    }
    let gone = true;
    try {
      await row.waitFor({ state: "detached", timeout: 8000 });
    } catch {
      gone = false;
    }
    const [done] =
      await sql`select status from comment_reports where id = ${reportId}`;
    ok(done?.status === "resolved", `the action itself committed (${button})`);
    await ctx.close();
    return gone;
  });

  // Create — pressing the button must land in the new draft's editor (#276).
  await sample(
    20,
    "create then edit",
    async () => {
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
      // Prefer the id in the URL; fall back to the newest untouched draft so a
      // create that never navigated is still cleaned up.
      const [row] = await sql<{ id: string }[]>`select id from issues
        where created_at >= ${since} and title = 'Untitled draft'
        order by created_at desc limit 1`;
      const id = page.url().match(/\/issues\/([^/]+)\/edit/)?.[1] ?? row?.id;
      if (id) issueIds.push(id);
      ok(!!row, "the create action wrote a draft");
      const landed = page.url() === `${base}/admin/issues/${row!.id}/edit`;
      if (!landed) console.log(`  (stayed at ${page.url()})`);
      // Back to the dashboard must still show the new draft — keyed by id,
      // since other 'Untitled draft' rows may already be on screen.
      let backShowsDraft = true;
      if (landed) {
        await page.goBack();
        try {
          await page.waitForSelector(
            `a[href="/admin/issues/${row!.id}/edit"]`,
            { timeout: 8000 },
          );
        } catch {
          backShowsDraft = false;
          console.log(`  (draft ${row!.id} missing from dashboard after Back)`);
        }
      }
      await ctx.close();
      return landed && mounted && backShowsDraft;
    },
    "landed in the editor",
  );

  // A dropped create request must land in the error boundary, not strand the
  // button on "Creating…" — and must write no draft (#296 review).
  await sample(
    1,
    "failed create",
    async () => {
      const ctx = await adminContext();
      const page = await ctx.newPage();
      const since = new Date();
      await page.route("**/admin", (route) =>
        route.request().method() === "POST" ? route.abort() : route.continue(),
      );
      await page.goto(`${base}/admin`);
      await page.click("button:has-text('Create new issue')");
      let onErrorBoundary = true;
      try {
        await page.waitForSelector("text=The admin area hit a snag.", {
          timeout: 8000,
        });
      } catch {
        onErrorBoundary = false;
      }
      const [row] = await sql<{ n: number }[]>`select count(*)::int n
        from issues where created_at >= ${since} and title = 'Untitled draft'`;
      ok(row!.n === 0, "a failed create wrote no draft");
      await ctx.close();
      return onErrorBoundary;
    },
    "reached the error boundary",
  );

  ok(
    failures.length === 0,
    failures.length === 0
      ? "every list reflected its delete without a reload"
      : `failed: ${failures.join(", ")}`,
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
  await reports.cleanup();
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
}
process.exit(0);
