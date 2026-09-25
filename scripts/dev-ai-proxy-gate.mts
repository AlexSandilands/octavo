// Dev-only: proves the assistant's chat route (issue #308) headless against a
// dev server started with the fake provider and a budget:
//   AI_PROVIDER=fake AI_MONTHLY_BUDGET_USD=5 PORT=3308 npm run dev
// It checks access (signed out, member, cross-origin, published, missing), the
// body limits, a two-turn tool round trip read the way useChat reads it, the
// failure copy mid-stream, the per-run cap, the monthly budget and both rate
// limits, and that every request left an ai_usage row for its run. Pass a
// second URL, a server with AI_PROVIDER unset, to check the route 404s there,
// and --log <file>, the server's output, to check a refused body's content
// never reaches the log.
//
// SAFETY: shared dev database. It mints its own two admins, one member, one
// draft and one published issue, and the ai_usage rows are all under run ids it
// made; the finally deletes exactly those. The budget check holds a scratch
// row for the length of one request, which is the only moment a teammate's
// request on the same database could see the month spent.
// Run: npx tsx scripts/dev-ai-proxy-gate.mts <base-url> [<off-base-url>] [--log <file>]
import type { UIMessage } from "ai";
import postgres from "postgres";
import { AI_PROJECTION_END } from "../src/lib/ai-chat-contract.ts";
import {
  assemble,
  checkLogLeak,
  checkRecordedReplies,
  chunksOf,
  type GateDeps,
  userMessage,
} from "./ai-proxy-gate-parts.mts";

process.loadEnvFile?.(".env.local");
const args = process.argv.slice(2);
const logAt = args.indexOf("--log");
const logPath = logAt >= 0 ? args.splice(logAt, 2)[1] : undefined;
const [base, offBase] = args;
if (!base) throw new Error("usage: dev-ai-proxy-gate.mts <base-url> [<off>]");

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));

const tag = `ai-gate-${crypto.randomUUID().slice(0, 8)}`;
const adminA = crypto.randomUUID();
const adminB = crypto.randomUUID();
const member = crypto.randomUUID();
const tokens = {
  a: crypto.randomUUID(),
  b: crypto.randomUUID(),
  m: crypto.randomUUID(),
};
const draftId = crypto.randomUUID();
const publishedId = crypto.randomUUID();
const runIds: string[] = [];
const newRun = () => {
  const id = crypto.randomUUID();
  runIds.push(id);
  return id;
};

const url = `${base}/api/admin/ai/chat`;
const origin = new URL(base).origin;

// Requests each session has sent from the right origin: what the route's
// request limiter counts.
const sent = new Map<string, number>();

function post(
  body: unknown,
  opts: { token?: string; origin?: string | null } = {},
) {
  if (opts.token && opts.origin === undefined)
    sent.set(opts.token, (sent.get(opts.token) ?? 0) + 1);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.origin !== null) headers.origin = opts.origin ?? origin;
  if (opts.token) headers.cookie = `authjs.session-token=${opts.token}`;
  return fetch(url, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function expectError(res: Response, status: number, code: string) {
  const body = (await res.json().catch(() => null)) as {
    error?: string;
    code?: string;
  } | null;
  ok(
    res.status === status && body?.code === code && !!body.error,
    `${status} ${code}: "${body?.error ?? "(no body)"}"`,
  );
}

const usageRows = (runId: string) =>
  sql<{ model: string; cost_usd: string }[]>`
    select model, cost_usd from ai_usage where run_id = ${runId}`;

try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified) values
    (${adminA}, ${`${tag}-a@example.invalid`}, true, false, now()),
    (${adminB}, ${`${tag}-b@example.invalid`}, true, false, now()),
    (${member}, ${`${tag}-m@example.invalid`}, false, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires) values
    (${tokens.a}, ${adminA}, now() + interval '1 hour'),
    (${tokens.b}, ${adminB}, now() + interval '1 hour'),
    (${tokens.m}, ${member}, now() + interval '1 hour')`;
  const content = sql.json({ version: 1, pages: [] });
  await sql`insert into issues (id, title, theme, status, content) values
    (${draftId}, ${tag}, 'classic', 'draft', ${content})`;
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`
    select coalesce(max(number), 0) + 1000 as n from issues`;
  await sql`insert into issues (id, title, theme, status, content, number, published_at)
    values (${publishedId}, ${tag}, 'classic', 'published', ${content}, ${n}, now())`;

  const hello = (issueId = draftId, runId = newRun()) => ({
    runId,
    issueId,
    messages: [userMessage("Tidy this page.", `${tag} marker line\nPage 1`)],
  });
  const deps: GateDeps = {
    post: (body) => post(body, { token: tokens.a }),
    ok,
    heading,
    expectError,
    hello: () => hello(),
    draftId,
    newRun,
    tag,
    logPath,
  };

  if (offBase) {
    heading("assistant off");
    const res = await fetch(`${offBase}/api/admin/ai/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: new URL(offBase).origin,
        cookie: `authjs.session-token=${tokens.a}`,
      },
      body: JSON.stringify(hello()),
    });
    ok(res.status === 404, `AI_PROVIDER unset → 404 (${res.status})`);
  }

  heading("access");
  await expectError(await post(hello()), 403, "unauthorised");
  await expectError(
    await post(hello(), { token: tokens.m }),
    403,
    "unauthorised",
  );
  await expectError(
    await post(hello(), { token: tokens.a, origin: "https://evil.example" }),
    403,
    "unauthorised",
  );
  await expectError(
    await post(hello(), { token: tokens.a, origin: null }),
    403,
    "unauthorised",
  );
  await expectError(
    await post(hello(publishedId), { token: tokens.a }),
    409,
    "not_draft",
  );
  await expectError(
    await post(hello(crypto.randomUUID()), { token: tokens.a }),
    404,
    "not_found",
  );

  heading("body limits");
  await expectError(await post("{", { token: tokens.a }), 400, "bad_request");
  await expectError(
    await post({ ...hello(), runId: "not-a-uuid" }, { token: tokens.a }),
    400,
    "bad_request",
  );
  await expectError(
    await post(
      { ...hello(), messages: [userMessage("x".repeat(20_001))] },
      { token: tokens.a },
    ),
    400,
    "bad_request",
  );
  await expectError(
    await post(
      {
        ...hello(),
        messages: Array.from({ length: 201 }, () => userMessage("hi")),
      },
      { token: tokens.a },
    ),
    413,
    "too_long",
  );
  await expectError(
    await post(
      {
        ...hello(),
        messages: Array.from({ length: 6 }, () =>
          userMessage("hi", "p".repeat(60_000)),
        ),
      },
      { token: tokens.a },
    ),
    413,
    "too_long",
  );
  const remote = userMessage("hi");
  remote.parts.push({
    type: "file",
    mediaType: "image/png",
    url: "https://example.com/a.png",
  });
  await expectError(
    await post({ ...hello(), messages: [remote] }, { token: tokens.a }),
    400,
    "bad_request",
  );

  // A reply over its cap fills the conversation; it isn't a bad request.
  const longReply: UIMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text: "r".repeat(60_001) }],
  };
  await expectError(
    await post(
      { ...hello(), messages: [...hello().messages, longReply] },
      { token: tokens.a },
    ),
    413,
    "too_long",
  );

  await checkLogLeak(deps);

  heading("a tool round trip");
  const run = newRun();
  const first = await post(hello(draftId, run), { token: tokens.a });
  ok(
    first.status === 200 &&
      first.headers.get("x-vercel-ai-ui-message-stream") === "v1",
    "200, UI message stream v1",
  );
  const chunks = await chunksOf(first);
  // Stop at once on a real provider: every check after this would spend.
  ok(
    chunks.some(
      (c) => c.type === "text-delta" && c.delta.startsWith("Looking at"),
    ),
    "the server runs AI_PROVIDER=fake",
  );
  const textAt = chunks.findIndex((c) => c.type === "text-delta");
  const callAt = chunks.findIndex((c) => c.type === "tool-input-available");
  ok(textAt !== -1 && callAt > textAt, "text streams, then a tool call");
  const assistant = await assemble(chunks);
  const said = assistant.parts
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("");
  ok(
    said.includes(`${tag} marker line`),
    `the model saw the projection: "${said}"`,
  );
  ok(
    assistant.parts.some((p) => p.type === "reasoning" && p.id === "0"),
    "the reply carries a reasoning part with an id, as a real stream does",
  );
  const call = assistant.parts.find((p) => p.type === "tool-read_page");
  ok(
    call?.type === "tool-read_page" &&
      call.state === "input-available" &&
      JSON.stringify(call.input) === '{"page":1}',
    "the call is read_page({ page: 1 }), awaiting the editor",
  );
  // The editor's answer, as addToolOutput would record it.
  const answered: UIMessage = {
    ...assistant,
    parts: assistant.parts.map((p) =>
      p.type === "tool-read_page"
        ? {
            ...p,
            state: "output-available" as const,
            output: { text: "Page 1: a heading and two paragraphs." },
          }
        : p,
    ),
  } as UIMessage;
  const second = await post(
    { runId: run, issueId: draftId, messages: [...hello().messages, answered] },
    { token: tokens.a },
  );
  const secondMessage = await assemble(await chunksOf(second), answered);
  const closing = secondMessage.parts.at(-1);
  ok(
    second.status === 200 &&
      closing?.type === "text" &&
      closing.text.startsWith("Read read_page (37 characters back)"),
    `the result yields a second turn: "${closing?.type === "text" ? closing.text : ""}"`,
  );
  const rows = await usageRows(run);
  ok(
    rows.length === 2 && rows.every((r) => r.model === "fake"),
    `two ai_usage rows for the run (${rows.map((r) => r.model).join(", ")})`,
  );

  await checkRecordedReplies(deps);

  heading("the projection's boundary");
  const echoed = await assemble(
    await chunksOf(
      await post(
        {
          runId: newRun(),
          issueId: draftId,
          messages: [
            userMessage("[fake:echo] Put the photo here.", "Last paragraph."),
          ],
        },
        { token: tokens.a },
      ),
    ),
  );
  const modelGot = echoed.parts.flatMap((p) =>
    p.type === "text" ? [p.text] : [],
  );
  ok(
    modelGot.join("") ===
      JSON.stringify([
        `Last paragraph.\n\n${AI_PROJECTION_END}`,
        "[fake:echo] Put the photo here.",
      ]),
    `the projection ends with the boundary, then the author's text: ${modelGot.join("")}`,
  );

  heading("failures mid-stream");
  for (const [trigger, label] of [
    ["[fake:fail]", "before the stream"],
    ["[fake:drop]", "during the stream"],
  ] as const) {
    const failRun = newRun();
    const res = await post(
      {
        runId: failRun,
        issueId: draftId,
        messages: [userMessage(trigger, "projection")],
      },
      { token: tokens.a },
    );
    const error = (await chunksOf(res)).find((c) => c.type === "error");
    const parsed =
      error?.type === "error"
        ? (JSON.parse(error.errorText) as { code?: string; error?: string })
        : null;
    ok(
      parsed?.code === "provider_down" && !!parsed.error,
      `${label}: provider_down, "${parsed?.error}"`,
    );
    const failRows = await usageRows(failRun);
    ok(
      failRows.length === 1 && failRows[0]!.model.startsWith("fake"),
      `…and still one ai_usage row (${failRows[0]?.model})`,
    );
  }

  heading("a reported model with no price");
  const odd = newRun();
  await (
    await post(
      {
        runId: odd,
        issueId: draftId,
        messages: [userMessage("[fake:odd-model] hello", "projection")],
      },
      { token: tokens.a },
    )
  ).text();
  const oddRows = await usageRows(odd);
  ok(
    oddRows.length === 1 && oddRows[0]!.model === "fake",
    `recorded against the configured model (${oddRows[0]?.model})`,
  );

  heading("the author hangs up");
  const hangUp = newRun();
  const controller = new AbortController();
  const slow = await fetch(url, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "content-type": "application/json",
      origin,
      cookie: `authjs.session-token=${tokens.a}`,
    },
    body: JSON.stringify({
      runId: hangUp,
      issueId: draftId,
      messages: [userMessage("[fake:slow] take your time", "projection")],
    }),
  });
  sent.set(tokens.a, (sent.get(tokens.a) ?? 0) + 1);
  await slow.body!.getReader().read();
  controller.abort();
  let hungUp: { model: string }[] = [];
  for (let i = 0; i < 20 && hungUp.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 250));
    hungUp = await usageRows(hangUp);
  }
  ok(
    hungUp.length === 1 && hungUp[0]!.model === "fake~",
    `a reply cut short still leaves an estimated row (${hungUp[0]?.model})`,
  );

  heading("run cap and budget");
  const capped = newRun();
  await sql`insert into ai_usage (id, run_id, model, provider, prompt_tokens,
      cache_read_tokens, cache_write_tokens, completion_tokens, cost_usd)
    values (${crypto.randomUUID()}, ${capped}, 'fake', 'fake', 0, 0, 0, 0, 0.5)`;
  await expectError(
    await post(hello(draftId, capped), { token: tokens.a }),
    402,
    "run_cap",
  );
  const spender = newRun();
  await sql`insert into ai_usage (id, run_id, model, provider, prompt_tokens,
      cache_read_tokens, cache_write_tokens, completion_tokens, cost_usd)
    values (${crypto.randomUUID()}, ${spender}, 'fake', 'fake', 0, 0, 0, 0, 9999)`;
  try {
    await expectError(
      await post(hello(), { token: tokens.a }),
      402,
      "budget_spent",
    );
  } finally {
    await sql`delete from ai_usage where run_id = ${spender}`;
  }

  heading("rate limits");
  // Admin B: 20 distinct runs pass, the 21st is refused, and a request on a
  // run already seen still goes through.
  const bRuns: string[] = [];
  for (let i = 0; i < 20; i++) {
    const res = await post(hello(draftId, newRun()), { token: tokens.b });
    await res.text();
    if (res.status === 200) bRuns.push(runIds.at(-1)!);
  }
  ok(bRuns.length === 20, "20 runs in ten minutes are allowed");
  await expectError(
    await post(hello(), { token: tokens.b }),
    429,
    "rate_limited",
  );
  const again = await post(hello(draftId, bRuns[0]), { token: tokens.b });
  await again.text();
  ok(again.status === 200, "a known run carries on past the run limit");
  // Admin A: 300 requests in ten minutes, counted before the body is read.
  while ((sent.get(tokens.a) ?? 0) < 300) {
    const res = await post("{", { token: tokens.a });
    await res.text();
    if (res.status === 429) break;
  }
  ok(sent.get(tokens.a) === 300, "300 requests in ten minutes are allowed");
  await expectError(await post("{", { token: tokens.a }), 429, "rate_limited");

  heading("metering");
  const successful = [run, ...bRuns];
  const missing: string[] = [];
  for (const id of successful)
    if ((await usageRows(id)).length === 0) missing.push(id);
  ok(missing.length === 0, `every successful run has its ai_usage rows`);

  console.log("\nPASS — the chat route meets #308's gate");
} finally {
  if (runIds.length)
    await sql`delete from ai_usage where run_id in ${sql(runIds)}`;
  await sql`delete from ai_usage where user_id in ${sql([adminA, adminB, member])}`;
  await sql`delete from issues where id in ${sql([draftId, publishedId])}`;
  await sql`delete from sessions where user_id in ${sql([adminA, adminB, member])}`;
  await sql`delete from users where id in ${sql([adminA, adminB, member])}`;
  console.log("scratch rows removed");
  await sql.end();
}
