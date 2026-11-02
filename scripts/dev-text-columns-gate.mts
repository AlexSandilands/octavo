// Two-column text (content v12, aboard #23) in a real browser: a heading over
// a band of left text, a photo in the left column and right text; the text
// bar's Full / Left / Right; a move within a column and its one-step undo; the
// overflow split (left column → right column → next page); then the page rail,
// both readers (side by side on a computer, left column first on a phone) and
// the print document. Creates and removes its own admin and issue.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-text-columns-gate.mts <base-url>
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { chromium, type Locator, type Page } from "playwright";
import {
  CONTENT_VERSION,
  type Block,
  type IssueContent,
} from "../src/lib/blocks";
import { stringToDoc } from "../src/lib/rich-text-doc";
import { hashSessionToken } from "../src/lib/session-token";

const base = process.argv[2];
assert(base, "usage: dev-text-columns-gate.mts <base-url>");
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
const shots = process.argv[3] ?? "/tmp";

const [image] = await sql<{ id: string }[]>`select id from images limit 1`;
assert(image, "needs one image row (a seeded database)");

const filler =
  "A paragraph long enough to wrap across several lines of a column, so that a run of them reaches past the foot of the page and the overflow marker offers to flow the rest.";
const text = (blockId: string, words: string, column?: "left" | "right") =>
  ({
    id: blockId,
    type: "text",
    text: stringToDoc(words),
    ...(column ? { column } : {}),
  }) as Block;
const heading = (blockId: string, title: string) =>
  ({ id: blockId, type: "heading", kicker: "", title, level: "main" }) as Block;
const content: IssueContent = {
  version: CONTENT_VERSION,
  pages: [
    { id: "cover", cover: true, blocks: [] },
    {
      id: "band",
      blocks: [
        heading("head", "Club news across two columns"),
        text("left1", "Left column opens with the season's results.", "left"),
        {
          id: "pic",
          type: "image",
          imageId: image.id,
          caption: "",
          alt: "A test photo",
          align: "left",
          width: 100,
        },
        text("right1", "Right column opens with the new members.", "right"),
      ],
    },
    {
      id: "flat",
      blocks: [
        heading("flat-head", "Two notices"),
        text("first", "First notice, about the hall."),
        text("second", "Second notice, about the boats."),
      ],
    },
    {
      id: "long",
      blocks: [
        heading("long-head", "A long feature"),
        {
          id: "long-text",
          type: "text",
          column: "left",
          text: {
            type: "doc",
            content: Array.from(
              { length: 40 },
              (_, i) => stringToDoc(`${i + 1}. ${filler}`).content,
            ).flat(),
          },
        } as Block,
      ],
    },
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
  throw new Error(`autosave never reached: ${what}`);
};
const columnOf = (c: IssueContent, blockId: string) => {
  for (const p of c.pages)
    for (const b of p.blocks)
      if (b.id === blockId) return b.type === "text" ? b.column : undefined;
  return "missing";
};
const box = async (l: Locator) => {
  const b = await l.boundingBox();
  assert(b, "laid out");
  return b;
};
/** Left beside right: one row, the left one wholly left of the right. */
const sideBySide = async (left: Locator, right: Locator, what: string) => {
  const [a, b] = [await box(left), await box(right)];
  if (process.env.DEBUG_GATE) console.log(what, a, b);
  assert(a.x + a.width <= b.x + 1, `${what}: left column is left of right`);
  assert(Math.abs(a.y - b.y) < 4, `${what}: both columns start level`);
};
const openPage = async (page: Page, n: number) =>
  page.getByRole("button", { name: `Page ${n}`, exact: true }).click();

try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
    values (${user}, ${`scratch-23-${user}@example.invalid`}, true, true, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${hashSessionToken(token)}, ${user}, now() + interval '1 hour')`;
  const [issue] = await sql<{ number: number }[]>`
    insert into issues (id, number, title, theme, status, content)
    values (${id}, (select coalesce(max(number), 0) + 1 from issues),
      'Scratch columns 23', 'classic', 'draft', ${sql.json(content as never)})
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
  const block = (blockId: string) =>
    page.locator(`[data-block-id="${blockId}"]`);

  // The screenshot's layout: a heading over left text + photo and right text.
  await page.goto(`${base}/admin/issues/${id}/edit`);
  await openPage(page, 2);
  await block("left1").waitFor();
  await sideBySide(block("left1"), block("right1"), "editor");
  const [head, left, pic] = [
    await box(block("head")),
    await box(block("left1")),
    await box(block("pic")),
  ];
  const right = await box(block("right1"));
  assert(
    head.width > right.x + right.width - left.x - 4,
    "the heading spans both columns",
  );
  assert(pic.y > left.y + left.height - 1, "the photo stacks under the text");
  assert(Math.abs(pic.width - left.width) < 2, "the photo is column-wide");
  await page.screenshot({ path: `${shots}/octavo-23-editor.png` });
  console.log("PASS: heading over a band; left text, photo and right text");

  // The text bar's Full / Left / Right.
  await openPage(page, 3);
  await block("first").locator("[data-text-body]").click();
  await page.getByRole("button", { name: "Left column", exact: true }).click();
  await waitSaved("first → left", (c) => columnOf(c, "first") === "left");
  // Clear of the selected left block's side controls, which overhang it.
  await block("second")
    .locator("[data-text-body]")
    .click({ position: { x: 20, y: 8 } });
  await page.getByRole("button", { name: "Right column", exact: true }).click();
  await waitSaved("second → right", (c) => columnOf(c, "second") === "right");
  await sideBySide(block("first"), block("second"), "after Left/Right");
  assert.equal(
    await page
      .getByRole("button", { name: "Right column", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Full width", exact: true }).click();
  await waitSaved("second → full", (c) => columnOf(c, "second") === undefined);
  const [a, b] = [await box(block("first")), await box(block("second"))];
  assert(b.y > a.y + a.height - 1, "a full block sits under the band");
  console.log("PASS: Full / Left column / Right column in the text bar");

  // A move within a column, one undo step.
  await openPage(page, 2);
  await block("left1").locator("[data-text-body]").click();
  await page.getByRole("button", { name: "Move down", exact: true }).click();
  const order = (c: IssueContent) => c.pages[1]!.blocks.map((x) => x.id).join();
  await waitSaved(
    "left1 under the photo",
    (c) => order(c) === "head,pic,left1,right1",
  );
  assert(
    (await box(block("left1"))).y > (await box(block("pic"))).y,
    "the text moved below the photo, in its column",
  );
  await page.locator("body").click({ position: { x: 5, y: 500 } });
  await page.keyboard.press("Control+z");
  await waitSaved(
    "undone in one step",
    (c) => order(c) === "head,left1,pic,right1",
  );
  console.log("PASS: a move within a column, undone in one step");

  // Overflow: left column → top of the right column → next page in columns.
  await openPage(page, 4);
  await block("long-text")
    .locator("[data-text-body]")
    .click({ position: { x: 20, y: 20 } });
  await page
    .getByRole("button", { name: "Flow onto next page", exact: true })
    .click();
  await waitSaved("the column split", (c) => c.pages.length > 4);
  const flowed = await stored();
  const p4 = flowed.pages[3]!.blocks;
  assert.equal(p4.length, 3, "the page keeps its heading, left and right");
  assert.equal(columnOf(flowed, p4[1]!.id), "left");
  assert.equal(columnOf(flowed, p4[2]!.id), "right");
  const p5 = flowed.pages[4]!.blocks;
  assert.equal(columnOf(flowed, p5[0]!.id), "left", "the next page, left");
  const words = (blocks: Block[]) =>
    JSON.stringify(blocks)
      .match(/\d+\. A paragraph/g)!
      .map((m) => parseInt(m));
  const all = flowed.pages.slice(3).flatMap((p) => p.blocks);
  assert.deepEqual(
    words(all),
    Array.from({ length: 40 }, (_, i) => i + 1),
    "every paragraph once, in order",
  );
  await page.waitForTimeout(300);
  const marker = await page
    .getByRole("button", { name: "Flow onto next page", exact: true })
    .count();
  assert.equal(marker, 0, "page 4 no longer overflows");
  await page.screenshot({ path: `${shots}/octavo-23-split.png` });
  console.log(
    `PASS: overflow flows left → right → next page (${flowed.pages.length - 4} page(s) added)`,
  );

  // The page rail's miniatures lay the band out too.
  assert(
    (await page.locator("[data-band]").count()) >
      (await page.locator("[data-page-frame] [data-band]").count()),
    "the page rail renders bands",
  );
  console.log("PASS: page rail thumbnails");

  await sql`update issues set status = 'published', published_at = now() where id = ${id}`;
  await page.goto(`${base}/read/${issue!.number}`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const opens = (p: Page, words: string) => p.getByText(words).first();
  await opens(page, "Left column opens").waitFor();
  await page.waitForTimeout(1500); // the page turn settles
  await sideBySide(
    opens(page, "Left column opens"),
    opens(page, "Right column opens"),
    "desktop reader",
  );
  await page.screenshot({ path: `${shots}/octavo-23-reader.png` });
  console.log("PASS: desktop reader, side by side");

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${base}/read/${issue!.number}`);
  await opens(page, "Left column opens").waitFor({ state: "attached" });
  const ys = await Promise.all(
    ["Left column opens", "Right column opens"].map(
      async (w) => (await box(opens(page, w))).y,
    ),
  );
  const picY = (await box(page.getByAltText("A test photo").first())).y;
  assert(ys[0]! < picY && picY < ys[1]!, "phone: left text, photo, then right");
  console.log("PASS: phone reader reads the left column, then the right");

  const printToken = createHash("sha256")
    .update(`${process.env.AUTH_SECRET}:pdf-print`)
    .digest("hex");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/read/${issue!.number}/print?token=${printToken}`, {
    waitUntil: "networkidle",
  });
  await page.emulateMedia({ media: "print" });
  await page.locator(".pdf-pages").waitFor({ state: "visible" });
  await sideBySide(
    opens(page, "Left column opens"),
    opens(page, "Right column opens"),
    "print",
  );
  await page.pdf({
    path: `${shots}/octavo-23.pdf`,
    preferCSSPageSize: true,
    printBackground: true,
  });
  console.log("PASS: print document");

  assert.deepEqual(errors, [], "no page errors");
} finally {
  await browser.close();
  await sql`delete from issues where id = ${id}`;
  await sql`delete from sessions where user_id = ${user}`;
  await sql`delete from users where id = ${user}`;
  await sql.end();
}
