// Dev-only: the assistant's editing tools (#310) in a real editor, driven by
// scripted fake-provider runs (`[fake:tools]` + a JSON list of calls):
//   AI_PROVIDER=fake AI_MONTHLY_BUDGET_USD=5 NEXT_PUBLIC_AI_ASSISTANT=1 PORT=3310 npm run dev
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-assistant-tools-gate.mts http://localhost:3310
// set_text → the overflow reported per block → split_page → fits (the real
// measurer, off screen); autosave keeps the result; Ctrl+Z takes the whole run
// back in one step; insert after a block; move and resize a photo; an unknown id
// refused and reported; the per-block Ask box (#311,
// assistant-tools-gate-ask.mts); each circuit-breaker condition stops a run
// with its edits kept (assistant-tools-gate-breaker.mts). Then vision (#342,
// fixtures/assistant/vision-checks.mts), and a cover composed by a run (#313,
// assistant-tools-gate-cover.mts).
//
// SAFETY: shared dev database. It mints its own admin, session, a draft and a
// published copy of it, and one photo row (a key with no file behind it); the finally deletes exactly those
// and the ai_usage its runs left.
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import {
  block,
  canonical,
  content,
  watchChat,
  ids,
  photoId,
  sentence,
  until,
  where,
  type Doc,
} from "./fixtures/assistant/tools-gate-kit.mts";
import { visionChecks } from "./fixtures/assistant/vision-checks.mts";
import { checkBreaker } from "./assistant-tools-gate-breaker.mts";
import { checkAsk } from "./assistant-tools-gate-ask.mts";
import { checkCover } from "./assistant-tools-gate-cover.mts";

process.loadEnvFile?.(".env.local");
// An optional folder for screenshots of the held canvas and the run's line.
const [base, shots] = process.argv.slice(2);
const shot = (page: Page, name: string) =>
  shots ? page.screenshot({ path: `${shots}/${name}.png` }) : Promise.resolve();
if (!base) throw new Error("usage: dev-assistant-tools-gate.mts <url>");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  assert(cond, `FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const tag = `assistant-tools-gate-${crypto.randomUUID().slice(0, 8)}`;
const adminId = crypto.randomUUID();
const token = crypto.randomUUID();
const draftId = crypto.randomUUID();
const publishedId = crypto.randomUUID();

const RAIL = 'nav[aria-label="Editor panels"]';
const BUTTON = `${RAIL} button[aria-label="Assistant"]`;
const INPUT = "#assistant-input";
const LOG = '[role="log"]';
const RUN = "[data-assistant-run]";
const PRESET = (label: string) => `button:text-is("${label}")`;

const saved = async (): Promise<Doc> =>
  (
    await sql<
      { content: Doc }[]
    >`select content from issues where id = ${draftId}`
  )[0]!.content;
async function checks(page: Page) {
  const chat = watchChat(page);
  const { asked } = chat;
  const runScript = (_: Page, ...args: Parameters<typeof chat.runScript>) =>
    chat.runScript(...args);
  await page.goto(`${base}/admin/issues/${draftId}/edit`);
  await page.waitForSelector(RAIL);
  await page.click(BUTTON);
  await page.waitForSelector(INPUT);

  heading("presets");
  const tidy = page.locator(PRESET("Tidy this page"));
  ok(
    (await page.$(PRESET("Compose cover"))) !== null &&
      (await tidy.count()) === 0,
    "on the cover the panel offers Compose cover only",
  );
  await page.click('button[aria-label="Page 2"]');
  await tidy.waitFor();
  ok(
    (await tidy.getAttribute("aria-disabled")) === null &&
      (await page.$(PRESET("Compose cover"))) === null,
    "on an inside page the four page presets, on",
  );
  await page.click(`[data-block-id="${ids.head}"]`);
  await tidy.click();
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "true",
    LOG,
  );
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "false",
    LOG,
    { timeout: 60_000 },
  );
  ok(
    asked.at(-1) ===
      `Tidy the selected block [${ids.head}] on page 2: stray spaces and line breaks, punctuation, heading levels and how the blocks sit. Keep every word as it is.`,
    "Tidy sends its fixed message for the page and the selected block",
  );
  const bubble = await page.textContent(`${LOG} .self-end`);
  ok(
    bubble?.includes("Tidy the selected block on page 2") &&
      !bubble.includes(ids.head),
    `the author reads it without the block id (${bubble?.replace("You: ", "")})`,
  );

  heading("set_text → overflow per block → split_page → fits");
  const long = Array.from(
    { length: 30 },
    (_, i) => `Paragraph ${i + 1}. ${sentence.repeat(4)}`,
  );
  const run1 = await runScript(page, [
    {
      toolName: "set_text",
      input: { blockId: ids.story, markdown: long.join("\n\n") },
    },
    { toolName: "split_page", input: { page: 2 } },
  ]);
  const [overflow, split] = run1.outputs;
  console.log(`    set_text → ${overflow?.slice(0, 400)}…`);
  console.log(`    split_page → ${split}`);
  ok(
    /^Updated the text\. page 2: overflows by ~\d+ lines\./.test(
      overflow ?? "",
    ),
    "set_text reports the overflow",
  );
  ok(
    overflow?.includes(`[${ids.story}] `) &&
      /\d+ lines, its paragraphs' last lines hold [\d, …]+ words/.test(
        overflow,
      ),
    "with each text block's lines and last lines",
  );
  ok(overflow?.includes("split_page 2"), "and offers split_page");
  ok(
    /^Moved \d+ blocks? onto new pages? 3/.test(split ?? ""),
    "split_page carries the end over",
  );
  ok(
    /page 2: fits, ~\d+% full/.test(split ?? "") &&
      !/overflows/.test(split ?? ""),
    "every page it touched fits",
  );
  await until(
    "autosave of the split",
    async () => (await saved()).pages.length > 3,
  );
  const afterSplit = await saved();
  ok(
    where(afterSplit, ids.head) === 2 &&
      where(afterSplit, ids.next) === afterSplit.pages.length,
    "autosave kept the result, later pages renumbered",
  );

  const line = await page.textContent(RUN);
  ok(
    /^Changed \d+ blocks on pages 2–\d+ and added \d+ pages\s*Undo$/.test(
      line?.trim() ?? "",
    ),
    `the panel says what the run changed (${line?.trim()})`,
  );
  const log = await page.textContent(LOG);
  ok(
    log?.includes("Rewrote a text block") &&
      log.includes("Carried text onto a new page"),
    "each edit shows as one quiet line in the thread",
  );

  heading("Ctrl+Z takes the whole run back");
  await page.click("body", { position: { x: 5, y: 5 } }).catch(() => {});
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+z");
  await until(
    "autosave of the undo",
    async () => (await saved()).pages.length === 3,
  );
  const undone = await saved();
  ok(
    JSON.stringify(undone.pages.map((p) => p.blocks.map((b) => b.id))) ===
      JSON.stringify(content.pages.map((p) => p.blocks.map((b) => b.id))) &&
      canonical(block(undone, ids.story)?.text) ===
        canonical(content.pages[1]!.blocks[3]!.text),
    "one Ctrl+Z restored the pre-run pages",
  );
  await page.keyboard.press("Control+y");
  await until(
    "autosave of the redo",
    async () => (await saved()).pages.length > 3,
  );
  ok(true, "and Ctrl+Y puts the run back");
  await page.keyboard.press("Control+z");
  await until(
    "autosave of the second undo",
    async () => (await saved()).pages.length === 3,
  );

  heading("an unknown id is refused and reported");
  const run2 = await runScript(page, [
    {
      toolName: "set_text",
      input: { blockId: "no-such-block", markdown: "x" },
    },
  ]);
  ok(
    run2.outputs[0]?.startsWith('Error: no block has id "no-such-block"'),
    `the model reads the refusal (${run2.outputs[0]})`,
  );

  heading("insert after a block; move and resize a photo");
  const run3 = await runScript(page, [
    {
      toolName: "insert_blocks",
      input: {
        after: { blockId: ids.intro },
        blocks: [{ kind: "text", markdown: "An **inserted** note." }],
      },
    },
    {
      toolName: "move_block",
      input: { blockId: ids.photo, after: { blockId: ids.next } },
    },
    {
      toolName: "set_image_layout",
      input: { blockId: ids.photo, align: "left", width: 40 },
    },
  ]);
  ok(
    run3.outputs.every((o) => !o.startsWith("Error")),
    "all three applied",
  );
  await until(
    "autosave of the photo move",
    async () => where(await saved(), ids.photo) === 3,
  );
  const moved = await saved();
  const p2 = moved.pages[1]!.blocks;
  ok(
    p2[1]?.id === ids.intro &&
      p2[2]?.type === "text" &&
      JSON.stringify(p2[2]).includes("inserted"),
    "the note sits right after the intro",
  );
  const photo = block(moved, ids.photo);
  ok(
    photo?.align === "left" && photo.width === 40,
    "the photo moved to page 3, floated left at 40%",
  );
  ok(
    (await page.textContent(RUN))?.includes("Changed 2 blocks on pages 2–3"),
    "the run line counts the note and the photo",
  );
  await page.click(`${RUN} button:text-is("Undo")`);
  await until(
    "autosave of the panel's Undo",
    async () => where(await saved(), ids.photo) === 2,
  );
  const back = await saved();
  ok(
    block(back, ids.photo)?.width === 100 &&
      back.pages[1]!.blocks.length === content.pages[1]!.blocks.length,
    "the panel's Undo takes the whole run back",
  );
  ok((await page.$(RUN)) === null, "and the run line goes");

  heading("hands off during a run; one Undo takes it back");
  const introBefore = canonical(block(await saved(), ids.intro)?.text);
  const storyBefore = canonical(block(await saved(), ids.story)?.text);
  await page.fill(
    INPUT,
    `Slowly [fake:slow] [fake:tools]${JSON.stringify([
      {
        toolName: "set_text",
        input: { blockId: ids.intro, markdown: "RUN EDIT ONE" },
      },
      {
        toolName: "set_text",
        input: { blockId: ids.intro, markdown: "RUN EDIT TWO" },
      },
    ])}`,
  );
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`[data-block-id="${id}"]`)
        ?.textContent?.includes("RUN EDIT ONE"),
    ids.intro,
    { timeout: 60_000 },
  );
  ok(
    (await page.textContent(
      '[role="status"]:text("The assistant is editing")',
    )) !== null &&
      (await page.$eval("[data-assistant-running]", (el) =>
        el.getAttribute("data-assistant-running"),
      )) === "true",
    "the canvas says the assistant is editing",
  );
  await shot(page, "run-in-progress");
  // Try to type into the story and to undo, between the run's two calls.
  await page
    .click(`[data-block-id="${ids.story}"]`, { force: true })
    .catch(() => {});
  ok(
    await page.$eval(`[data-block-id="${ids.story}"]`, (el) => {
      const inside = el.contains(document.activeElement);
      return Boolean(el.closest("[inert]")) && !inside;
    }),
    "the page is inert: a click can't put the caret in it",
  );
  await page.keyboard.type(" AUTHORTYPED");
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "false",
    LOG,
    { timeout: 60_000 },
  );
  await until("autosave of the second edit", async () =>
    JSON.stringify(block(await saved(), ids.intro)).includes("RUN EDIT TWO"),
  );
  const mid = await saved();
  ok(
    !JSON.stringify(mid).includes("AUTHORTYPED") &&
      canonical(block(mid, ids.story)?.text) === storyBefore,
    "typing into the page didn't land, and Ctrl+Z didn't split the run",
  );
  await shot(page, "run-line-undo");
  await page.click(`${RUN} button:text-is("Undo")`);
  await until(
    "autosave of the run's Undo",
    async () =>
      canonical(block(await saved(), ids.intro)?.text) === introBefore,
  );
  ok(true, "one Undo restored the pre-run text");
  ok((await page.$(RUN)) === null, "and the run's line went with it");

  await checkAsk({
    page,
    sql,
    adminId,
    draftId,
    chat,
    base: base!,
    publishedId,
    saved,
    ok,
    heading,
  });
  await checkBreaker({ page, sql, chat, adminId, draftId, saved, ok, heading });

  await visionChecks(page, {
    photoId,
    photoKey: `${tag}/photo.webp`,
    saved,
    runScript: (p, calls) => runScript(p, calls as never),
    ok,
    heading,
  });

  await checkCover({ page, sql, base: base!, tag, ok, heading });

  console.log("\nassistant tools gate: all checks passed");
}

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
    values (${adminId}, ${`${tag}@example.invalid`}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${adminId}, now() + interval '1 hour')`;
  await sql`insert into issues (id, title, theme, status, content) values
    (${draftId}, ${tag}, 'classic', 'draft', ${sql.json({ version: 10, ...content } as never)})`;
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`
    select coalesce(max(number), 0) + 1000 as n from issues`;
  await sql`insert into issues (id, title, theme, status, content, number, published_at)
    values (${publishedId}, ${tag}, 'classic', 'published', ${sql.json({ version: 10, ...content } as never)}, ${n}, now())`;
  await sql`insert into images (id, key, width, height, issue_id)
    values (${photoId}, ${`${tag}/photo.webp`}, 1600, 1067, ${draftId})`;
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await checks(await ctx.newPage());
} finally {
  await browser.close();
  await sql`delete from ai_usage where user_id = ${adminId} or issue_id = ${draftId}`;
  await sql`delete from images where id = ${photoId}`;
  await sql`delete from issues where id in (${draftId}, ${publishedId})`;
  await sql`delete from sessions where user_id = ${adminId}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
}
