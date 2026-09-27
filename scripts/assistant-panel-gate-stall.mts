// dev-assistant-panel-gate.mts's stalled-reply case (#358): a run edits a
// block, then the fake provider goes quiet; the route's idle timeout ends the
// run with the provider_down line, the edit kept, and Undo taking it back.
// Quick with AI_IDLE_TIMEOUT_MS=3000 on the server; else it waits a minute.
import type { Page } from "playwright";
import type postgres from "postgres";
import { AI_ERROR_COPY } from "../src/lib/ai-chat-contract";

const LOG = '[role="log"]';
const RUN = "[data-assistant-run]";
const INPUT = "#assistant-input";

type Content = { pages: { blocks: { id: string }[] }[] };

export async function checkStall(d: {
  page: Page;
  sql: postgres.Sql;
  draftId: string;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
}) {
  const { page, sql, draftId, ok, heading } = d;
  heading("A stalled reply (#358)");
  const saved = async () =>
    JSON.stringify(
      (
        await sql<{ content: Content }[]>`
          select content from issues where id = ${draftId}`
      )[0]!.content,
    );
  const until = async (what: string, cond: () => Promise<boolean>) => {
    for (let i = 0; i < 60; i++) {
      if (await cond()) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`FAIL: timed out waiting for ${what}`);
  };
  const busy = (value: string, timeout = 30_000) =>
    page.waitForFunction(
      ([sel, v]) =>
        document.querySelector(sel!)?.getAttribute("aria-busy") === v,
      [LOG, value],
      { timeout },
    );

  const { content } = (
    await sql<{ content: Content }[]>`
      select content from issues where id = ${draftId}`
  )[0]!;
  const blockId = content.pages.at(-1)!.blocks[0]!.id;
  const script = [
    {
      toolName: "set_text",
      input: { blockId, markdown: "Written before the stall." },
    },
    "stall",
  ];
  await page.fill(INPUT, `Please [fake:tools]${JSON.stringify(script)}`);
  const started = Date.now();
  await page.keyboard.press("Enter");
  await busy("true");
  ok(
    !(await page.textContent(LOG))?.includes(AI_ERROR_COPY.provider_down),
    "the last error clears as the run starts",
  );
  await busy("false", 90_000);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  ok(
    (await page.textContent(LOG))?.includes(AI_ERROR_COPY.provider_down),
    `the run ends with "${AI_ERROR_COPY.provider_down}" (${seconds}s)`,
  );
  const line = await page.textContent(RUN);
  ok(
    line?.includes("Changed 1 block") && line.includes("Undo"),
    `the edit is kept, with its line and Undo: "${line}"`,
  );
  ok(
    !(await page.$('[data-assistant-running="true"]')),
    "the canvas is the author's again",
  );
  await until("the edit's autosave", async () =>
    (await saved()).includes("Written before the stall."),
  );
  ok(true, "the edit before the stall is saved");
  await page.click(`${RUN} button:has-text("Undo")`);
  await until("the undo's autosave", async () => {
    const now = await saved();
    return (
      !now.includes("Written before the stall.") && now.includes("Paragraph 1.")
    );
  });
  ok(true, "Undo takes the run back in one step");
}
