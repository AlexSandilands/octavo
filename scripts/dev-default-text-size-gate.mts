// Dev-only: the magazine's default text size (issue #25) headless against a
// running dev server. The owner picks it at /admin/magazine; text added from
// then on starts at it, and nothing already written moves: an existing
// paragraph keeps its size on the canvas and its stored JSON is byte-identical.
// Also checks the preview page follows the unsaved choice, and the editor's
// size control shows the new paragraph's size.
//
// Mints its own scratch admin, session and draft issue, and puts the `settings`
// row back as it found it (or removes it). Never seeds.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-default-text-size-gate.mts <base-url>
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { chromium, type Page } from "playwright";
import type { IssueContent } from "../src/lib/blocks";
import { hashSessionToken } from "../src/lib/session-token.ts";

const base = process.argv[2] ?? "http://localhost:3325";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
for (const file of [".env", ".env.local"])
  if (existsSync(file)) process.loadEnvFile(file);

const sql = postgres(process.env.DATABASE_URL!);
const userId = crypto.randomUUID();
const issueId = crypto.randomUUID();
const token = crypto.randomUUID();
const email = `scratch-25-${userId.slice(0, 8)}@example.invalid`;

const ok = (cond: unknown, msg: string) => {
  assert(cond, `FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const content: IssueContent = {
  version: 10,
  pages: [
    {
      id: "p-cover",
      cover: true,
      blocks: [
        { id: "cv-h", type: "heading", kicker: "Scratch", title: "Scratch 25" },
      ],
    },
    {
      id: "p2",
      blocks: [{ id: "old", type: "text", text: "<p>An older paragraph.</p>" }],
    },
    { id: "p3", blocks: [] },
  ],
};

const stored = async () => {
  const [row] = await sql<
    { content: IssueContent }[]
  >`select content from issues where id = ${issueId}`;
  return row!.content;
};
const savedSize = async () => {
  const [row] = await sql<
    { size: string | null }[]
  >`select default_text_size as size from settings where id = 1`;
  return row?.size ?? null;
};
const fontSizeOf = (page: Page, selector: string) =>
  page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)!).fontSize,
    selector,
  );

// Save writes every field of the form, so the whole row is put back after.
const [original] = await sql`select * from settings where id = 1`;
const hadRow = Boolean(original);
const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
            values (${userId}, ${email}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
            values (${hashSessionToken(token)}, ${userId}, now() + interval '1 day')`;
  await sql`insert into issues (id, title, theme, status, content, footer_mark_size, footer_text_size)
            values (${issueId}, 'Scratch 25', 'classic', 'draft', ${sql.json(content as never)}, 36, 12)`;
  if (hadRow)
    await sql`update settings set default_text_size = null where id = 1`;

  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
  });
  await ctx.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  heading("The setting on /admin/magazine");
  await page.goto(`${base}/admin/magazine`);
  const picker = page.getByRole("button", { name: /^New text size/ });
  await picker.waitFor();
  ok(
    /M · 13 px/.test((await picker.textContent()) ?? ""),
    "an untouched deployment shows Medium (13 px)",
  );
  const previewPara = '[aria-hidden="true"] .font-serif p';
  ok(
    (await fontSizeOf(page, previewPara)) === "13px",
    "the preview's stand-in paragraph is 13 px",
  );
  await picker.click();
  await page.getByRole("menuitemradio", { name: /^L · 15 px/ }).click();
  ok(
    (await fontSizeOf(page, previewPara)) === "15px",
    "the preview follows the unsaved choice (15 px)",
  );
  ok((await savedSize()) === null, "and nothing is stored until Save");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Saved — live on the site now.").waitFor();
  ok((await savedSize()) === "l", "Save stores l");

  heading("Existing text does not move");
  const before = JSON.stringify(await stored());
  await page.goto(`${base}/admin/issues/${issueId}/edit`);
  await page.waitForSelector("[data-editor-block]");
  await page.locator('button[aria-label="Page 2"]').click();
  await page.locator('[data-block-id="old"]').click();
  ok(
    (await fontSizeOf(page, '[data-block-id="old"] .ProseMirror')) === "13px",
    "the existing paragraph still reads 13 px with the default at L",
  );
  ok(
    JSON.stringify(await stored()) === before,
    "and its stored content is byte-identical",
  );

  heading("New text starts at the default");
  await page.locator('button[aria-label="Page 3"]').click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  const added = page.locator("[data-page-frame] [data-block-id]").first();
  await added.waitFor();
  const newId = await added.getAttribute("data-block-id");
  ok(
    (await fontSizeOf(page, `[data-block-id="${newId}"] .ProseMirror`)) ===
      "15px",
    "the new paragraph is 15 px on the canvas",
  );
  ok(
    (await page
      .locator(`[data-block-id="${newId}"] button[title="Text size L"]`)
      .getAttribute("aria-pressed")) === "true",
    "its size control shows L",
  );
  for (let i = 0; i < 100; i++) {
    const block = (await stored()).pages[2]!.blocks[0] as { size?: string };
    if (block?.size === "l") break;
    if (i === 99) throw new Error("FAIL: autosave never stored size l");
    await new Promise((r) => setTimeout(r, 100));
  }
  ok(true, "autosave stored size l on the new block only");
  ok(
    JSON.stringify((await stored()).pages[1]) ===
      JSON.stringify(JSON.parse(before).pages[1]),
    "the older page is untouched in storage",
  );

  heading("Back to Medium");
  await page.goto(`${base}/admin/magazine`);
  await page.getByRole("button", { name: /^New text size/ }).click();
  await page.getByRole("menuitemradio", { name: /^M · 13 px/ }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Saved — live on the site now.").waitFor();
  ok((await savedSize()) === "m", "choosing Medium stores m");

  ok(errors.length === 0, `no page errors (${errors.join("; ")})`);
  console.log("\nall passed");
} finally {
  await browser.close();
  if (original) await sql`update settings set ${sql(original)} where id = 1`;
  else await sql`delete from settings where id = 1`;
  await sql`delete from issues where id = ${issueId}`;
  await sql`delete from sessions where user_id = ${userId}`;
  await sql`delete from users where id = ${userId}`;
  await sql.end();
}
