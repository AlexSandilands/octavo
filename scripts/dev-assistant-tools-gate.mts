// Dev-only: the assistant's editing tools (#310) in a real editor, driven by
// scripted fake-provider runs (`[fake:tools]` + a JSON list of calls):
//   AI_PROVIDER=fake AI_MONTHLY_BUDGET_USD=5 NEXT_PUBLIC_AI_ASSISTANT=1 PORT=3310 npm run dev
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-assistant-tools-gate.mts http://localhost:3310
// set_text → the overflow reported per block → split_page → fits (the real
// measurer, off screen); autosave keeps the result; Ctrl+Z takes the whole run
// back in one step; insert after a block; move and resize a photo; an unknown id
// refused and reported; and both circuit-breaker conditions stop a run with
// its edits kept.
//
// SAFETY: shared dev database. It mints its own admin, session, draft and one
// photo row (a key with no file behind it); the finally deletes exactly those
// and the ai_usage its runs left.
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const [base] = process.argv.slice(2);
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
const photoId = crypto.randomUUID();

const RAIL = 'nav[aria-label="Editor panels"]';
const BUTTON = `${RAIL} button[aria-label="Assistant"]`;
const INPUT = "#assistant-input";
const LOG = '[role="log"]';
const RUN = "[data-assistant-run]";
const PRESET = (label: string) => `button:text-is("${label}")`;

type Block = { id: string; type: string; [k: string]: unknown };
type Doc = { pages: { id: string; cover?: boolean; blocks: Block[] }[] };
const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const text = (id: string, paras: string[]): Block => ({
  id,
  type: "text",
  text: { type: "doc", content: paras.map(para) },
});
const ids = {
  cover: crypto.randomUUID(),
  p2: crypto.randomUUID(),
  p3: crypto.randomUUID(),
  head: crypto.randomUUID(),
  intro: crypto.randomUUID(),
  photo: crypto.randomUUID(),
  story: crypto.randomUUID(),
  next: crypto.randomUUID(),
};
const sentence = "The club met on the green at dawn to rig the boats. ";
const content: Doc = {
  pages: [
    { id: ids.cover, cover: true, blocks: [] },
    {
      id: ids.p2,
      blocks: [
        {
          id: ids.head,
          type: "heading",
          title: "Club news",
          kicker: "",
          level: "main",
        },
        text(ids.intro, ["A short introduction to the month."]),
        {
          id: ids.photo,
          type: "image",
          imageId: photoId,
          align: "full",
          width: 100,
          caption: "",
        },
        text(ids.story, ["The first paragraph.", "The second paragraph."]),
      ],
    },
    {
      id: ids.p3,
      blocks: [
        {
          id: ids.next,
          type: "heading",
          title: "Next month",
          kicker: "",
          level: "section",
        },
      ],
    },
  ],
};

// jsonb stores keys in its own order; compare with keys sorted.
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
const saved = async (): Promise<Doc> =>
  (
    await sql<
      { content: Doc }[]
    >`select content from issues where id = ${draftId}`
  )[0]!.content;
const where = (doc: Doc, id: string) =>
  doc.pages.findIndex((p) => p.blocks.some((b) => b.id === id)) + 1;
const block = (doc: Doc, id: string) =>
  doc.pages.flatMap((p) => p.blocks).find((b) => b.id === id);
async function until(what: string, test: () => Promise<boolean>, ms = 15_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await test()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`FAIL: timed out waiting for ${what}`);
}

/** Every tool output the panel sent back, in order, read off the requests. */
const outputs: string[] = [];
/** The author's words in each request that opened a run. */
const asked: string[] = [];
const seen = new Set<string>();
let requests = 0;

async function runScript(
  page: Page,
  calls: { toolName: string; input: object }[],
) {
  const from = outputs.length;
  const sent = requests;
  await page.fill(INPUT, `Please [fake:tools]${JSON.stringify(calls)}`);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "true",
    LOG,
  );
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "false",
    LOG,
    { timeout: 60_000 },
  );
  return { outputs: outputs.slice(from), requests: requests - sent };
}

async function checks(page: Page) {
  page.on("request", (req) => {
    if (!req.url().endsWith("/api/admin/ai/chat") || req.method() !== "POST")
      return;
    requests++;
    const body = req.postDataJSON() as {
      messages: {
        role: string;
        parts: {
          type: string;
          toolCallId?: string;
          text?: string;
          output?: { text: string };
        }[];
      }[];
    };
    const last = body.messages.at(-1);
    if (last?.role === "user")
      asked.push(
        last.parts
          .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
          .join(""),
      );
    if (last?.role !== "assistant") return;
    for (const part of last.parts)
      if (
        part.type.startsWith("tool-") &&
        part.output &&
        !seen.has(part.toolCallId!)
      ) {
        seen.add(part.toolCallId!);
        outputs.push(part.output.text);
      }
  });
  await page.goto(`${base}/admin/issues/${draftId}/edit`);
  await page.waitForSelector(RAIL);
  await page.click(BUTTON);
  await page.waitForSelector(INPUT);

  heading("presets");
  const tidy = page.locator(PRESET("Tidy this page"));
  ok(
    (await tidy.getAttribute("aria-disabled")) === "true",
    "on the cover the presets are off",
  );
  await page.click('button[aria-label="Page 2"]');
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("button")]
        .find((b) => b.textContent === "Tidy this page")
        ?.hasAttribute("aria-disabled"),
  );
  ok(
    (await tidy.getAttribute("aria-disabled")) === null,
    "on an inside page they're on",
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
    /^Changed \d+ blocks on pages 2–\d+ and added \d+ pages\s*·\s*Undo$/.test(
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

  heading("the circuit-breaker");
  const run4 = await runScript(page, [
    {
      toolName: "move_block",
      input: { blockId: ids.next, after: { page: 2 } },
    },
    {
      toolName: "move_block",
      input: { blockId: ids.next, after: { page: 3 } },
    },
    {
      toolName: "move_block",
      input: { blockId: ids.next, after: { page: 2 } },
    },
    {
      toolName: "set_text",
      input: { blockId: ids.intro, markdown: "SHOULD NOT HAPPEN" },
    },
  ]);
  // The third move's result is never sent: the run stopped on it.
  ok(
    run4.requests === 3 && run4.outputs.length === 2,
    `three moves ran, then the run stopped (${run4.requests} requests)`,
  );
  await until(
    "autosave of the moves",
    async () => where(await saved(), ids.next) === 2,
  );
  ok(
    !JSON.stringify(block(await saved(), ids.intro)).includes("SHOULD NOT"),
    "the call after the trip never ran; the moves are kept",
  );
  const stopped = await page.textContent(RUN);
  ok(
    stopped?.includes(
      "I got stuck, so I stopped. Everything I did is in place and can be undone in one step.",
    ) && stopped.includes("Undo"),
    "the panel says it got stuck, with Undo",
  );
  const reads = Array.from({ length: 42 }, () => ({
    toolName: "read_page",
    input: { page: 2 },
  }));
  const run5 = await runScript(page, [
    ...reads,
    {
      toolName: "set_text",
      input: { blockId: ids.intro, markdown: "SHOULD NOT HAPPEN" },
    },
  ]);
  ok(
    run5.requests === 41,
    `41 calls, then the run stopped (${run5.requests} requests)`,
  );
  ok(
    !JSON.stringify(block(await saved(), ids.intro)).includes("SHOULD NOT"),
    "nothing after the 41st ran",
  );

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
  await sql`delete from issues where id = ${draftId}`;
  await sql`delete from sessions where user_id = ${adminId}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
}
