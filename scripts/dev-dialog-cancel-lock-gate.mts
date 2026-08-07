// Dev-only: proves the members dialogs refuse to be dismissed while their save
// is in flight (issue #134), headless against a running dev server.
//
// The bug: Cancel stayed pressable during the round trip. Cancelling a save
// that was about to fail unmounted the dialog, so `setError` landed on nothing
// and the admin walked away believing an edit had saved that never did. The
// shell's other exits (Escape, a backdrop press) were already refused via
// `locked` (#152) — this covers the button, on both dialogs that own one.
//
// For each dialog: hold the server action open, assert Cancel is disabled and
// that pressing it anyway leaves the dialog mounted, then let the action finish
// and assert the failure is still on screen to read.
//
// It mints its own scratch admin + session + member and removes them again in
// the finally block — it never seeds and never touches existing rows.
// Run: npx tsx scripts/dev-dialog-cancel-lock-gate.mts <base-url>
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { chromium, type Page } from "playwright";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: dev-dialog-cancel-lock-gate.mts <base-url>");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const sql = postgres(process.env.DATABASE_URL!);

const userId = crypto.randomUUID();
const otherId = crypto.randomUUID();
const token = crypto.randomUUID();
const email = `scratch-134-${userId.slice(0, 8)}@example.invalid`;
const otherEmail = `scratch-134-other-${otherId.slice(0, 8)}@example.invalid`;
const csvPath = join(tmpdir(), `scratch-134-${userId.slice(0, 8)}.csv`);

const dialogOpen = (page: Page) => page.isVisible("[role=dialog]");
const cancel = "[role=dialog] button:has-text('Cancel')";

/**
 * Park the next matching server action for `ms`, so the dialog sits in its
 * pending state long enough to be inspected. A one-shot flag rather than an
 * unroute(): tearing the handler down while its own request is still in the
 * sleep aborts it.
 */
async function stallOnce(page: Page, url: string, ms = 4000) {
  let stall = true;
  await page.route(url, async (route) => {
    if (route.request().method() === "POST" && stall) {
      stall = false;
      await new Promise((r) => setTimeout(r, ms));
    }
    return route.continue();
  });
}

/** The lock itself: disabled, and inert to a press that ignores that. */
async function checkCancelLocked(page: Page) {
  ok(
    await page.isDisabled(cancel),
    "Cancel is disabled while the save is in flight",
  );
  // force: a disabled button swallows a real click, so this drives the press
  // past the attribute — the dialog must still be here afterwards.
  await page.click(cancel, { force: true });
  await page.waitForTimeout(300);
  ok(
    await dialogOpen(page),
    "a forced press on Cancel does not dismiss the dialog mid-save",
  );
}

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${userId}, ${email}, true, false, now())`;
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${otherId}, ${otherEmail}, false, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${token}, ${userId}, now() + interval '1 day')`;
  console.log(`scratch admin ${email}, scratch member ${otherEmail}`);

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

  // ── MemberDialog: the reported case — a save that is going to fail ─────────
  heading("MemberDialog — edit, duplicate email");
  await page.goto(`${base}/admin/members?q=scratch-134-${userId.slice(0, 8)}`);
  await page.waitForSelector(`text=${email}`);
  await page.click(`button[aria-label="Edit ${email}"]`);
  await page.waitForSelector("[role=dialog]");
  ok(
    !(await page.isDisabled(cancel)),
    "Cancel is pressable before a save starts",
  );

  // Retarget the row at the *other* scratch member's address: the server
  // refuses it as a duplicate, which is the failure the admin has to see.
  await page.fill("#member-email", otherEmail);
  await stallOnce(page, "**/admin/members**");
  await page.click("[role=dialog] button:has-text('Save changes')");
  await page.waitForSelector("[role=dialog] button:has-text('Saving…')");
  ok(true, "the save is in flight (the button reads Saving…)");

  await checkCancelLocked(page);

  // The point of the lock: the dialog is still mounted when the answer lands,
  // so the error has somewhere to render.
  await page.waitForSelector(
    "[role=dialog] :text('That address already belongs to another member.')",
    { timeout: 20_000 },
  );
  ok(true, "the duplicate error rendered on the still-mounted dialog");
  ok(await dialogOpen(page), "the failing save left the dialog open");
  ok(
    !(await page.isDisabled(cancel)),
    "Cancel is pressable again once the save has failed",
  );

  // And the admin can now actually leave.
  await page.click(cancel);
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  ok(true, "Cancel closes the dialog once the save is no longer in flight");

  // The refused edit never reached the database.
  const [row] = await sql<{ email: string }[]>`
    select email from users where id = ${userId}`;
  ok(
    row!.email === email,
    `the refused edit did not change the row (still ${row!.email})`,
  );

  // ── ImportDialog: the same lock on the same class of dismiss ───────────────
  heading("ImportDialog — import in flight");
  await writeFile(
    csvPath,
    `email,name\nscratch-134-import-a@example.invalid,Scratch Import A\nscratch-134-import-b@example.invalid,Scratch Import B\n`,
  );
  await page.goto(`${base}/admin/members`);
  await page.waitForSelector("button:has-text('Import CSV')");
  await page.click("button:has-text('Import CSV')");
  await page.waitForSelector("[role=dialog]");
  await page.setInputFiles("[role=dialog] input[type=file]", csvPath);
  await page.waitForSelector("[role=dialog] button:has-text('Import 2')");
  ok(
    !(await page.isDisabled(cancel)),
    "Cancel is pressable before the import starts",
  );

  await stallOnce(page, "**/admin/members**");
  await page.click("[role=dialog] button:has-text('Import 2')");
  await page.waitForSelector("[role=dialog] button:has-text('Importing…')");
  ok(true, "the import is in flight (the button reads Importing…)");

  await checkCancelLocked(page);

  await page.waitForSelector("[role=dialog] button:has-text('Done')", {
    timeout: 20_000,
  });
  ok(true, "the import finished and the dialog is showing its summary");
  // The summary paints a tick before the transition ends (the action's
  // revalidation is still settling), so Done is briefly disabled with it on
  // screen. Waited for rather than sampled once: what matters is that the lock
  // lets go promptly, not which side of that tick this assertion lands on.
  await page
    .locator("[role=dialog] button:has-text('Done')")
    .waitFor({ state: "attached", timeout: 5000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLButtonElement>(
        "[role=dialog] button",
      );
      return el?.textContent?.trim() === "Done" && !el.disabled;
    },
    undefined,
    { timeout: 5000 },
  );
  ok(
    true,
    "Done becomes pressable on the summary — the lock only holds in flight",
  );

  await ctx.close();
  console.log("\nPASS — no members dialog can be dismissed mid-save (#134)");
} finally {
  await browser.close();
  // By pattern, not just by id: a run that dies mid-way still has to leave the
  // shared dev database exactly as it found it.
  await sql`delete from sessions where session_token = ${token}
              or user_id in (select id from users
                             where email like ${"scratch-134%"})`;
  await sql`delete from users where id in (${userId}, ${otherId})
              or email like ${"scratch-134%"}`;
  console.log("scratch rows removed");
  await sql.end();
}
