// Dev-only: the assistant's side panel (issue #309) in a real browser, against a
// dev server with the fake provider and the button on:
//   AI_PROVIDER=fake AI_MONTHLY_BUDGET_USD=5 NEXT_PUBLIC_AI_ASSISTANT=1 PORT=3309 npm run dev
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-assistant-panel-gate.mts http://localhost:3309
// It opens and closes the panel with the mouse and the keyboard, checks focus in
// and out, the rail's order, the cover inspector's hand-off, the drafts-only and
// budget-spent states, a streamed reply with a read_page round trip (fills vs the
// canvas's overflow marker), Stop, an inline error, the usage footer, the log's
// announcements, a full conversation and a tablet's width.
// With `--off`, against a server with neither variable set, it checks the
// button, the help section and the usage route are all absent
// (assistant-panel-gate-off.mts).
//
// SAFETY: shared dev database. It mints its own admin, session, one draft and
// one published issue; the budget check holds one scratch ai_usage row for a
// moment. The finally deletes exactly those rows and the ai_usage its runs left.
import assert from "node:assert/strict";
import { chromium, type Page, type Request } from "playwright";
import postgres from "postgres";
import { AI_ERROR_COPY } from "../src/lib/ai-chat-contract";
import { railOrder } from "./editor-rail-gate-support.mts";
import { checkOff } from "./assistant-panel-gate-off.mts";

process.loadEnvFile?.(".env.local");
const [base, flag] = process.argv.slice(2);
if (!base) throw new Error("usage: dev-assistant-panel-gate.mts <url> [--off]");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  assert(cond, `FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const tag = `assistant-gate-${crypto.randomUUID().slice(0, 8)}`;
const adminId = crypto.randomUUID();
const token = crypto.randomUUID();
const draftId = crypto.randomUUID();
const publishedId = crypto.randomUUID();
const spendId = crypto.randomUUID();

const RAIL = 'nav[aria-label="Editor panels"]';
const BUTTON = `${RAIL} button[aria-label="Assistant"]`;
const CLOSE = `${RAIL} button[aria-label="Close panel"]`;
const PANEL = "aside#editor-side-panel";
const INPUT = "#assistant-input";
const LOG = '[role="log"]';

type Content = { pages: { id: string; cover?: boolean; blocks: unknown[] }[] };
const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

async function openEditor(page: Page, id: string) {
  await page.goto(`${base}/admin/issues/${id}/edit`);
  await page.waitForSelector(RAIL);
}
const panelOpen = (page: Page) =>
  page.$eval(
    PANEL,
    (el) => !el.hasAttribute("aria-hidden") && el.clientWidth > 0,
  );
const focusedId = (page: Page) =>
  page.evaluate(() => document.activeElement?.id);
const focusedLabel = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
const logText = (page: Page) => page.$eval(LOG, (el) => el.textContent ?? "");
async function waitIdle(page: Page) {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "false",
    LOG,
    { timeout: 30_000 },
  );
}

/** Everything with the assistant on: the panel through all its states. */
async function onChecks(page: Page, pageCount: number) {
  heading("Open and close");
  await openEditor(page, draftId);
  ok(await page.isVisible(BUTTON), "Assistant button on the rail");
  ok(!(await panelOpen(page)), "panel starts closed");
  ok(
    await page.isVisible("[data-cover-inspector]"),
    "the cover opens with its inspector",
  );
  await page.click(BUTTON);
  await page.waitForSelector(INPUT);
  // Waited for, not read once: a cold dev compile can land mid-slide.
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return el && !el.hasAttribute("aria-hidden") && el.clientWidth > 0;
  }, PANEL);
  ok(await panelOpen(page), "a click opens the panel");
  const rail = await railOrder(page);
  ok(rail.endsWith("Assistant, Close panel"), `Close at the foot: ${rail}`);
  ok(
    (await focusedId(page)) === "assistant-input",
    "focus goes to the composer",
  );
  ok(
    !(await page.isVisible("[data-cover-inspector]")),
    "the inspector steps aside on a cover",
  );
  ok(
    (await page.textContent(PANEL))?.includes(
      "The cover inspector is hidden while the assistant is open.",
    ),
    "the cover note says so",
  );
  await page.click(CLOSE);
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.hasAttribute("aria-hidden"),
    PANEL,
  );
  ok(
    (await focusedLabel(page)) === "Assistant",
    "Close hands focus back to the rail button",
  );
  await page.waitForSelector("[data-cover-inspector]");
  ok(true, "the inspector comes back");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.activeElement?.id === "assistant-input",
  );
  ok(
    await panelOpen(page),
    "Enter on the rail button opens it, focus in the composer",
  );
  await page.focus(BUTTON);
  await page.keyboard.press("Space");
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.hasAttribute("aria-hidden"),
    PANEL,
  );
  ok(
    (await focusedLabel(page)) === "Assistant",
    "Space closes it again, focus stays on the button",
  );

  heading("A question, a read_page round trip, the footer");
  const bodies: {
    messages: {
      role: string;
      parts: { type: string; [k: string]: unknown }[];
    }[];
  }[] = [];
  // Each usage fetch, as the number of chat requests sent before it.
  const usageFetches: number[] = [];
  const onRequest = (r: Request) => {
    if (r.url().endsWith("/api/admin/ai/chat")) bodies.push(r.postDataJSON());
    if (r.url().endsWith("/api/admin/ai/usage"))
      usageFetches.push(bodies.length);
  };
  page.on("request", onRequest);
  await page.click(BUTTON);
  await page.waitForSelector("[data-assistant-usage]");
  const before = await page.textContent("[data-assistant-usage]");
  ok(
    /^US\$\d+\.\d\d of US\$5\.00 used this month$/.test(before ?? ""),
    `footer reads "${before}"`,
  );
  await page.fill(INPUT, "Which pages are nearly full?");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (sel) =>
      document
        .querySelector(sel)
        ?.textContent?.includes("Nothing needed changing."),
    LOG,
    { timeout: 30_000 },
  );
  await waitIdle(page);
  const log = await logText(page);
  ok(
    log.includes("Which pages are nearly full?"),
    "the author's words are in the log",
  );
  ok(log.includes('Looking at "ISSUE'), "the reply streamed in");
  ok(log.includes("Read page 1"), "the read_page call shows as one quiet line");
  ok(bodies.length === 2, "two requests: the question, then the tool result");
  const projection = bodies[0]!.messages[0]!.parts.find(
    (p) => p.type === "data-projection",
  ) as { data: { text: string } } | undefined;
  ok(
    projection && !log.includes("OUTLINE"),
    "the projection rode along, unseen",
  );
  const outline = projection!.data.text
    .split("\n")
    .filter((l) => /^p\d+ /.test(l));
  ok(outline.length === pageCount, `outline lists all ${pageCount} pages`);
  ok(
    !projection!.data.text.includes("fill not measured"),
    "every page's fill was measured",
  );
  ok(
    /overflows by ~\d+ lines?$/.test(outline.at(-1)!),
    `the long page: "${outline.at(-1)}"`,
  );
  const second = bodies[1]!.messages
    .at(-1)!
    .parts.find((p) => p.type === "tool-read_page") as
    | { state: string; output: { text: string } }
    | undefined;
  ok(
    second?.state === "output-available" &&
      second.output.text.startsWith("PAGE 1 — the cover"),
    "read_page returned page 1 in full",
  );
  // The provider's signed, empty reasoning part goes back exactly as it came (#308).
  const reasoning = bodies[1]!.messages
    .at(-1)!
    .parts.find((p) => p.type === "reasoning") as
    | { id?: string; text: string; providerMetadata?: unknown }
    | undefined;
  ok(
    reasoning?.id === "0" &&
      reasoning.text === "" &&
      JSON.stringify(reasoning.providerMetadata).includes("signature"),
    "the empty reasoning part is replayed with its id and signature",
  );
  ok(
    log.includes(
      `Read read_page (${second!.output.text.length} characters back)`,
    ),
    "the second turn arrived",
  );
  const withChat = await railOrder(page);
  ok(withChat.endsWith("Assistant, New conversation, Close panel"), withChat);
  ok(
    bodies.every(
      (b) =>
        (b as { runId?: string }).runId ===
        (bodies[0] as { runId?: string }).runId,
    ),
    "one runId for the run",
  );
  await page.waitForTimeout(1500);
  ok(
    usageFetches.join() === "0,2",
    `the run ended once: the footer fetched on opening and once after the second turn (${usageFetches.join()})`,
  );
  const [{ spent } = { spent: 0 }] = await sql<{ spent: number }[]>`
    select coalesce(sum(cost_usd), 0)::float as spent from ai_usage
    where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'`;
  ok(
    (await page.textContent("[data-assistant-usage]"))?.startsWith(
      // Spend rounds up to the cent, as /admin/ai shows it.
      `US$${(Math.ceil(Math.round(spent * 1_000_000) / 10_000) / 100).toFixed(2)} `,
    ),
    "and shows the ledger's figure",
  );

  heading("Fill figures against the canvas's overflow marker");
  for (let i = 1; i < pageCount; i++) {
    const line = outline[i]!;
    if (line.endsWith("a full-page photo")) continue;
    await page.click(`button[aria-label="Page ${i + 1}"]`);
    await page.waitForTimeout(400);
    const marked = await page.$$eval(
      "[data-editor-canvas-stage] .border-dashed.border-warn",
      (els) => els.length > 0,
    );
    ok(
      marked === / overflows by /.test(line),
      `p${i + 1}: ${marked ? "marked" : "fits"} — "${line.split(" · ").at(-1)}"`,
    );
  }
  await page.click('button[aria-label="Page 1 (cover)"]');

  heading("Stop, errors, the log");
  await page.fill(INPUT, "Take your time [fake:slow]");
  await page.keyboard.press("Enter");
  await page.waitForSelector('button[aria-label="Stop the reply"]');
  ok(
    (await page.getAttribute(LOG, "aria-busy")) === "true",
    "the log is busy while a reply streams",
  );
  await page.click('button[aria-label="Stop the reply"]');
  await waitIdle(page);
  ok(
    (await focusedId(page)) === "assistant-input",
    "Stop leaves focus in the composer",
  );
  await page.fill(INPUT, "Carry on.");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (sel) =>
      (
        document
          .querySelector(sel)
          ?.textContent?.match(/Nothing needed changing\./g) ?? []
      ).length >= 2,
    LOG,
    { timeout: 30_000 },
  );
  ok(true, "the conversation carries on after a Stop");
  await waitIdle(page);
  await page.fill(INPUT, "Break please [fake:fail]");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    ([sel, copy]) => document.querySelector(sel!)?.textContent?.includes(copy!),
    [LOG, AI_ERROR_COPY.provider_down],
    { timeout: 30_000 },
  );
  ok(true, "a route error shows inline in its own words");
  page.off("request", onRequest);

  heading("Budget spent");
  await sql`insert into ai_usage (id, user_id, run_id, model, provider, prompt_tokens,
      cache_read_tokens, cache_write_tokens, completion_tokens, cost_usd)
    values (${spendId}, ${adminId}, ${spendId}, 'fake', 'fake', 0, 0, 0, 0, 9999)`;
  try {
    await openEditor(page, draftId);
    await page.click(BUTTON);
    await page.waitForFunction(
      () =>
        (
          document.querySelector(
            "#assistant-input",
          ) as HTMLTextAreaElement | null
        )?.disabled,
    );
    ok(
      (await page.textContent(PANEL))?.includes(AI_ERROR_COPY.budget_spent),
      "the composer is off, with the route's message",
    );
  } finally {
    await sql`delete from ai_usage where id = ${spendId}`;
  }

  heading("Drafts only");
  await openEditor(page, publishedId);
  await page.click(BUTTON);
  await page.waitForSelector(
    `${PANEL} >> text=The assistant only works on drafts.`,
  );
  ok(
    (await page.$(INPUT)) === null,
    "a published issue gets the message and no composer",
  );
  ok(
    await page.evaluate(() =>
      document.activeElement?.textContent?.startsWith(
        "The assistant only works on drafts.",
      ),
    ),
    "focus lands on the message",
  );

  heading("A full conversation");
  await openEditor(page, draftId);
  await page.click(BUTTON);
  const filler = "A long note to fill the conversation. "
    .repeat(500)
    .slice(0, 19_000);
  for (let i = 0; i < 20; i++) {
    if (await page.isVisible("text=This conversation is full.")) break;
    await page.fill(INPUT, `${i} ${filler}`);
    await page.keyboard.press("Enter");
    await waitIdle(page);
  }
  ok(
    await page.isVisible("text=This conversation is full."),
    "the panel says the conversation is full",
  );
  ok(await page.isDisabled(INPUT), "and the composer is off");
  await page.click("text=Start a new one");
  await page.waitForFunction(
    () => document.activeElement?.id === "assistant-input",
  );
  ok(
    !(await logText(page)).includes("A long note"),
    "Start a new one: an empty thread, focus in the composer",
  );

  heading("A long paste is held, never cut");
  await page.fill(INPUT, "x".repeat(20_500));
  ok(
    (await page.inputValue(INPUT)).length === 20_500,
    "all 20,500 characters stay in the box",
  );
  ok(
    (await page.textContent("#assistant-input-count"))?.startsWith(
      "500 characters over the 20,000 limit",
    ),
    "the count says how far over it is",
  );
  ok(await page.isDisabled('button[aria-label="Send"]'), "and Send is off");
  await page.keyboard.press("Enter");
  ok(
    (await page.inputValue(INPUT)).length === 20_500,
    "Enter doesn't send it either",
  );
  await page.fill(INPUT, "");

  heading("A tablet's width");
  // Opened fresh on a tablet: the panel takes its minimum, the page the rest.
  await page.setViewportSize({ width: 768, height: 1024 });
  await openEditor(page, draftId);
  await page.click('button[aria-label="Page 2"]');
  await page.click(BUTTON);
  await page.waitForSelector(INPUT);
  await page.waitForTimeout(600);
  const widths = await page.evaluate(() => ({
    panel: document.querySelector("aside#editor-side-panel")!.clientWidth,
    canvas: document.querySelector("[data-editor-canvas-stage]")!.clientWidth,
    page: Math.round(
      document.querySelector("[data-page-frame]")!.getBoundingClientRect()
        .width,
    ),
  }));
  ok(widths.panel === 300, `the panel opens at its ${widths.panel}px minimum`);
  ok(
    widths.canvas >= 250,
    `the canvas keeps ${widths.canvas}px, the page ${widths.page}px wide`,
  );

  console.log("\nassistant panel gate: all checks passed");
}

const browser = await chromium.launch();
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
    values (${adminId}, ${`${tag}@example.invalid`}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${adminId}, now() + interval '1 hour')`;
  // A copy of a seed issue that opens on a cover, plus a page that overflows.
  const [source] = await sql<{ content: Content }[]>`
    select content from issues
    where (content->'pages'->0->>'cover')::boolean is true
      and jsonb_array_length(content->'pages') > 3
    order by number nulls last limit 1`;
  if (!source) throw new Error("no issue opens on a cover to copy");
  const long = Array.from({ length: 30 }, (_, i) =>
    para(
      `Paragraph ${i + 1}. ${"The club met on the green at dawn. ".repeat(6)}`,
    ),
  );
  const content = {
    ...source.content,
    pages: [
      ...source.content.pages,
      {
        id: crypto.randomUUID(),
        blocks: [
          {
            id: crypto.randomUUID(),
            type: "text",
            text: { type: "doc", content: long },
          },
        ],
      },
    ],
  };
  const pageCount = content.pages.length;
  await sql`insert into issues (id, title, theme, status, content) values
    (${draftId}, ${tag}, 'classic', 'draft', ${sql.json(content as never)})`;
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`
    select coalesce(max(number), 0) + 1000 as n from issues`;
  await sql`insert into issues (id, title, theme, status, content, number, published_at)
    values (${publishedId}, ${tag}, 'classic', 'published', ${sql.json(content as never)}, ${n}, now())`;
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
  const page = await ctx.newPage();

  if (flag === "--off") await checkOff({ page, base, draftId, ok, heading });
  else await onChecks(page, pageCount);
} finally {
  await browser.close();
  await sql`delete from ai_usage where user_id = ${adminId} or issue_id in (${draftId}, ${publishedId}) or id = ${spendId}`;
  await sql`delete from issues where id in (${draftId}, ${publishedId})`;
  await sql`delete from sessions where user_id = ${adminId}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
}
