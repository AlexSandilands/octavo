// The circuit-breaker half of dev-assistant-tools-gate.mts (#310): a block
// moved too often, too many calls, and the run's $0.50 cap each stop a run with
// its edits kept and the panel's "I got stuck" line.
import type { Page } from "playwright";
import type postgres from "postgres";
import {
  block,
  until,
  where,
  type Doc,
  type watchChat,
} from "./fixtures/assistant/tools-gate-kit.mts";
import { ids } from "./fixtures/assistant/tools-gate-kit.mts";

const RUN = "[data-assistant-run]";
const LOG = '[role="log"]';

export async function checkBreaker(d: {
  page: Page;
  sql: postgres.Sql;
  chat: ReturnType<typeof watchChat>;
  adminId: string;
  draftId: string;
  saved: () => Promise<Doc>;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
}) {
  const { page, sql, chat, saved, ok, heading } = d;
  const runScript = (_: Page, ...args: Parameters<typeof chat.runScript>) =>
    chat.runScript(...args);
  // The run-cap case: once the run's first reply is streaming, the run has
  // "spent" $0.60, so the route refuses its next request.
  let capping = false;
  let capped: Promise<void> | null = null;
  page.on("response", (res) => {
    const capRun = chat.runId();
    if (!capping || capped || !capRun) return;
    if (!res.url().endsWith("/api/admin/ai/chat")) return;
    capped = sql`insert into ai_usage (id, user_id, issue_id, run_id, model,
      provider, prompt_tokens, cache_read_tokens, cache_write_tokens,
      completion_tokens, cost_usd) values (${crypto.randomUUID()}, ${d.adminId},
      ${d.draftId}, ${capRun}, 'fake', 'fake', 0, 0, 0, 0, 0.6)`.then(
      () => undefined,
    );
  });

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

  heading("the run's $0.50 cap is the third breaker");
  capping = true;
  const run6 = await runScript(
    page,
    [
      {
        toolName: "set_text",
        input: { blockId: ids.intro, markdown: "Capped edit." },
      },
      {
        toolName: "set_text",
        input: { blockId: ids.intro, markdown: "SHOULD NOT HAPPEN" },
      },
    ],
    "Slowly [fake:slow]",
  );
  capping = false;
  await capped;
  ok(run6.requests === 2, "the route refused the run's second request");
  await until("autosave of the capped edit", async () =>
    JSON.stringify(block(await saved(), ids.intro)).includes("Capped edit."),
  );
  const capLine = await page.textContent(RUN);
  const capLog = await page.textContent(LOG);
  ok(
    capLine?.includes("I got stuck, so I stopped.") &&
      capLine.includes("Undo") &&
      !capLog?.includes("used its share of the budget"),
    "the panel shows the breaker's message, with Undo, not the route's error",
  );
}
