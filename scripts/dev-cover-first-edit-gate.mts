// Dev-only: a fresh cover's first edit keeps the caret and its text, and a native
// replace over a whole selected cover paragraph lands its text (autocorrect,
// dictation, paste-over). Scratch admin + issues, removed at the end.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-cover-first-edit-gate.mts <base-url>
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import { emptyIssueContent } from "../src/lib/blocks.ts";

process.loadEnvFile?.(".env.local");
const base = process.argv[2];
if (!base) throw new Error("usage: dev-cover-first-edit-gate.mts <base-url>");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const user = crypto.randomUUID();
const token = crypto.randomUUID();
const tag = `Scratch first edit ${user.slice(0, 8)}`;
const ok = (msg: string) => console.log(`  ok — ${msg}`);

// The cover's three text fields: their accessible name, and where the block
// stores the plain text (blocks[0] heading title/kicker, blocks[2] tagline).
const FIELDS = [
  { name: "Cover title", read: (b: Blk[]) => b[0]!.title! },
  { name: "Masthead", read: (b: Blk[]) => b[0]!.kicker! },
  { name: "Add a tagline or date…", read: (b: Blk[]) => b[2]!.text! },
];
type Blk = Record<string, string>;

async function freshIssue(): Promise<string> {
  const id = crypto.randomUUID();
  await sql`insert into issues (id, number, title, content)
    values (${id}, null, ${tag}, ${sql.json(emptyIssueContent())})`;
  return id;
}
const stored = async (id: string) => {
  const [r] = await sql<{ content: { pages: { blocks: Blk[] }[] } }[]>`
    select content from issues where id = ${id}`;
  return r!.content.pages[0]!.blocks;
};
async function open(page: Page, id: string, name: string) {
  await page.goto(`${base}/admin/issues/${id}/edit`);
  const box = page.getByRole("textbox", { name, exact: true }).first();
  await box.waitFor();
  await page.waitForTimeout(600);
  return box;
}
const focusedLabel = (page: Page) =>
  page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") ?? "<none>",
  );
async function settle(id: string, read: (b: Blk[]) => string, want: string) {
  for (let i = 0; i < 100; i++) {
    if (read(await stored(id)) === want) return;
    await delay(100);
  }
  assert.equal(read(await stored(id)), want, "saved value");
}
const text = async (box: ReturnType<Page["getByRole"]>) =>
  (await box.innerText()).replace(/\n$/, "");
// Masthead is set in capitals by CSS; compare case-insensitively on screen.
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed)
    values (${user}, ${`scratch-fe-${user.slice(0, 8)}@example.invalid`}, true, false)`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${user}, now() + interval '1 hour')`;
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  ctx.setDefaultTimeout(15_000);
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

  for (const f of FIELDS) {
    console.log(`\n── ${f.name}`);
    // The first edit of an unplaced cover: typed over a selection, then at speed.
    const a = await freshIssue();
    let box = await open(page, a, f.name);
    await box.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Hello world");
    assert(
      same(await text(box), "Hello world"),
      `first edit typed (${await text(box)})`,
    );
    assert.equal(await focusedLabel(page), f.name, "focus stays in the field");
    await settle(a, f.read, "Hello world");
    ok(
      "select all + type on a fresh cover: exactly 'Hello world', saved, focus kept",
    );

    // Caret in the middle of the existing words: the first character must not
    // be joined to a second, freshly built editor.
    const b = await freshIssue();
    box = await open(page, b, f.name);
    const before = f.read(await stored(b));
    await box.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" and more", { delay: 40 });
    const want = `${before} and more`;
    assert(same(await text(box), want), `caret typing (${await text(box)})`);
    assert.equal(
      await focusedLabel(page),
      f.name,
      "focus stays after caret typing",
    );
    await settle(b, f.read, want);
    ok("typing at the caret keeps every character in order, focus kept");

    // Undo of the first edit stays in the field, caret intact.
    await page.keyboard.press("ControlOrMeta+Z");
    await page.waitForTimeout(300);
    assert(same(await text(box), before), `undo (${await text(box)})`);
    assert.equal(await focusedLabel(page), f.name, "focus stays after undo");
    // (Where PM history parks the caret after an undo is its own; End is explicit.)
    await page.keyboard.press("End");
    await page.keyboard.type("!");
    assert(
      same(await text(box), `${before}!`),
      `typing after undo (${await text(box)})`,
    );
    await settle(b, f.read, `${before}!`);
    ok("undo of the first edit keeps focus in the field; typing carries on");

    // Native replace over the whole paragraph (autocorrect / dictation / paste).
    const c = await freshIssue();
    box = await open(page, c, f.name);
    await box.click();
    await page.keyboard.type("x"); // place the cover first: fill() alone is the case below
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("Replaced natively");
    await page.waitForTimeout(300);
    assert(
      same(await text(box), "Replaced natively"),
      `insertText (${await text(box)})`,
    );
    await settle(c, f.read, "Replaced natively");
    await box.fill("Via fill");
    await page.waitForTimeout(300);
    assert(same(await text(box), "Via fill"), `fill (${await text(box)})`);
    await settle(c, f.read, "Via fill");
    await box.click();
    await page.keyboard.press("ControlOrMeta+A");
    await box.evaluate((el) => {
      const data = new DataTransfer();
      data.setData("text/plain", "Pasted over");
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await page.waitForTimeout(300);
    assert(
      same(await text(box), "Pasted over"),
      `paste over (${await text(box)})`,
    );
    await settle(c, f.read, "Pasted over");
    ok(
      "insertText, fill() and paste over the whole paragraph all land and save",
    );

    // fill() as the very first edit of a fresh cover.
    const d = await freshIssue();
    box = await open(page, d, f.name);
    await box.fill("Filled first");
    await page.waitForTimeout(300);
    assert(
      same(await text(box), "Filled first"),
      `first-edit fill (${await text(box)})`,
    );
    await settle(d, f.read, "Filled first");
    ok("fill() as the first edit of a fresh cover lands and saves");
  }
  console.log("\nPASS — cover first edit and native replace");
} finally {
  await browser.close();
  await sql`delete from issues where title = ${tag}`;
  await sql`delete from sessions where session_token = ${token}`;
  await sql`delete from users where id = ${user}`;
  await sql.end();
}
