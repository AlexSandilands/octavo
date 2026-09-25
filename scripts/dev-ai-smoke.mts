// Dev-only, SPENDS MONEY: the chat route's real-provider smoke test (#308),
// a handful of requests against a server started with a real key, e.g.
//   AI_PROVIDER=anthropic AI_MODEL=claude-sonnet-5 AI_MONTHLY_BUDGET_USD=5 \
//     PORT=3308 npm run dev
// It holds one conversation the way the #309 panel does: two author messages
// (answering any read_page calls), then a reply stopped mid-tool-call and one
// cut off mid-stream, each followed by another message. It prints each
// request's ledger row and checks the tokens were reported (no "~") and that
// later requests read the conversation from the cache.
//
// SAFETY: shared dev database. It mints a scratch admin, session and draft and
// deletes them, and its ai_usage rows, in the finally; the spend is printed
// first so it can be reported.
// Run: npx tsx scripts/dev-ai-smoke.mts <base-url>
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const base = process.argv[2] ?? "";
if (!base) throw new Error("usage: dev-ai-smoke.mts <base-url>");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};

const tag = `ai-smoke-${crypto.randomUUID().slice(0, 8)}`;
const adminId = crypto.randomUUID();
const token = crypto.randomUUID();
const issueId = crypto.randomUUID();
const runIds: string[] = [];

const PAGES: Record<number, string> = {
  1: 'Page 1 (the cover) — ~40% full\n[h1] heading main: "The Allotment Gazette"\n[t1] text: Autumn issue. News from the plots, the harvest supper and the committee.',
  2: 'Page 2 — ~70% full\n[h2] heading main, kicker "Club Notes": "Harvest supper"\n[t2] text: The harvest supper is on Saturday 18 October at the village hall, from 6pm. Bring a dish to share and your own plates. Tickets are £5 from Margaret at plot 12; children eat free.\n\nThe raffle raises money for the new water butts. Prizes so far: a hamper from the farm shop, a pair of secateurs and a load of well-rotted manure, delivered.',
  3: 'Page 3 — ~55% full\n[h3] heading main: "Committee news"\n[t3] text: The committee met on 2 September. The waiting list is down to eleven names. Rents stay the same next year. The gate code changes on 1 November; members will be told by email.',
};

const projection = [
  `Issue: "${tag}" (theme classic, draft)`,
  "Photos uploaded, not placed: img-a1 (landscape), img-b2 (portrait)",
  "Logos: Club crest. Sponsors: none.",
  "",
  "Outline:",
  "  1. The Allotment Gazette (cover) — ~40% full",
  "  2. Harvest supper — ~70% full",
  "  3. Committee news — ~55% full",
  "",
  "Current page, in full:",
  PAGES[2],
].join("\n");

const userMessage = (text: string, withProjection = true): UIMessage => ({
  id: crypto.randomUUID(),
  role: "user",
  parts: [
    ...(withProjection
      ? [{ type: "data-projection" as const, data: { text: projection } }]
      : []),
    { type: "text", text },
  ],
});

async function send(
  runId: string,
  messages: UIMessage[],
  cutMidPart = false,
): Promise<{ status: number; chunks: UIMessageChunk[]; body?: string }> {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/admin/ai/chat`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "content-type": "application/json",
      origin: new URL(base).origin,
      cookie: `authjs.session-token=${token}`,
    },
    body: JSON.stringify({ runId, issueId, messages }),
  });
  if (!res.ok)
    return { status: res.status, chunks: [], body: await res.text() };
  const chunks: UIMessageChunk[] = [];
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const l of lines)
      if (l.startsWith("data: ") && l !== "data: [DONE]")
        chunks.push(JSON.parse(l.slice(6)) as UIMessageChunk);
    // Hang up inside the first streamed part: half a thought, sentence or call.
    if (cutMidPart && chunks.some((c) => /-delta$/.test(c.type))) {
      controller.abort();
      break;
    }
  }
  return { status: res.status, chunks };
}

async function assemble(chunks: UIMessageChunk[], last?: UIMessage) {
  let message: UIMessage | undefined;
  const stream = new ReadableStream<UIMessageChunk>({
    start(c) {
      for (const chunk of chunks) c.enqueue(chunk);
      c.close();
    },
  });
  try {
    for await (const m of readUIMessageStream({ stream, message: last }))
      message = m;
  } catch {
    // A stream cut short ends mid-part; keep what arrived.
  }
  return message!;
}

const textOf = (m: UIMessage) =>
  m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join(" ");

/** Answers read_page calls the way the editor would, until the run ends. */
async function run(history: UIMessage[], label: string) {
  const runId = crypto.randomUUID();
  runIds.push(runId);
  let assistant: UIMessage | undefined;
  for (let round = 0; round < 4; round++) {
    const messages = assistant ? [...history, assistant] : history;
    const res = await send(runId, messages);
    const error = res.chunks.find((c) => c.type === "error");
    ok(
      res.status === 200 && !error,
      `${label}, request ${round + 1}: 200${error?.type === "error" ? ` but ${error.errorText}` : (res.body ?? "")}`,
    );
    assistant = await assemble(res.chunks, assistant);
    const pending = assistant.parts.filter(
      (p) => p.type === "tool-read_page" && p.state === "input-available",
    );
    if (pending.length === 0) break;
    assistant = {
      ...assistant,
      parts: assistant.parts.map((p) =>
        p.type === "tool-read_page" && p.state === "input-available"
          ? {
              ...p,
              state: "output-available" as const,
              output: {
                text:
                  PAGES[(p.input as { page: number }).page] ??
                  "There is no such page; this issue has 3 pages.",
              },
            }
          : p,
      ),
    } as UIMessage;
  }
  console.log(`    reply: ${textOf(assistant!).slice(0, 160)}`);
  return { runId, assistant: assistant! };
}

type Row = {
  model: string;
  prompt_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  completion_tokens: number;
  cost_usd: number;
};
const rowsFor = (runId: string) => sql<Row[]>`
  select model, prompt_tokens, cache_read_tokens, cache_write_tokens,
         completion_tokens, cost_usd::float8 as cost_usd
  from ai_usage where run_id = ${runId} order by created_at`;

try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
    values (${adminId}, ${`${tag}@example.invalid`}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${adminId}, now() + interval '1 hour')`;
  await sql`insert into issues (id, title, theme, status, content)
    values (${issueId}, ${tag}, 'classic', 'draft', ${sql.json({ version: 1, pages: [] })})`;

  console.log("\n── two messages in one conversation");
  const history: UIMessage[] = [
    userMessage(
      "What's on page 3? Answer in one sentence; don't change anything.",
    ),
  ];
  const first = await run(history, "message 1");
  history.push(first.assistant);
  history.push(
    userMessage("Thanks. In one sentence, when is the harvest supper?"),
  );
  const second = await run(history, "message 2");
  history.push(second.assistant);

  console.log("\n── stopped mid-tool-call, then another message");
  history.push(userMessage("Read page 1 and tell me what's on it."));
  const stopRun = crypto.randomUUID();
  runIds.push(stopRun);
  const stopped = await send(stopRun, history);
  let cut = await assemble(stopped.chunks);
  const hadCall = cut.parts.some((p) => p.type === "tool-read_page");
  // The panel's Stop: a complete, unanswered call is closed as an error.
  cut = {
    ...cut,
    parts: cut.parts.map((p) =>
      p.type === "tool-read_page" && p.state === "input-available"
        ? {
            ...p,
            state: "output-error" as const,
            errorText: "Stopped by the editor.",
          }
        : p,
    ),
  } as UIMessage;
  console.log(`    stopped reply had a read_page call: ${hadCall}`);
  history.push(cut);
  history.push(
    userMessage("Never mind. In one sentence, what is page 2 about?"),
  );
  const afterStop = await run(history, "after Stop");
  history.push(afterStop.assistant);

  console.log("\n── cut off mid-stream, then another message");
  history.push(userMessage("Read page 3 and summarise it in two sentences."));
  const cutRun = crypto.randomUUID();
  runIds.push(cutRun);
  const partial = await send(cutRun, history, true);
  let broken = await assemble(partial.chunks);
  // The panel drops a partial tool call; everything else stays as it arrived.
  broken = {
    ...broken,
    parts: broken.parts.filter(
      (p) => !(p.type === "tool-read_page" && p.state === "input-streaming"),
    ),
  } as UIMessage;
  console.log(
    `    kept parts: ${broken.parts.map((p) => p.type).join(", ") || "(none)"}`,
  );
  if (broken.parts.length) history.push(broken);
  history.push(userMessage("Sorry, one sentence on page 3 then."));
  await run(history, "after the cut");

  await new Promise((r) => setTimeout(r, 1500));
  console.log("\n── the ledger");
  let spend = 0;
  const all: Row[] = [];
  for (const id of runIds) {
    const rows = await rowsFor(id);
    for (const r of rows) {
      spend += r.cost_usd;
      all.push(r);
      console.log(
        `    ${r.model.padEnd(20)} in ${r.prompt_tokens} · cache read ${r.cache_read_tokens} · cache write ${r.cache_write_tokens} · out ${r.completion_tokens} · $${r.cost_usd.toFixed(6)}`,
      );
    }
  }
  console.log(`    ${all.length} requests, $${spend.toFixed(6)} in total`);
  const firstTwo = [
    ...(await rowsFor(first.runId)),
    ...(await rowsFor(second.runId)),
  ];
  ok(
    firstTwo.every(
      (r) =>
        !r.model.endsWith("~") && r.prompt_tokens + r.cache_read_tokens > 0,
    ),
    "the two messages' rows carry reported tokens, not estimates",
  );
  const secondRows = await rowsFor(second.runId);
  ok(
    secondRows.length > 0 && secondRows[0]!.cache_read_tokens > 0,
    `cache_read_input_tokens > 0 on the second message's first request (${secondRows[0]?.cache_read_tokens})`,
  );
  const stopRows = await rowsFor(afterStop.runId);
  ok(
    stopRows[0] !== undefined && stopRows[0].cache_read_tokens > 0,
    `after Stop: accepted, and read from cache (${stopRows[0]?.cache_read_tokens})`,
  );
  console.log("\nPASS — real-provider smoke");
} finally {
  if (runIds.length)
    await sql`delete from ai_usage where run_id in ${sql(runIds)}`;
  await sql`delete from ai_usage where user_id = ${adminId}`;
  await sql`delete from issues where id = ${issueId}`;
  await sql`delete from sessions where user_id = ${adminId}`;
  await sql`delete from users where id = ${adminId}`;
  console.log("scratch rows removed");
  await sql.end();
}
