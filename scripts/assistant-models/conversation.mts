// One case's run, the way the editor holds it (#315): the panel's loop from
// use-assistant-chat.ts with the route's logic in-process. The author's
// message carries the projection; each request goes through the route's own
// body check and model call (src/server/ai-chat-stream.ts); the reply is read
// the way useChat reads it; tool calls run through the editor's real executor
// against the real measurer; answers go back under the same run id until the
// model stops calling, the circuit-breaker trips or the run's $0.50 cap is hit.
import {
  readUIMessageStream,
  type LanguageModelUsage,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import type { Page } from "../../src/lib/blocks.ts";
import { AI_PROJECTION_PART } from "../../src/lib/ai-chat-contract.ts";
import { priceFor, RUN_SPEND_CAP_USD } from "../../src/lib/ai-pricing.ts";
import { aiToolSchemas, type AiToolOutput } from "../../src/lib/ai-tools.ts";
import { parseChatBody } from "../../src/server/ai-chat-request.ts";
import {
  streamAssistant,
  toModelMessages,
} from "../../src/server/ai-chat-stream.ts";
import { assistantTools } from "../../src/server/ai-chat-tools.ts";
import type { AssistantModel } from "../../src/server/ai-provider.ts";
import type { EditorSnapshot } from "../../src/features/editor/use-editor-history.ts";
import { createAssistantExecutor } from "../../src/features/editor/assistant/executor.ts";
import { projection } from "../../src/features/editor/assistant/projection.ts";
import { readPage } from "../../src/features/editor/assistant/tools.ts";
import {
  authorText,
  type Case,
  type FixtureIssue,
} from "../fixtures/assistant/cases.mts";
import { assistantIssue } from "./issue.mts";
import type { MeasureBrowser } from "./measure.mts";

export type LoggedCall = {
  name: string;
  input: unknown;
  /** The arguments passed the tool's zod (the SDK refuses them otherwise). */
  valid: boolean;
  output: string;
  /** The executor answered with an edit, not a refusal or a read. */
  mutated: boolean;
};

export type RequestLog = {
  ms: number;
  model: string;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  costUsd: number;
};

export type CaseRun = {
  projection: string;
  pages: Page[];
  calls: LoggedCall[];
  requests: RequestLog[];
  reply: string;
  /** Why the run ended early: the breaker, the run cap or an error. */
  stopped?: string;
  ms: number;
};

const REQUEST_LIMIT = 60;

function priced(
  model: AssistantModel,
  u: LanguageModelUsage,
  ms: number,
  reported?: string,
): RequestLog {
  const d = u.inputTokenDetails;
  const cacheRead = d.cacheReadTokens ?? 0;
  const cacheWrite = d.cacheWriteTokens ?? 0;
  const input =
    d.noCacheTokens ??
    Math.max(0, (u.inputTokens ?? 0) - cacheRead - cacheWrite);
  const output = u.outputTokens ?? 0;
  const price = priceFor(reported ?? "") ?? priceFor(model.modelId);
  const costUsd = price
    ? (input * price.inputPerMillion +
        cacheRead * price.cacheReadPerMillion +
        cacheWrite * price.cacheWritePerMillion +
        output * price.outputPerMillion) /
      1_000_000
    : 0;
  return {
    ms,
    model: reported ?? model.modelId,
    input,
    cacheRead,
    cacheWrite,
    output,
    costUsd,
  };
}

/** The reply's chunks, read to the end, and the error the stream carried. */
async function drain(stream: ReadableStream<UIMessageChunk>) {
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read())
    chunks.push(r.value);
  const error = chunks.find((c) => c.type === "error");
  return {
    chunks,
    error: error?.type === "error" ? error.errorText : undefined,
  };
}

async function assemble(
  chunks: UIMessageChunk[],
  last?: UIMessage,
): Promise<UIMessage> {
  let message = last;
  const stream = new ReadableStream<UIMessageChunk>({
    start(c) {
      for (const chunk of chunks) if (chunk.type !== "error") c.enqueue(chunk);
      c.close();
    },
  });
  for await (const m of readUIMessageStream({ stream, message: last }))
    message = m;
  return message!;
}

const textOf = (m: UIMessage | undefined) =>
  (m?.parts ?? [])
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("\n")
    .trim();

export async function runCase({
  c,
  issue,
  browser,
  model,
}: {
  c: Case;
  issue: FixtureIssue;
  browser: MeasureBrowser;
  model: AssistantModel;
}): Promise<CaseRun> {
  const started = Date.now();
  let state: EditorSnapshot = {
    pages: issue.pages,
    curPage: c.page - 1,
    sel: null,
  };
  const executor = createAssistantExecutor({
    measure: browser.measurer(),
    handle: {
      state: () => state,
      apply: async (next) => {
        state = next;
      },
    },
  });
  executor.beginRun();

  const view = projection(
    await assistantIssue(issue, state.pages, browser),
    c.page,
  );
  const runId = crypto.randomUUID();
  const author: UIMessage = {
    id: crypto.randomUUID(),
    role: "user",
    parts: [
      { type: AI_PROJECTION_PART, data: { text: view } },
      { type: "text", text: authorText(c) },
    ],
  };
  const calls: LoggedCall[] = [];
  const requests: RequestLog[] = [];
  const answered = new Set<string>();
  let reply: UIMessage | undefined;
  let stopped: string | undefined;

  for (let n = 0; n < REQUEST_LIMIT; n++) {
    const spent = requests.reduce((sum, r) => sum + r.costUsd, 0);
    if (spent >= RUN_SPEND_CAP_USD) {
      stopped = "run cap ($0.50)";
      break;
    }
    const messages = reply ? [author, reply] : [author];
    // The route's own body check: the conversation must be one it accepts.
    const body = await parseChatBody(
      { runId, issueId: "fixture", messages },
      assistantTools,
    );
    if (!body.ok) {
      stopped = `the route would refuse the request (${body.reason})`;
      break;
    }
    const t = Date.now();
    let usage: { u: LanguageModelUsage; model?: string } | undefined;
    const { chunks, error } = await drain(
      streamAssistant({
        config: model,
        messages: await toModelMessages(body.chat.messages),
        hooks: { onEnd: (u, id) => void (usage = { u, model: id }) },
      }),
    );
    if (usage)
      requests.push(priced(model, usage.u, Date.now() - t, usage.model));
    reply = await assemble(chunks, reply);
    if (error) {
      stopped = `stream error: ${error}`;
      break;
    }

    let newCalls = 0;
    for (const part of reply.parts) {
      if (!("toolCallId" in part) || answered.has(part.toolCallId)) continue;
      answered.add(part.toolCallId);
      newCalls++;
      const name = part.type.replace(/^tool-/, "");
      const valid =
        Object.hasOwn(aiToolSchemas, name) &&
        aiToolSchemas[name as keyof typeof aiToolSchemas].safeParse(part.input)
          .success;
      if (part.state !== "input-available") {
        // The SDK refused the arguments itself; the model reads its error.
        calls.push({
          name,
          input: part.input,
          valid,
          output: part.errorText ?? "",
          mutated: false,
        });
        continue;
      }
      const now = await assistantIssue(issue, state.pages, browser);
      const before = state.pages;
      const output: AiToolOutput = await executor.run(name, part.input, {
        photos: new Set(now.uploads),
        read: (args) => readPage(args, now),
      });
      calls.push({
        name,
        input: part.input,
        valid,
        output: output.text,
        mutated: state.pages !== before,
      });
      Object.assign(part, { state: "output-available", output });
      const breaker = executor.breaker();
      if (breaker) stopped = `circuit-breaker: ${breaker}`;
    }
    if (stopped || newCalls === 0) break;
  }
  return {
    projection: view,
    pages: state.pages,
    calls,
    requests,
    reply: textOf(reply),
    stopped,
    ms: Date.now() - started,
  };
}
