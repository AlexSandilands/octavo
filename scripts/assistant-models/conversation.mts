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
import {
  AI_MAX_IMAGES_PER_REQUEST,
  AI_PROJECTION_PART,
} from "../../src/lib/ai-chat-contract.ts";
import {
  priceFor,
  priceUsage,
  RUN_SPEND_CAP_USD,
} from "../../src/lib/ai-pricing.ts";
import { aiToolSchemas, type AiToolOutput } from "../../src/lib/ai-tools.ts";
import { parseChatBody } from "../../src/server/ai-chat-request.ts";
import {
  streamAssistant,
  toModelMessages,
} from "../../src/server/ai-chat-stream.ts";
import { assistantTools } from "../../src/server/ai-chat-tools.ts";
import { FAKE_TRIGGER_TOOLS } from "../../src/server/ai-fake-model.ts";
import type { AssistantModel } from "../../src/server/ai-provider.ts";
import type { EditorSnapshot } from "../../src/features/editor/use-editor-history.ts";
import {
  createAssistantExecutor,
  RUN_CALL_LIMIT,
} from "../../src/features/editor/assistant/executor.ts";
import { projection } from "../../src/features/editor/assistant/projection.ts";
import {
  reviewPages,
  reviewParts,
} from "../../src/features/editor/assistant/review.ts";
import { readPage } from "../../src/features/editor/assistant/tools.ts";
import {
  authorText,
  fakeScript,
  type Case,
  type FixtureIssue,
} from "../fixtures/assistant/cases.mts";
import { assistantIssue } from "./issue.mts";
import type { MeasureBrowser } from "./measure.mts";
import type { PageRenderer } from "./render.mts";
import { fixtureVision } from "./vision.mts";

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
  /** The pages the end-of-run review showed the model, as the panel does. */
  reviewed: number[];
  /** The breaker rule that stopped it, when one did. */
  tripped?: "calls" | "moves" | "stall";
  ms: number;
};

/** Requests past the call limit, for replies that make no calls. */
const REQUEST_HEADROOM = 20;
// A backstop on a whole reply: streamAssistant's idle timeout (#358) ends a
// stalled one first, as a stream error.
const REQUEST_TIMEOUT_MS = 180_000;

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
  const tokens = {
    promptTokens: input,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    completionTokens: output,
  };
  const priceModel = priceFor(reported ?? "") ? reported : model.modelId;
  const costUsd =
    priceModel && priceFor(priceModel) ? priceUsage(priceModel, tokens) : 0;
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

/** On the fake provider, the case's scripted calls for it to play. */
function scriptFor(c: Case, issue: FixtureIssue, model: AssistantModel) {
  const script = model.provider === "fake" && fakeScript(c, issue.pages);
  return script ? `\n\n${FAKE_TRIGGER_TOOLS}${JSON.stringify(script)}` : "";
}

export async function runCase({
  c,
  issue,
  browser,
  renderer,
  model,
  callLimit = RUN_CALL_LIMIT,
  runCapUsd = RUN_SPEND_CAP_USD,
}: {
  c: Case;
  issue: FixtureIssue;
  browser: MeasureBrowser;
  renderer: PageRenderer;
  model: AssistantModel;
  /** The breaker's call ceiling and the run's spend cap: the product's unless
   *  a sweep (--call-limit, --run-cap) says otherwise. */
  callLimit?: number;
  runCapUsd?: number;
}): Promise<CaseRun> {
  const started = Date.now();
  let state: EditorSnapshot = {
    pages: issue.pages,
    curPage: c.page - 1,
    sel: null,
  };
  const executor = createAssistantExecutor({
    callLimit,
    measure: browser.measurer(),
    handle: {
      state: () => state,
      apply: async (next) => {
        state = next;
      },
    },
  });
  executor.beginRun();
  // One author message on a fresh conversation: the whole picture allowance.
  const vision = fixtureVision(issue, renderer, () => state.pages);
  vision.beginRun(AI_MAX_IMAGES_PER_REQUEST);

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
      { type: "text", text: authorText(c) + scriptFor(c, issue, model) },
    ],
  };
  const calls: LoggedCall[] = [];
  const requests: RequestLog[] = [];
  const answered = new Set<string>();
  // Finished turns: the author's message, then a reply and the review's.
  const history: UIMessage[] = [author];
  let reply: UIMessage | undefined;
  let stopped: string | undefined;
  let reviewed: number[] | undefined;

  for (let n = 0; n < callLimit + REQUEST_HEADROOM; n++) {
    const spent = requests.reduce((sum, r) => sum + r.costUsd, 0);
    if (spent >= runCapUsd) {
      stopped = `run cap ($${runCapUsd.toFixed(2)})`;
      break;
    }
    const messages = reply ? [...history, reply] : history;
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
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    let drained: Awaited<ReturnType<typeof drain>>;
    try {
      drained = await drain(
        streamAssistant({
          config: model,
          messages: await toModelMessages(body.chat.messages),
          abortSignal: timeout,
          hooks: { onEnd: (u, id) => void (usage = { u, model: id }) },
        }),
      );
    } catch (e) {
      stopped = `request failed: ${e instanceof Error ? e.message : e}`;
      break;
    }
    if (usage)
      requests.push(priced(model, usage.u, Date.now() - t, usage.model));
    reply = await assemble(drained.chunks, reply);
    if (timeout.aborted) {
      stopped = `no reply within ${REQUEST_TIMEOUT_MS / 60_000} minutes`;
      break;
    }
    if (drained.error) {
      stopped = `stream error: ${drained.error}`;
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
        logos: now.logos,
        reply: n,
        read: (args) => readPage(args, now),
        view: (tool, args) =>
          vision.view(tool, args, now, { issueId: "fixture", logoId: null }),
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
    if (stopped) break;
    if (newCalls > 0) continue;
    // The panel's end-of-run review (#342): once, from the room views left.
    if (reviewed) break;
    const now = await assistantIssue(issue, state.pages, browser);
    reviewed = reviewPages(executor.summary(), now.pages).slice(
      0,
      vision.room(),
    );
    if (!reviewed.length || !reply) break;
    const shots = await vision.eyes.pages(
      { issueId: "fixture", logoId: null },
      now,
      reviewed,
    );
    history.push(reply, {
      id: crypto.randomUUID(),
      role: "user",
      parts: reviewParts(shots, now),
    });
    reply = undefined;
  }
  const replies = [...history.slice(1), ...(reply ? [reply] : [])].filter(
    (m) => m.role === "assistant",
  );
  return {
    projection: view,
    pages: state.pages,
    calls,
    requests,
    reply: replies.map(textOf).filter(Boolean).join("\n\n"),
    reviewed: reviewed ?? [],
    stopped,
    tripped: executor.tripped() ?? undefined,
    ms: Date.now() - started,
  };
}
