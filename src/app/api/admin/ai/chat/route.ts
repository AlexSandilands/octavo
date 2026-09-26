import { eq } from "drizzle-orm";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type ModelMessage,
} from "ai";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { isAssistantEnabled } from "@/lib/ai";
import {
  AI_MAX_BODY_BYTES,
  AI_MAX_OUTPUT_TOKENS,
  AI_PROJECTION_END,
  AI_PROJECTION_PART,
  type AiProjectionData,
} from "@/lib/ai-chat-contract";
import { RUN_SPEND_CAP_USD } from "@/lib/ai-pricing";
import { readBoundedBody } from "@/lib/bounded-body";
import { createRateLimiter } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/same-origin";
import { resolveBudget, runSpend } from "@/server/ai-budget";
import { parseChatBody } from "@/server/ai-chat-request";
import { assistantTools } from "@/server/ai-chat-tools";
import {
  aiError,
  aiErrorResponse,
  classifyProviderError,
} from "@/server/ai-errors";
import { createMeter } from "@/server/ai-metering";
import { systemPrompt } from "@/server/ai-prompt";
import { assistantModel } from "@/server/ai-provider";
import { getAdminUser } from "@/server/session";

// The assistant's one server surface (#308, docs/ai-assistant.md → "The chat
// route"). A thin proxy: it holds the key, checks access, budget and limits,
// streams the model's reply and tool calls to the editor, and meters. Tools
// run in the browser; this route never touches the issue's content.

export const maxDuration = 300;

const WINDOW_MS = 10 * 60_000;
// Every tool round trip is a request (a whole-issue build took 30–50), so the
// request limit is loose and the real bound is on runs.
const requestLimiter = createRateLimiter({ limit: 300, windowMs: WINDOW_MS });
// Counted once per distinct runId an admin sends. The id is the client's, so a
// fresh id per request would dodge the per-run spend cap; this limiter bounds
// that, and the monthly budget is the ceiling either way.
const runLimiter = createRateLimiter({ limit: 20, windowMs: WINDOW_MS });
const seenRuns = new Map<string, number>();

function isNewRun(adminId: string, runId: string): boolean {
  const now = Date.now();
  if (seenRuns.size > 10_000)
    for (const [k, until] of seenRuns) if (until <= now) seenRuns.delete(k);
  const until = seenRuns.get(`${adminId}:${runId}`);
  return until === undefined || until <= now;
}

// The default 5-minute TTL: ai-pricing bills cache writes at that rate, so
// never "1h" here.
const cached = { anthropic: { cacheControl: { type: "ephemeral" } } } as const;

/** A cache breakpoint on the newest message, so the next request reads the
 *  whole conversation so far from the cache. */
function withTailBreakpoint(messages: ModelMessage[]): ModelMessage[] {
  const last = messages[messages.length - 1];
  if (!last) return messages;
  return [...messages.slice(0, -1), { ...last, providerOptions: cached }];
}

export async function POST(request: Request) {
  // Same-origin first: route handlers get none of Server Actions' CSRF checks.
  const admin = sameOrigin(request) ? await getAdminUser() : null;
  if (!admin) return aiErrorResponse("unauthorised");
  const config = isAssistantEnabled() ? assistantModel() : null;
  if (!config) return new Response(null, { status: 404 });

  const rate = requestLimiter.check(admin.id);
  if (!rate.ok)
    return aiErrorResponse("rate_limited", {
      "Retry-After": String(rate.retryAfterSeconds),
    });

  const type = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (type?.toLowerCase() !== "application/json")
    return aiErrorResponse("bad_request");
  const body = await readBoundedBody(request, AI_MAX_BODY_BYTES);
  if (!body.ok)
    return aiErrorResponse(
      body.reason === "too-large" ? "too_long" : "bad_request",
    );
  let raw: unknown;
  try {
    raw = JSON.parse(body.bytes.toString("utf8"));
  } catch {
    return aiErrorResponse("bad_request");
  }
  const parsed = await parseChatBody(raw, assistantTools);
  if (!parsed.ok) return aiErrorResponse(parsed.reason);
  const { runId, issueId, messages } = parsed.chat;

  const [issue] = await db
    .select({ status: issues.status })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  if (!issue) return aiErrorResponse("not_found");
  if (issue.status !== "draft") return aiErrorResponse("not_draft");

  if (isNewRun(admin.id, runId)) {
    const runs = runLimiter.check(admin.id);
    if (!runs.ok)
      return aiErrorResponse("rate_limited", {
        "Retry-After": String(runs.retryAfterSeconds),
      });
    seenRuns.set(`${admin.id}:${runId}`, Date.now() + WINDOW_MS);
  }

  const [budget, spent] = await Promise.all([resolveBudget(), runSpend(runId)]);
  if (budget.remaining <= 0) return aiErrorResponse("budget_spent");
  if (spent >= RUN_SPEND_CAP_USD) return aiErrorResponse("run_cap");

  let modelMessages: ModelMessage[];
  try {
    modelMessages = await convertToModelMessages(messages, {
      tools: assistantTools,
      // A run the author stopped mid-call leaves a call with no result.
      ignoreIncompleteToolCalls: true,
      convertDataPart: (part) =>
        part.type === AI_PROJECTION_PART
          ? {
              type: "text",
              text: `${(part.data as AiProjectionData).text}\n\n${AI_PROJECTION_END}`,
            }
          : undefined,
    });
  } catch {
    return aiErrorResponse("bad_request");
  }
  // Fixed by what's merged, never by env: one prompt, one cached prefix, and
  // the configuration #315's fixture tests. Vision is #342's part.
  const instructions = systemPrompt({ vision: true });

  const meter = createMeter({
    userId: admin.id,
    issueId,
    runId,
    provider: config.provider,
    modelId: config.modelId,
    inputChars: instructions.length + JSON.stringify(modelMessages).length,
  });

  const result = streamText({
    model: config.model,
    // Byte-stable, with a breakpoint: the tools and prompt are cached once.
    instructions: {
      role: "system",
      content: instructions,
      providerOptions: cached,
    },
    messages: withTailBreakpoint(modelMessages),
    tools: assistantTools,
    reasoning: config.reasoning,
    providerOptions: config.providerOptions,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal: request.signal,
    onChunk: ({ chunk }) => meter.onChunk(chunk),
    onEnd: (event) =>
      meter.onEnd(event.usage, event.finalStep?.response.modelId),
    onAbort: () => meter.onAbort(),
    onError: () => meter.onError(),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: true,
      onError: (error) => {
        const code = classifyProviderError(error);
        if (code === "provider_down") console.error("AI chat failed", error);
        return JSON.stringify(aiError(code));
      },
    }),
  });
}
