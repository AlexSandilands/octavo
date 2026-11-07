// Colour and typeface on interior text (content v11, aboard #24) in a real
// browser: the body-text bar's font menu and colour tray on selected words, the
// contrast warning, Theme default, the heading bar's own pair, autosave and
// reload, an overflow split, then both readers and the print document (PDF
// fonts checked with pdffonts). Creates and removes its own admin and issue.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-text-paint-gate.mts <base-url>
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { chromium, type Page } from "playwright";
import { CONTENT_VERSION, type IssueContent } from "../src/lib/blocks";
import { stringToDoc } from "../src/lib/rich-text-doc";
import { hashSessionToken } from "../src/lib/session-token";

const base = process.argv[2];
assert(base, "usage: dev-text-paint-gate.mts <base-url>");
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "local server only",
);
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const sql = postgres(process.env.DATABASE_URL!);
const id = crypto.randomUUID();
const user = crypto.randomUUID();
const token = crypto.randomUUID();
const browser = await chromium.launch();

const prose =
  "The members' spring show drew a record crowd to the hall on Saturday.";
const filler =
  "A paragraph long enough to wrap across several lines of the page, so that sixteen of them run past the foot of it and the overflow marker offers to flow the rest onto the next page.";
const longText = {
  type: "doc" as const,
  content: [
    ...Array.from({ length: 30 }, () => stringToDoc(filler).content).flat(),
    {
      type: "paragraph" as const,
      content: [
        { type: "text" as const, text: "Last words, " },
        {
          type: "text" as const,
          text: "in blue",
          marks: [
            { type: "paint" as const, attrs: { color: "blue" as const } },
          ],
        },
      ],
    },
  ],
};
const content: IssueContent = {
  version: CONTENT_VERSION,
  pages: [
    { id: "cover", cover: true, blocks: [] },
    {
      id: "body",
      blocks: [
        {
          id: "head",
          type: "heading",
          kicker: "",
          title: "Spring show",
          level: "main",
        },
        { id: "words", type: "text", text: stringToDoc(prose) },
      ],
    },
    { id: "long", blocks: [{ id: "long-text", type: "text", text: longText }] },
  ],
};

const stored = async () => {
  const [row] = await sql<
    { content: IssueContent }[]
  >`select content from issues where id = ${id}`;
  return row!.content;
};
const waitSaved = async (what: string, check: (c: IssueContent) => boolean) => {
  for (let i = 0; i < 100; i++) {
    if (check(await stored())) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  const last = JSON.stringify((await stored()).pages[1]);
  throw new Error(`autosave never reached: ${what}\n${last}`);
};
/** The paint on the run reading `text`, wherever it is (jsonb reorders keys). */
const paintOn = (c: unknown, text: string): Record<string, string> | null => {
  let found: Record<string, string> | null = null;
  JSON.stringify(c, (_, v) => {
    if (v?.type === "text" && v.text === text)
      found =
        v.marks?.find((m: { type: string }) => m.type === "paint")?.attrs ?? {};
    return v;
  });
  return found;
};

/** Computed colour/font of the element that holds `text`. */
const styleOf = (page: Page, selector: string, text: string) =>
  page
    .locator(selector)
    .filter({ hasText: text })
    .last()
    .evaluate((el) => ({
      color: getComputedStyle(el).color,
      font: getComputedStyle(el).fontFamily,
    }));
const accent = (page: Page) =>
  page.evaluate(() => {
    const el = document.createElement("span");
    el.style.color = "var(--color-accent)";
    document.body.append(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  });

try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
    values (${user}, ${`scratch-24-${user}@example.invalid`}, true, true, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${hashSessionToken(token)}, ${user}, now() + interval '1 hour')`;
  const [issue] = await sql<{ number: number }[]>`
    insert into issues (id, number, title, theme, status, content)
    values (${id}, (select coalesce(max(number), 0) + 1 from issues),
      'Scratch paint 24', 'classic', 'draft', ${sql.json(content as never)})
    returning number`;
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await ctx.addCookies([
    { name: "authjs.session-token", value: token, url: base },
  ]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${base}/admin/issues/${id}/edit`);
  await page.getByRole("button", { name: "Page 2", exact: true }).click();
  const body = page.locator('[data-block-id="words"] [data-text-body]');
  await body.click();
  // Select "record crowd" the way a drag would: a DOM range ProseMirror reads.
  const selectWords = (words: string) =>
    body.evaluate((el, words) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const at = n.textContent!.indexOf(words);
        if (at === -1) continue;
        const range = document.createRange();
        range.setStart(n, at);
        range.setEnd(n, at + words.length);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      throw new Error(`no "${words}"`);
    }, words);
  await selectWords("record crowd");
  await page.waitForTimeout(100);

  await page
    .getByRole("button", { name: "Selected text font", exact: true })
    .click();
  await page.getByRole("menuitemradio", { name: "Hanken Grotesk" }).click();
  await waitSaved(
    "font on the selection",
    (c) => paintOn(c, "record crowd")?.font === "hanken-grotesk",
  );

  const colour = page.getByRole("button", {
    name: "Selected text colour",
    exact: true,
  });
  await colour.click();
  await page
    .getByRole("button", { name: "Selected text colour: Paper" })
    .click();
  await page.getByRole("status").filter({ hasText: "hard to read" }).waitFor();
  await page
    .getByRole("button", { name: "Theme default", exact: true })
    .click();
  await waitSaved("Theme default keeps the font", (c) => {
    const p = paintOn(c, "record crowd");
    return p?.font === "hanken-grotesk" && !p.color;
  });
  assert.equal(
    await page.getByRole("status").filter({ hasText: "hard to read" }).count(),
    0,
    "no warning without a colour",
  );
  await page
    .getByRole("button", { name: "Selected text colour: Forest" })
    .click();
  await waitSaved("colour beside the font", (c) => {
    const p = paintOn(c, "record crowd");
    return p?.font === "hanken-grotesk" && p.color === "green";
  });
  const green = await accent(page);
  const painted = await styleOf(page, "[data-paint]", "record crowd");
  assert(
    painted.font.includes("hanken") || painted.font.includes("Hanken"),
    painted.font,
  );
  assert.equal(painted.color, green, "the editor shows the colour");
  await page.keyboard.press("Escape");
  console.log(
    "PASS: body-text font, colour, contrast warning and Theme default",
  );

  // The heading's own pair, on its title.
  await page
    .locator('[data-block-id="head"]')
    .click({ position: { x: 4, y: 4 } });
  await page.getByRole("button", { name: "Heading font", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Roboto Condensed" }).click();
  await page
    .getByRole("button", { name: "Heading colour", exact: true })
    .click();
  await page.getByRole("button", { name: "Heading colour: Blue" }).click();
  await waitSaved("heading paint", (c) => {
    const h = c.pages[1]!.blocks[0]!;
    return (
      h.type === "heading" &&
      h.paint?.color === "blue" &&
      h.paint.font === "roboto-condensed"
    );
  });
  await page.screenshot({ path: "/tmp/octavo-24-editor.png" });

  await page.reload();
  await page.getByRole("button", { name: "Page 2", exact: true }).click();
  const afterReload = await styleOf(page, "[data-paint]", "record crowd");
  assert.equal(afterReload.color, green, "the colour survives a reload");
  const title = await styleOf(
    page,
    '[data-block-id="head"] div',
    "Spring show",
  );
  assert(title.font.toLowerCase().includes("roboto"), title.font);
  console.log("PASS: heading font and colour, autosave and reload");

  await page.getByRole("button", { name: "Page 3", exact: true }).click();
  await page
    .locator('[data-block-id="long-text"] [data-text-body]')
    .click({ position: { x: 20, y: 20 } });
  await page
    .getByRole("button", { name: "Flow onto next page", exact: true })
    .click();
  await waitSaved("the overflow split", (c) => c.pages.length > 3);
  const flowed = await stored();
  assert(
    paintOn(flowed.pages.slice(3), "in blue")?.color === "blue",
    "the flowed half keeps its paint",
  );
  console.log("PASS: an overflow split keeps the paint");

  await sql`update issues set status = 'published', published_at = now() where id = ${id}`;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/read/${issue!.number}`);
    if (width === 1440)
      await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("record crowd").first().waitFor({ state: "attached" });
    const words = await styleOf(page, ".rich-text span", "record crowd");
    assert.equal(words.color, green, `reader ${width}: colour`);
    assert(
      words.font.toLowerCase().includes("hanken"),
      `reader ${width}: ${words.font}`,
    );
    const head = await styleOf(page, "h2", "Spring show");
    assert(
      head.font.toLowerCase().includes("roboto"),
      `reader ${width}: ${head.font}`,
    );
    assert.notEqual(head.color, green);
    await page.screenshot({ path: `/tmp/octavo-24-reader-${width}.png` });
  }
  console.log("PASS: desktop and phone readers");

  const printToken = createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/read/${issue!.number}/print?token=${printToken}`, {
    waitUntil: "networkidle",
  });
  await page.emulateMedia({ media: "print" });
  await page.locator(".pdf-pages").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  const printed = await styleOf(page, ".rich-text span", "record crowd");
  assert.equal(printed.color, green, "print: colour");
  await page.pdf({
    path: "/tmp/octavo-24.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  const fonts = execFileSync("pdffonts", ["/tmp/octavo-24.pdf"]).toString();
  assert(/hanken/i.test(fonts) && /roboto/i.test(fonts), fonts);
  console.log("PASS: print document and PDF embed both fonts");

  assert.deepEqual(errors, [], "no page errors");
} finally {
  await browser.close();
  await sql`delete from issues where id = ${id}`;
  await sql`delete from sessions where user_id = ${user}`;
  await sql`delete from users where id = ${user}`;
  await sql.end();
}
