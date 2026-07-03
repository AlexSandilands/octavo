// Dev-only e2e for the publish → email blast (issue #9), headless against a
// running dev server. Mirrors the other dev-*.mts scripts: drive the real UI
// with Playwright, harvest the console-logged links from the dev-server log,
// and assert against the DB directly.
//
// Verifies: distinct per-member magic links (none for the unsubscribed member);
// each link signs the right member in and opens /read/[number]; a link is
// single-use; the unsubscribe link works with no session, is per-user, and
// rejects a tampered token; publishing with email off sends nothing; and a
// re-publish defaults email off.
//
// Run: npx tsx scripts/dev-publish-email.mts <base-url> <dev-log-path>
// Restores the users table to its two canonical rows and removes the test
// issues it creates.
import { readFile } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const [base, logPath] = process.argv.slice(2);
if (!base || !logPath)
  throw new Error("usage: dev-publish-email.mts <base-url> <dev-log>");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ADMIN = "profile.alex@proton.me";
const MEMBER = "member@example.com";
const SUB1 = "testsub1@example.com";
const SUB2 = "testsub2@example.com";
const UNSUB = "testunsub@example.com";
const TEST_EMAILS = [SUB1, SUB2, UNSUB];

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const subscribedOf = async (email: string) =>
  (await sql`select subscribed from users where email = ${email}`)[0]
    ?.subscribed as boolean | undefined;

const sessionCount = async (email: string) =>
  Number(
    (
      await sql`select count(*)::int as n from sessions s
                 join users u on u.id = s.user_id where u.email = ${email}`
    )[0]!.n,
  );

// Harvest the newest link for `email` matching `label` ("magic link" | "unsubscribe"),
// waiting until more than `after` exist so an earlier run/link can't fool us.
async function link(
  label: "magic link" | "unsubscribe",
  email: string,
  after: number,
): Promise<string> {
  const tag = label === "magic link" ? "auth" : "publish";
  const re = new RegExp(
    `\\[${tag}\\] ${label} for ${email.replace(/[.@]/g, "\\$&")}:\\n\\[${tag}\\] {3}(http\\S+)`,
    "g",
  );
  for (let i = 0; i < 40; i++) {
    const found = [...(await readFile(logPath!, "utf8")).matchAll(re)];
    if (found.length > after) return found.at(-1)![1]!;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no new ${label} for ${email}`);
}

const countLinks = async (label: "magic link" | "unsubscribe", email: string) => {
  const tag = label === "magic link" ? "auth" : "publish";
  const re = new RegExp(
    `\\[${tag}\\] ${label} for ${email.replace(/[.@]/g, "\\$&")}:`,
    "g",
  );
  return [...(await readFile(logPath!, "utf8")).matchAll(re)].length;
};

const browser = await chromium.launch();

// Admin signs in through the normal /signin form (its link uses the same
// "[auth] magic link for <email>" shape; we harvest by the admin's address so
// it never collides with the blast links).
async function signInAdmin(): Promise<BrowserContext> {
  const before = await countLinks("magic link", ADMIN);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/signin`);
  await page.fill("#email", ADMIN);
  await page.click("button[type=submit]");
  await page.waitForURL("**/signin/sent");
  const url = await link("magic link", ADMIN, before);
  await page.goto(url);
  await page.waitForLoadState();
  await page.close();
  return ctx;
}

// Create a fresh draft from /admin; return its {id, number}.
async function createDraft(admin: BrowserContext): Promise<{ id: string; number: number }> {
  const page = await admin.newPage();
  await page.goto(`${base}/admin`);
  await page.click("button:has-text('Create new issue')");
  await page.waitForURL("**/admin/issues/**/edit");
  const id = new URL(page.url()).pathname.split("/")[3]!;
  const row = (await sql`select number from issues where id = ${id}`)[0]!;
  await page.close();
  return { id, number: Number(row.number) };
}

// Open the publish modal in the editor for an already-open editor page and
// return the dialog locator (scopes clicks so the modal's "Publish" button
// can't be confused with the header's).
async function openPublishModal(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: "Publish" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return dialog;
}

try {
  // ── Setup: exactly two subscribed members (SUB1, SUB2), one unsubscribed. ──
  await sql`delete from verification_tokens where identifier = any(${TEST_EMAILS})`;
  await sql`delete from users where email = any(${TEST_EMAILS})`;
  // id is app-generated (Drizzle $defaultFn), so there's no DB default —
  // supply one for the raw insert.
  await sql`insert into users (id, email, subscribed, is_admin) values
    (gen_random_uuid()::text, ${SUB1}, true, false),
    (gen_random_uuid()::text, ${SUB2}, true, false),
    (gen_random_uuid()::text, ${UNSUB}, false, false)`;
  // Quiet the canonical members so the blast targets only the two test subs.
  await sql`update users set subscribed = false where email in (${ADMIN}, ${MEMBER})`;

  const admin = await signInAdmin();

  // ── Publish with email ON → each subscribed member gets a distinct link. ──
  const sub1Before = await countLinks("magic link", SUB1);
  const sub2Before = await countLinks("magic link", SUB2);
  const unsubBefore = await countLinks("magic link", UNSUB);

  const draft = await createDraft(admin);
  const editor = await admin.newPage();
  await editor.goto(`${base}/admin/issues/${draft.id}/edit`);
  const modal = await openPublishModal(editor);

  ok(
    await modal.getByText("2 subscribed members").isVisible(),
    "modal reports the real subscriber count (2)",
  );
  ok(
    await modal.getByRole("checkbox").isChecked(),
    "email checkbox defaults ON for a draft",
  );
  await modal.getByRole("button", { name: "Publish & send" }).click();
  await editor.waitForSelector("text=is live");
  ok(
    await editor.isVisible("text=Emailed 2 members"),
    "result state reports Emailed 2 members",
  );
  await editor.close();

  ok(
    (await sql`select status from issues where id = ${draft.id}`)[0]!.status ===
      "published",
    "issue is published in the DB",
  );

  const sub1Link = await link("magic link", SUB1, sub1Before);
  const sub2Link = await link("magic link", SUB2, sub2Before);
  ok(sub1Link !== sub2Link, "the two members get distinct magic links");
  ok(
    (await countLinks("magic link", UNSUB)) === unsubBefore,
    "the unsubscribed member got no magic link",
  );

  // ── The magic link signs the right member in and lands on the issue. ──
  const sub1Ctx = await browser.newContext();
  const sub1Page = await sub1Ctx.newPage();
  await sub1Page.goto(sub1Link);
  await sub1Page.waitForLoadState();
  ok(
    new URL(sub1Page.url()).pathname === `/read/${draft.number}`,
    "SUB1's link lands directly on /read/[number]",
  );
  ok((await sessionCount(SUB1)) >= 1, "SUB1 now has a live session (signed in)");
  ok((await sessionCount(SUB2)) === 0, "SUB2 has no session (its link is unused)");
  await sub1Ctx.close();

  // ── Single-use: the same link a second time does NOT sign in. ──
  const replay = await browser.newContext();
  const replayPage = await replay.newPage();
  await replayPage.goto(sub1Link);
  await replayPage.waitForLoadState();
  ok(
    new URL(replayPage.url()).pathname !== `/read/${draft.number}`,
    "reusing a spent magic link does not open the issue (single-use)",
  );
  await replay.close();

  // ── Unsubscribe: signed link, no session, per-user, tamper-proof. ──
  const unsubUrl = await link("unsubscribe", SUB2, 0);
  const token = new URL(unsubUrl).searchParams.get("token")!;

  // Tampered token → neutral invalid page, no mutation.
  const tampered = token.slice(0, -1) + (token.at(-1) === "A" ? "B" : "A");
  const tctx = await browser.newContext();
  const tpage = await tctx.newPage();
  await tpage.goto(`${base}/unsubscribe?token=${encodeURIComponent(tampered)}`);
  ok(
    await tpage.isVisible("text=isn’t valid"),
    "a tampered unsubscribe token shows the neutral invalid page",
  );
  ok(
    (await subscribedOf(SUB2)) === true,
    "tampered token did not change SUB2's subscription",
  );
  await tctx.close();

  // Valid unsubscribe from a fresh, signed-out context.
  const uctx = await browser.newContext();
  const upage = await uctx.newPage();
  await upage.goto(unsubUrl);
  ok(
    await upage.isVisible(`text=${SUB2}`),
    "valid unsubscribe link greets the token's owner by address",
  );
  await upage.getByRole("button", { name: "Unsubscribe" }).click();
  await upage.waitForSelector("text=been unsubscribed");
  ok((await subscribedOf(SUB2)) === false, "SUB2 is now unsubscribed");
  ok(
    (await subscribedOf(SUB1)) === true,
    "SUB1 is untouched — the token only affects its own user",
  );

  // Resubscribe (idempotent, reversible) leaves SUB2 subscribed again.
  await upage.getByRole("button", { name: "Resubscribe" }).click();
  await upage.waitForSelector("text=Unsubscribe from");
  ok((await subscribedOf(SUB2)) === true, "resubscribe restores SUB2");
  await uctx.close();

  // ── Publish with email OFF sends nothing but still publishes. ──
  const sub1LinksBefore = await countLinks("magic link", SUB1);
  const sub2LinksBefore = await countLinks("magic link", SUB2);
  const draft2 = await createDraft(admin);
  const editor2 = await admin.newPage();
  await editor2.goto(`${base}/admin/issues/${draft2.id}/edit`);
  const modal2 = await openPublishModal(editor2);
  await modal2.getByRole("checkbox").uncheck();
  await modal2.getByRole("button", { name: "Publish", exact: true }).click();
  await editor2.waitForSelector("text=is live");
  ok(
    await editor2.isVisible("text=without emailing"),
    "email-off publish reports it sent nothing",
  );
  await editor2.close();
  ok(
    (await sql`select status from issues where id = ${draft2.id}`)[0]!.status ===
      "published",
    "email-off issue is still published",
  );
  ok(
    (await countLinks("magic link", SUB1)) === sub1LinksBefore &&
      (await countLinks("magic link", SUB2)) === sub2LinksBefore,
    "email-off publish logged no new magic links",
  );

  // ── Re-open publish on an already-published issue → email defaults OFF. ──
  const editor3 = await admin.newPage();
  await editor3.goto(`${base}/admin/issues/${draft.id}/edit`);
  const modal3 = await openPublishModal(editor3);
  ok(
    !(await modal3.getByRole("checkbox").isChecked()),
    "re-publish of a published issue defaults email OFF (no accidental re-blast)",
  );
  await editor3.close();

  console.log("\nall checks passed");
} finally {
  // ── Restore: two canonical users, subscribed; drop test users + issues. ──
  await sql`delete from verification_tokens where identifier = any(${TEST_EMAILS})`;
  await sql`delete from users where email = any(${TEST_EMAILS})`;
  await sql`update users set subscribed = true where email in (${ADMIN}, ${MEMBER})`;
  await sql`update users set is_admin = true where email = ${ADMIN}`;
  await sql`delete from issues where title = 'Untitled draft' and status in ('draft','published') and number > 10`;
  await sql.end();
  await browser.close();
}
