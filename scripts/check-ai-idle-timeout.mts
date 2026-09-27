// The chat route's idle timeout (#358), in-process on the route's own model
// call (streamAssistant) with short timeouts: the timer itself; a provider that
// goes quiet mid-reply or before replying has its request aborted and the
// stream ends in provider_down, metered as an abort; a reply with gaps under
// the timeout, thinking included, finishes; the author's own Stop stays an
// abort; the override is read only on AI_PROVIDER=fake. No database, no spend.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-ai-idle-timeout.mts
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  LanguageModelV4,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import type { ModelMessage, UIMessageChunk } from "ai";

import { readAiError } from "../src/lib/ai-chat-contract.ts";
import {
  AI_IDLE_TIMEOUT_MS,
  idleTimer,
  streamAssistant,
} from "../src/server/ai-chat-stream.ts";
import {
  FAKE_STALL_ABORTED,
  FAKE_TRIGGER_STALL,
} from "../src/server/ai-fake-model.ts";
import {
  assistantModel,
  createAssistantModel,
} from "../src/server/ai-provider.ts";

// What assistantModel() makes of the env, in a child so each value is fresh.
if (process.argv.includes("--env-probe")) {
  for (const file of [".env.local", ".env"])
    if (existsSync(file)) process.loadEnvFile(file);
  console.log(JSON.stringify(assistantModel()?.idleTimeoutMs ?? null));
  process.exit(0);
}

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The route's console lines, kept so the checks can read them.
const logged: string[] = [];
for (const level of ["warn", "error"] as const) {
  const original = console[level];
  console[level] = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
    if (level === "error" && !String(args[0]).startsWith("AI chat stalled"))
      original(...args);
  };
}

const fake = createAssistantModel({ provider: "fake" });
const author = (text: string): ModelMessage[] => [
  {
    role: "user",
    content: [
      { type: "text", text: "Page 1\nA heading" },
      { type: "text", text },
    ],
  },
];

/** A model whose stream is `parts`, `gap` ms apart; `quiet` holds the
 *  response itself until the request is aborted. */
function scripted(
  parts: LanguageModelV4StreamPart[],
  { gap = 0, quiet = false } = {},
): LanguageModelV4 {
  return {
    ...(fake.model as LanguageModelV4),
    async doStream({ abortSignal }) {
      if (quiet)
        await new Promise((_, reject) =>
          abortSignal?.addEventListener("abort", () =>
            reject(abortSignal.reason),
          ),
        );
      const queue = [...parts];
      return {
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          async pull(c) {
            const part = queue.shift();
            if (!part) return c.close();
            if (gap) await sleep(gap);
            c.enqueue(part);
          },
        }),
      };
    },
  };
}

const finish: LanguageModelV4StreamPart = {
  type: "finish",
  finishReason: { unified: "stop", raw: undefined },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
  },
};

async function run(opts: {
  model?: LanguageModelV4;
  text?: string;
  idleMs: number;
  signal?: AbortSignal;
}) {
  const hooks = { end: 0, abort: 0, error: 0 };
  const started = Date.now();
  const stream = streamAssistant({
    config: {
      ...fake,
      model: opts.model ?? fake.model,
      idleTimeoutMs: opts.idleMs,
    },
    messages: author(opts.text ?? "Tidy this page."),
    abortSignal: opts.signal,
    hooks: {
      onEnd: () => void hooks.end++,
      onAbort: () => void hooks.abort++,
      onError: () => void hooks.error++,
    },
  });
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read())
    chunks.push(r.value);
  const error = chunks.find((c) => c.type === "error");
  return {
    chunks,
    ms: Date.now() - started,
    hooks,
    types: chunks.map((c) => c.type),
    code:
      error?.type === "error" ? readAiError(error.errorText).code : undefined,
  };
}

heading("the timer");
ok(AI_IDLE_TIMEOUT_MS === 60_000, "the route waits 60s for a chunk");
{
  const t = idleTimer(80);
  await sleep(50);
  t.reset();
  await sleep(50);
  ok(!t.signal.aborted, "a reset puts it off");
  await sleep(60);
  ok(
    t.signal.aborted && (t.signal.reason as Error).name === "TimeoutError",
    "quiet for its length, it aborts with a TimeoutError",
  );
  const s = idleTimer(40);
  s.stop();
  s.reset();
  await sleep(70);
  ok(!s.signal.aborted, "stopped, it never fires, reset or not");
}

heading("a stall mid-reply");
{
  logged.length = 0;
  const r = await run({
    text: `Tidy this page. ${FAKE_TRIGGER_STALL}`,
    idleMs: 400,
  });
  ok(
    r.types.includes("text-delta") &&
      r.types.indexOf("text-delta") < r.types.indexOf("error"),
    "the words before the stall still stream",
  );
  ok(
    r.code === "provider_down" && !r.types.includes("abort"),
    `it ends in provider_down, not an abort (${r.types.slice(-3).join(", ")})`,
  );
  ok(r.ms >= 400 && r.ms < 3000, `after the idle timeout (${r.ms}ms)`);
  ok(
    r.hooks.abort === 1 && r.hooks.end === 0,
    "metered as an abort (an estimate), not as a finished reply",
  );
  ok(
    logged.includes(FAKE_STALL_ABORTED),
    "the provider's own request was aborted",
  );
  ok(
    logged.some((l) => l.startsWith("AI chat stalled")),
    "the server log says it stalled",
  );
}

heading("a stall before the reply starts");
{
  const r = await run({
    model: scripted([finish], { quiet: true }),
    idleMs: 300,
  });
  ok(
    r.code === "provider_down" && r.hooks.abort === 1,
    `no response at all ends the same way (${r.ms}ms)`,
  );
}

heading("a slow reply with every gap under the timeout");
{
  logged.length = 0;
  const r = await run({
    model: scripted(
      [
        { type: "stream-start", warnings: [] },
        { type: "reasoning-start", id: "r" },
        ...Array.from({ length: 4 }, () => ({
          type: "reasoning-delta" as const,
          id: "r",
          delta: "thinking… ",
        })),
        { type: "reasoning-end", id: "r" },
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: "Done." },
        { type: "text-end", id: "t" },
        finish,
      ],
      { gap: 120 },
    ),
    idleMs: 300,
  });
  ok(
    r.ms > 300 && r.types.at(-1) === "finish" && !r.code,
    `it finishes though it took ${r.ms}ms in all`,
  );
  ok(r.hooks.end === 1 && r.hooks.abort === 0, "metered from its usage");
  await sleep(400);
  ok(
    !logged.some((l) => l.startsWith("AI chat stalled")),
    "and the timer never fires after it",
  );
}

heading("the author's Stop");
{
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 150);
  const r = await run({
    text: `Tidy this page. ${FAKE_TRIGGER_STALL}`,
    idleMs: 5_000,
    signal: stop.signal,
  });
  ok(
    r.types.includes("abort") && !r.code && r.ms < 2_000,
    `stays an abort (${r.types.slice(-2).join(", ")})`,
  );
}

heading("the override is the fake provider's only");
{
  const probe = (vars: Record<string, string>) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [...process.execArgv, fileURLToPath(import.meta.url), "--env-probe"],
        { env: { ...process.env, ...vars }, stdio: ["ignore", "pipe", "pipe"] },
      )
        .toString()
        .trim()
        .split("\n")
        .at(-1)!,
    ) as number | null;
  ok(
    probe({ AI_PROVIDER: "fake", AI_IDLE_TIMEOUT_MS: "2000" }) === 2000,
    "AI_PROVIDER=fake takes AI_IDLE_TIMEOUT_MS",
  );
  ok(
    probe({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-not-used",
      AI_MODEL: "",
      AI_IDLE_TIMEOUT_MS: "2000",
    }) === null,
    "a real provider ignores it",
  );
}

console.log("\nPASS — the chat route's idle timeout (#358)");
