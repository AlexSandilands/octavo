// Browser gate for issue #258. Against a migrated dev server it verifies the
// running-head setting and the split between immutable route identity and the
// editable number shown to readers, including on published issues.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json \
//   scripts/dev-running-head-number-gate.mts <base-url>
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import postgres from "postgres";
import { emptyIssueContent } from "../src/lib/blocks.ts";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  process.loadEnvFile?.(".env");
}

const base = process.argv[2] ?? "http://localhost:3000";
const printToken = createHash("sha256")
  .update(`${process.env.AUTH_SECRET}:pdf-print`)
  .digest("hex");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok — ${message}`);
};

const stamp = randomUUID().slice(0, 8);
const adminId = randomUUID();
const sessionToken = `i258-session-${stamp}`;
const draftId = randomUUID();
const publishedId = randomUUID();
const draftTitle = `Kiln & Wheel — The Guild Annual ${stamp}`;
const publishedTitle = `i258 published ${stamp}`;
const createdIds: string[] = [draftId, publishedId];
const [maxRow] = await sql`
  select greatest(
    coalesce(max(number), 0),
    coalesce(max(coalesce(display_number, number)), 0)
  )::int n from issues`;
const sequenceBase = maxRow!.n as number;
const publishedRouteNumber = sequenceBase + 1;
const draftRouteNumber = sequenceBase + 2;
const draftGapNumber = sequenceBase + 5;
const correctedDraftNumber = sequenceBase + 2;
const correctedPublishedNumber = sequenceBase + 3;
const nextDisplayNumber = sequenceBase + 4;

const [storedSettings] = await sql`
  select magazine_name, org_name, tagline, footer_mark_size, footer_text_size,
         footer_align, show_running_head, pdf_downloads_enabled, updated_at
  from settings where id = 1`;

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${adminId}, ${`i258-${stamp}@example.test`}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${sessionToken}, ${adminId}, now() + interval '1 day')`;
  await sql`
    insert into issues
      (id, number, display_number, title, status, content, published_at)
    values
      (${publishedId}, ${publishedRouteNumber}, null,
       ${publishedTitle}, 'published',
       ${sql.json(emptyIssueContent())}, now()),
      (${draftId}, ${draftRouteNumber}, ${draftGapNumber},
       ${draftTitle}, 'draft',
       ${sql.json(emptyIssueContent())}, null)`;
  if (storedSettings) {
    await sql`update settings set show_running_head = null where id = 1`;
  }

  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();

  await page.goto(`${base}/admin/magazine`);
  const runningHead = page.getByRole("checkbox", {
    name: /Show magazine name and issue number/,
  });
  ok(
    await runningHead.isChecked(),
    "an unset running-head setting defaults to shown",
  );
  await page.getByText(/· No\. 12/).waitFor();
  ok(true, "running head is visible in the live preview when enabled");
  await runningHead.uncheck();
  await page.getByText(/· No\. 12/).waitFor({ state: "detached" });
  ok(
    (await page
      .locator(".border-page-frame, .border-page-frame-soft")
      .count()) === 2,
    "hiding the text leaves both classic frame rules in the preview",
  );
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Saved — live on the site now.").waitFor();
  const [savedSetting] =
    await sql`select show_running_head from settings where id = 1`;
  ok(savedSetting!.show_running_head === false, "running-head choice persists");
  const printed = await context.request.get(
    `${base}/read/${publishedRouteNumber}/print?token=${printToken}`,
  );
  const printHtml = await printed.text();
  ok(
    printHtml.includes("border-page-frame") &&
      !printHtml.includes(`· No. ${publishedRouteNumber}`),
    "print/PDF chrome hides only the running-head text",
  );

  await page.goto(`${base}/admin/issues/${draftId}/edit`);
  const numberTrigger = page.getByRole("button", {
    name: `Edit display number, currently ${draftGapNumber}`,
  });
  const [titleBox, triggerBox] = await Promise.all([
    page.locator('input[placeholder="Untitled issue"]').boundingBox(),
    numberTrigger.boundingBox(),
  ]);
  ok(
    titleBox &&
      triggerBox &&
      titleBox.width >= 160 &&
      titleBox.x + titleBox.width <= triggerBox.x,
    "the compact number trigger leaves usable, non-overlapping title space",
  );
  if (process.env.ISSUE_258_SCREENSHOTS) {
    await page.screenshot({
      path: "/tmp/octavo-number-collapsed.png",
      clip: { x: 0, y: 0, width: 1280, height: 90 },
    });
  }
  await numberTrigger.click();
  if (process.env.ISSUE_258_SCREENSHOTS) {
    await page.screenshot({
      path: "/tmp/octavo-number-popover.png",
      clip: { x: 0, y: 0, width: 1280, height: 360 },
    });
  }
  const numberInput = page.getByRole("textbox", {
    name: "Display number",
    exact: true,
  });
  ok(
    (await numberInput.inputValue()) === String(draftGapNumber),
    "the editor uses an explicitly assigned display number",
  );
  await numberInput.fill(String(publishedRouteNumber));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("alert")
    .getByText("That displayed issue number is already in use.")
    .waitFor();
  ok(true, "a fallback display number participates in uniqueness checks");

  await numberInput.fill("asd");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("alert").getByText("Use whole numbers only.").waitFor();
  ok(true, "invalid display number is rejected with a visible message");

  await numberInput.fill(String(correctedDraftNumber));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", {
      name: `Edit display number, currently ${correctedDraftNumber}`,
    })
    .waitFor();
  const [renumberedDraft] = await sql`
    select number, display_number from issues where id = ${draftId}`;
  ok(
    renumberedDraft!.number === draftRouteNumber &&
      renumberedDraft!.display_number === correctedDraftNumber,
    "changing the draft display number leaves its route identity untouched",
  );

  await page.goto(`${base}/admin/issues/${publishedId}/edit`);
  await page
    .getByRole("button", {
      name: `Edit display number, currently ${publishedRouteNumber}`,
    })
    .click();
  const publishedInput = page.getByRole("textbox", {
    name: "Display number",
    exact: true,
  });
  ok(
    (await publishedInput.inputValue()) === String(publishedRouteNumber),
    "a null display number falls back to the route identity",
  );
  await publishedInput.fill(String(correctedPublishedNumber));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", {
      name: `Edit display number, currently ${correctedPublishedNumber}`,
    })
    .waitFor();
  const [renumberedPublished] = await sql`
    select number, display_number from issues where id = ${publishedId}`;
  ok(
    renumberedPublished!.number === publishedRouteNumber &&
      renumberedPublished!.display_number === correctedPublishedNumber,
    "a published issue's displayed number can change without changing identity",
  );
  const read = await page.goto(`${base}/read/${publishedRouteNumber}`);
  ok(read?.ok(), "the published issue keeps its existing reader URL");
  await page.getByText(`No. ${correctedPublishedNumber}`).first().waitFor();
  ok(true, "the reader renders the corrected display number");

  // Re-enable the textual head for this assertion: with it hidden and the
  // legacy text-only footer selected, the fixed print pages intentionally draw
  // no issue number at all.
  await sql`update settings set show_running_head = true where id = 1`;
  const printPage = await context.newPage();
  await printPage.goto(
    `${base}/read/${publishedRouteNumber}/print?token=${printToken}`,
  );
  const printText = await printPage.locator("body").textContent();
  await printPage.close();
  ok(
    printText?.includes(`No. ${correctedPublishedNumber}`),
    "the PDF print document renders the corrected display number",
  );

  await page.goto(base);
  const latestLink = page.getByRole("link", {
    name: `Read ${publishedTitle}`,
  });
  ok(
    (await latestLink.getAttribute("href")) === `/read/${publishedRouteNumber}`,
    "the library shows the corrected issue while linking by route identity",
  );
  await page
    .getByText(new RegExp(`No\\. ${correctedPublishedNumber} ·`))
    .waitFor();

  await page.goto(`${base}/admin`);
  const publishedRow = page.getByText(publishedTitle).locator("../..");
  await publishedRow.getByText(`No. ${correctedPublishedNumber}`).waitFor();
  ok(true, "the dashboard renders the assigned display number");

  await page.getByRole("button", { name: /Create new issue/i }).click();
  let created:
    | { id: string; number: number; display_number: number | null }
    | undefined;
  for (let attempt = 0; attempt < 40 && !created; attempt++) {
    [created] = await sql`
      select id, number, display_number from issues
      where title = 'Untitled draft' and number > ${draftRouteNumber}
      order by number desc limit 1`;
    if (!created) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  ok(created, "created a follow-on draft through the admin UI");
  createdIds.push(created!.id);
  ok(
    created!.number === draftRouteNumber + 1 &&
      created!.display_number === nextDisplayNumber,
    "new identity and display sequences advance independently",
  );

  await context.close();
  console.log("\nall issue #258 browser checks passed");
} finally {
  await browser.close();
  await sql`delete from issues where id in ${sql(createdIds)}`;
  await sql`delete from sessions where session_token = ${sessionToken}`;
  await sql`delete from users where id = ${adminId}`;
  if (storedSettings) {
    await sql`update settings set
      magazine_name = ${storedSettings.magazine_name},
      org_name = ${storedSettings.org_name},
      tagline = ${storedSettings.tagline},
      footer_mark_size = ${storedSettings.footer_mark_size},
      footer_text_size = ${storedSettings.footer_text_size},
      footer_align = ${storedSettings.footer_align},
      show_running_head = ${storedSettings.show_running_head},
      pdf_downloads_enabled = ${storedSettings.pdf_downloads_enabled},
      updated_at = ${storedSettings.updated_at}
      where id = 1`;
  } else {
    await sql`delete from settings where id = 1`;
  }
  await sql.end();
}
