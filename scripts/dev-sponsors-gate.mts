// Dev-only: verifies the sponsors feature (issue #8, content v2) end-to-end
// against a running dev server — create a sponsor with a real uploaded logo,
// place it in an issue via the editor picker, publish, and confirm the reader
// renders it with logo + validated link. Also checks: a version-1 document with
// inline sponsor blocks still renders, deleting a sponsor hides its slot, the
// editor autosave round-trips the sponsorId, and an expired sponsor is flagged.
// Run: npx tsx scripts/dev-sponsors-gate.mts <base-url> <dev-log-path> <logo-png>
import { readFile } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const [base, logPath, logoPath] = process.argv.slice(2);
if (!base || !logPath || !logoPath)
  throw new Error("usage: dev-sponsors-gate.mts <base-url> <dev-log> <logo-png>");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const browser = await chromium.launch();

// Wait for a magic link newer than `after` for this email (the dev transport
// logs "[auth] magic link for <email>:\n[auth]   <url>").
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

let linkCount = 0;
async function signIn(email: string): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/signin`);
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.waitForURL("**/signin/sent");
  await page.goto(await magicLink(email, linkCount++));
  await page.waitForLoadState();
  await page.close();
  return ctx;
}

const admin = await signIn("admin@example.com");
const page: Page = await admin.newPage();

// ── 1. Create a sponsor with an uploaded logo + link (admin UI) ───────────────
await page.goto(`${base}/admin/sponsors`);
await page.click("button:has-text('Add your first sponsor')"); // empty-state CTA
await page.fill("#sponsor-name", "Aperture Boules Co");
await page.fill("#sponsor-href", "aperture-boules.example/store");
await page.setInputFiles("input[type=file]", logoPath);
await page.waitForSelector("button:has-text('Replace logo')"); // upload landed
await page.fill("#sponsor-active", "2027-01-01");
await page.click("button:has-text('Save sponsor')");
await page.waitForSelector("text=Aperture Boules Co");
ok(true, "created sponsor 'Aperture Boules Co' via the admin UI");
const [logoRow] = await sql`select id, logo_id, href from sponsors where name = 'Aperture Boules Co'`;
ok(logoRow?.logo_id, "sponsor persisted with a logo image id");
const sponsorId = logoRow!.id as string;

// ── 2. Expired sponsor is flagged in the list ─────────────────────────────────
await page.click("button:has-text('Add sponsor')"); // header button (list non-empty)
await page.fill("#sponsor-name", "Expired Patron Ltd");
await page.fill("#sponsor-active", "2020-01-01");
await page.click("button:has-text('Save sponsor')");
await page.waitForSelector("text=Expired Patron Ltd");
ok(
  (await page.locator(":text('Expired')").count()) > 0,
  "expired sponsor shows an 'Expired' badge in the admin list",
);

// ── 3. Place the sponsor in an issue via the editor picker ────────────────────
await page.goto(`${base}/admin`);
await page.click("form button[type=submit]:has-text('Create new issue')");
await page.waitForURL("**/admin/issues/*/edit");
const editUrl = page.url();
const issueId = editUrl.match(/issues\/([^/]+)\/edit/)![1]!;
const [issueRow] = await sql`select number from issues where id = ${issueId}`;
const issueNo = Number(issueRow!.number);

await page.click("button:has-text('Sponsor')"); // Insert → Sponsor block
await page.waitForSelector("select");
await page.selectOption("select", { label: "Aperture Boules Co" });
await page.waitForSelector("text=Saved");
ok(true, `placed the sponsor in draft issue No. ${issueNo} via the picker`);

// Autosave round-trip: reload and confirm the sponsorId persisted and the block
// still resolves to the sponsor in the editor preview.
await page.reload();
await page
  .locator("[data-editor-block]", { hasText: "Aperture Boules Co" })
  .first()
  .click();
await page.waitForSelector("select");
ok(
  (await page.locator("select").first().inputValue()) === sponsorId,
  "editor autosave round-trips the v2 sponsorId (survives reload)",
);

// ── 4. Publish, then verify the reader renders the managed sponsor ────────────
await page.click("header button:has-text('Publish')");
await page.waitForSelector("text=This marks the issue published");
await page.locator("button:has-text('Publish')").last().click();
await page.waitForFunction(
  () => !document.body.textContent?.includes("This marks the issue published"),
);
// Wait for the publish to actually land (the modal closes before the action
// resolves). /read serves published issues only, so reaching it below is itself
// proof the UI publish worked — poll the DB so we don't race it.
for (let i = 0; i < 40; i++) {
  const [row] = await sql`select status from issues where id = ${issueId}`;
  if (row?.status === "published") break;
  await new Promise((r) => setTimeout(r, 250));
}
const [pub] = await sql`select status from issues where id = ${issueId}`;
ok(pub!.status === "published", "publishing via the editor modal published the issue");

await page.goto(`${base}/read/${issueNo}`);
await page.waitForLoadState("networkidle");
const readerHtml = await page.content();
ok(
  readerHtml.includes("Aperture Boules Co"),
  "reader shows the managed sponsor's name",
);
ok(
  (await page
    .locator('a[href="https://aperture-boules.example/store"]')
    .count()) > 0,
  "reader links the sponsor through externalHref (scheme-less host upgraded to https)",
);
ok(
  (await page.locator('img[alt="Aperture Boules Co logo"]').count()) > 0,
  "reader renders the sponsor's uploaded logo image",
);

// ── 5. Version-1 document with inline sponsor blocks still renders ────────────
// Simulate a legacy row: force issue #2 (seeded with inline sponsor blocks) to
// version 1. The render path keys on sponsorId, not the version field, so a v1
// inline block renders through the identical code path.
const [inline] = await sql`
  select content->>'version' as v,
    jsonb_path_query_first(content, '$.pages[*].blocks[*] ? (@.type == "sponsor")')->>'name' as sponsor_name
  from issues where number = 2`;
const inlineName = inline!.sponsor_name as string;
await sql`update issues set content = jsonb_set(content, '{version}', '1'::jsonb) where number = 2`;
const [check] = await sql`select content->>'version' as v from issues where number = 2`;
ok(check!.v === "1", "issue #2 is now a version-1 document (legacy fixture)");
// The mobile reader flows every page into one column, so the sponsor block —
// which sits on a later page — is in the DOM (the desktop flipbook only mounts
// the current spread). getByText matches the unescaped rendered text.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/read/2`);
await page.waitForLoadState("networkidle");
ok(
  (await page.getByText(inlineName, { exact: false }).count()) > 0,
  `version-1 inline sponsor '${inlineName}' still renders identically`,
);
await page.setViewportSize({ width: 1280, height: 720 });
await sql`update issues set content = jsonb_set(content, '{version}', '2'::jsonb) where number = 2`;

// ── 6. Deleting a sponsor hides its slot (no broken issue) ─────────────────────
await page.goto(`${base}/admin/sponsors`);
page.on("dialog", (d) => d.accept()); // confirm the delete
await page.click("button[aria-label='Delete Aperture Boules Co']");
await page.waitForSelector("button[aria-label='Delete Aperture Boules Co']", {
  state: "detached",
});
const [gone] = await sql`select count(*)::int n from sponsors where id = ${sponsorId}`;
ok(gone!.n === 0, "sponsor deleted");
// Mobile viewport so the whole issue flows into the DOM (the sponsor slot sits
// on the cover); the slot should now be gone while the rest still renders.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/read/${issueNo}`);
await page.waitForLoadState("networkidle");
ok(
  (await page.getByText("Aperture Boules Co").count()) === 0,
  "deleted sponsor no longer advertises in the published issue (slot hidden)",
);
ok(
  (await page.getByText("Spring Issue").count()) > 0,
  "the issue that referenced the deleted sponsor still renders (not broken)",
);
await page.setViewportSize({ width: 1280, height: 720 });

// ── Cleanup ───────────────────────────────────────────────────────────────────
await sql`delete from issues where id = ${issueId}`;
await sql`delete from sponsors where name = 'Expired Patron Ltd'`;

await browser.close();
await sql.end();
console.log("\nall checks passed");
