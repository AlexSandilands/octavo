import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { chromium, type Page as BrowserPage } from "playwright";
import { issueContentSchema, type Block } from "../src/lib/blocks.ts";
process.loadEnvFile(existsSync(".env.local") ? ".env.local" : ".env");
export const base = process.argv[2] ?? "http://localhost:3223";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a local test server.",
);
assert(
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
  "Use the local development database, never a live database.",
);
export const sql = postgres(process.env.DATABASE_URL!);
export const browser = await chromium.launch({ headless: true });
export const uid = crypto.randomUUID(),
  iid = crypto.randomUUID(),
  token = crypto.randomUUID();
export const prefixId = crypto.randomUUID(),
  suffixId = crypto.randomUUID(),
  laterId = crypto.randomUUID();
const text = (id: string, value: string): Block => ({
  id,
  type: "text",
  text: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
  },
});
export const initial = {
  version: 6,
  pages: [
    { id: crypto.randomUUID(), cover: true, blocks: [] },
    {
      id: crypto.randomUUID(),
      blocks: [
        text(prefixId, "PREFIX before selected content."),
        text(suffixId, "SUFFIX after selected content."),
      ],
    },
    {
      id: laterId,
      blocks: [text(crypto.randomUUID(), "LATER authored page stays intact.")],
    },
  ],
};
export async function setup() {
  await sql`insert into users(id,email,is_admin,subscribed,email_verified) values(${uid},${`scratch-223-${uid}@example.invalid`},true,true,now())`;
  await sql`insert into sessions(session_token,user_id,expires) values(${token},${uid},now()+interval '1 hour')`;
  // Only published numbers are unique (a partial index), so a draft's is
  // checked by hand.
  for (let tries = 0; tries < 10; tries++) {
    const number = 900223000 + Math.floor(Math.random() * 100000);
    const taken = await sql`select 1 from issues where number=${number}`;
    if (taken.length) continue;
    await sql`insert into issues(id,number,title,theme,status,footer_mark_size,footer_text_size,content) values(${iid},${number},'PDF import browser gate','classic','draft',48,16,${sql.json(initial)})`;
    return number;
  }
  throw new Error("Could not allocate scratch issue number.");
}
export async function cleanup() {
  await browser.close();
  await (await import("../src/server/issues.ts")).deleteIssue(iid);
  await sql`delete from users where id=${uid}`;
  await sql.end();
}
export async function readDocument() {
  const [row] = await sql`select content from issues where id=${iid}`;
  return issueContentSchema.parse(row?.content);
}
export async function settle(page: BrowserPage) {
  await page.getByText("Saved", { exact: true }).waitFor({ timeout: 30000 });
}

// The panel's controls, named the way the UI names them.
export const panel = (page: BrowserPage) => page.locator("[data-pdf-private]");
// The page rail names its thumbs "Page 2", "Page 1 (cover)".
export const magazinePage = (page: BrowserPage, n: number) =>
  page.getByRole("button", {
    name: new RegExp(`^Page ${n}( \\(cover\\))?$`),
  });
export const openTool = (page: BrowserPage) =>
  page.getByRole("button", { name: "Import PDF", exact: true }).click();
/** The rail button that opened the panel is pressed while it is out; it closes it. */
export const closeTool = (page: BrowserPage) =>
  page
    .getByRole("navigation", { name: "Editor panels" })
    .getByRole("button", { name: "Import PDF", exact: true })
    .click();
export const fileInput = (page: BrowserPage) =>
  panel(page).locator('input[type="file"]');
/** Region press targets by kind, e.g. `region(page, "Image")`; the kind
 * toggles in the pill and the list share those names, so scope to regions. */
export const region = (page: BrowserPage, kind: "Text" | "Heading" | "Image") =>
  panel(page)
    .locator("button[data-region]")
    .and(page.getByRole("button", { name: new RegExp(`^${kind}\\b`) }));
export const selectedRegions = (page: BrowserPage) =>
  panel(page).locator("button[data-region][aria-pressed='true']");
export const addedRegions = (page: BrowserPage) =>
  panel(page)
    .locator("button[data-region]")
    .and(page.getByRole("button", { name: /, added:/ }));
export const selectAll = (page: BrowserPage) =>
  page.getByRole("button", { name: "Select all on page", exact: true }).click();
/** The command row's Add, not the copy in a hovered region's pill. */
export const addButton = (page: BrowserPage) =>
  panel(page)
    .locator("[data-add-bar]")
    .getByRole("button", { name: /^Add( \d+)?$/ });
export const nextPage = (page: BrowserPage) =>
  page.getByRole("button", { name: "Next PDF page", exact: true }).click();
export const status = (page: BrowserPage) =>
  panel(page).locator('[role="status"]');
export async function openFile(
  page: BrowserPage,
  file = "scripts/fixtures/pdf-import/single-column.pdf",
) {
  await fileInput(page).setInputFiles(file);
  await page
    .getByRole("group", { name: "PDF tools" })
    .waitFor({ timeout: 35000 });
  await page.locator("[data-pdf-private] canvas").waitFor({ timeout: 35000 });
}
export async function waitAdded(page: BrowserPage) {
  await panel(page)
    .getByText(/^Added \d+ blocks? to the magazine\./)
    .waitFor({ timeout: 60000 });
  await settle(page);
}
export async function assertFits(page: BrowserPage) {
  const geometry = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>("[data-page-frame]");
    const footer = frame?.querySelector<HTMLElement>("[data-page-footer]");
    if (!frame || !footer)
      throw new Error("Expected a normal page with a running footer.");
    const scale = frame.getBoundingClientRect().height / frame.offsetHeight;
    const limit = footer.getBoundingClientRect().top - 6 * scale;
    return [...frame.querySelectorAll<HTMLElement>("[data-editor-block]")]
      .filter((block) => block.getBoundingClientRect().bottom > limit + scale)
      .map((block) => ({
        id: block.getAttribute("data-block-id"),
        bottom: block.getBoundingClientRect().bottom,
        limit,
        scale,
        height: block.offsetHeight,
        html: block.querySelector("[data-text-body]")?.outerHTML.slice(0, 200),
      }));
  });
  if (geometry.length)
    await page.screenshot({ path: "/tmp/pdf-import-overflow.png" });
  assert.deepEqual(
    geometry,
    [],
    "No destination block overflows its actual footer geometry.",
  );
}
