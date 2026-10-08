import "server-only";
import {
  convertToModelMessages,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
  type ModelMessage,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import {
  AI_MAX_OUTPUT_TOKENS,
  AI_PROJECTION_END,
  AI_PROJECTION_PART,
  type AiProjectionData,
} from "@/lib/ai-chat-contract";
import { assistantTools } from "@/server/ai-chat-tools";
import {
  aiError,
  classifyProviderError,
  toolCallErrorText,
} from "@/server/ai-errors";
import { systemPrompt, type PromptFeatures } from "@/server/ai-prompt";
import type { AssistantModel } from "@/server/ai-provider";

// The model call behind the chat route (#308), apart from its gates and
// metering so the model-selection fixture (#315) runs exactly this in-process.
// Everything that shapes what the provider sees and caches lives here.

// Fixed by what's merged, never by env: one prompt, one cached prefix, and the
// configuration the fixture tests. Vision is #342's part, the cover #313's.
const PROMPT_FEATURES: PromptFeatures = { vision: true, cover: true };

/** The system prompt every request sends. */
export const assistantInstructions = () => systemPrompt(PROMPT_FEATURES);

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

/** The panel's messages as the model reads them: the projection as text, and
 *  a call the author stopped mid-way (no result) left out. Throws on a
 *  message the SDK can't convert. */
export function toModelMessages(
  messages: UIMessage[],
): Promise<ModelMessage[]> {
  return convertToModelMessages(messages, {
    tools: assistantTools,
    ignoreIncompleteToolCalls: true,
    convertDataPart: (part) =>
      part.type === AI_PROJECTION_PART
        ? {
            type: "text",
            text: `${withoutBoundary((part.data as AiProjectionData).text)}\n\n${AI_PROJECTION_END}`,
          }
        : undefined,
  });
}

/** Page text can't forge the boundary: every copy is dropped, including one
 *  that a single pass would leave behind by nesting it inside another. */
function withoutBoundary(text: string): string {
  let out = text;
  while (out.includes(AI_PROJECTION_END))
    out = out.replaceAll(AI_PROJECTION_END, "");
  return out;
}

// No chunk from the provider for this long and the request is abandoned as
// provider_down (#358). A silent think is idle too: the spike's slowest reply
// was ~49s, and the one stall the fixture met lasted five minutes.
export const AI_IDLE_TIMEOUT_MS = 60_000;

/** Aborts its signal once `reset` hasn't been called for `ms`; `stop`
 *  disarms it for good. Armed from the start. */
export function idleTimer(ms: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const reset = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        controller.abort(
          new DOMException(`No chunk for ${ms}ms`, "TimeoutError"),
        ),
      ms,
    );
  };
  reset();
  return {
    signal: controller.signal,
    reset,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

export type StreamHooks = {
  onChunk?: (chunk: { type: string; text?: string; delta?: string }) => void;
  onEnd?: (
    usage: LanguageModelUsage,
    modelId: string | undefined,
  ) => void | Promise<void>;
  onAbort?: () => void | Promise<void>;
  onError?: () => void | Promise<void>;
};

/** The reply as the UI message stream the panel reads; failures arrive as
 *  its error text, `{ error, code }` JSON. A provider that goes quiet for the
 *  idle timeout has its request aborted and fails as provider_down. */
export function streamAssistant({
  config,
  messages,
  abortSignal,
  hooks = {},
}: {
  config: AssistantModel;
  messages: ModelMessage[];
  abortSignal?: AbortSignal;
  hooks?: StreamHooks;
}): ReadableStream<UIMessageChunk> {
  // Every chunk resets it, thinking included; firing aborts the provider's
  // request, which streamText reports as an abort.
  const idleMs = config.idleTimeoutMs ?? AI_IDLE_TIMEOUT_MS;
  const idle = idleTimer(idleMs);
  abortSignal?.addEventListener("abort", idle.stop, { once: true });
  const stalled = () => idle.signal.aborted && !abortSignal?.aborted;
  const result = streamText({
    model: config.model,
    // Byte-stable, with a breakpoint: the tools and prompt are cached once.
    instructions: {
      role: "system",
      content: assistantInstructions(),
      providerOptions: cached,
    },
    messages: withTailBreakpoint(messages),
    tools: assistantTools,
    reasoning: config.reasoning,
    providerOptions: config.providerOptions,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal: abortSignal
      ? AbortSignal.any([abortSignal, idle.signal])
      : idle.signal,
    onChunk: ({ chunk }) => {
      idle.reset();
      hooks.onChunk?.(chunk);
    },
    onEnd: (event) => {
      idle.stop();
      return hooks.onEnd?.(event.usage, event.finalStep?.response.modelId);
    },
    // Metered as a stopped reply is: an estimate.
    onAbort: () => {
      idle.stop();
      return hooks.onAbort?.();
    },
    onError: () => hooks.onError?.(),
  });
  return toUIMessageStream({
    stream: result.stream,
    sendReasoning: true,
    onError: (error) => {
      // Also a tool part's error text: a refused call goes back to the model.
      const refused = toolCallErrorText(error);
      if (refused) return refused;
      const code = classifyProviderError(error);
      if (code === "provider_down") console.error("AI chat failed", error);
      return JSON.stringify(aiError(code));
    },
  }).pipeThrough(
    // A stall reads as the provider failing, not as the author's Stop.
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type !== "abort" || !stalled())
          return controller.enqueue(chunk);
        console.error(
          `AI chat stalled: nothing from the provider for ${idleMs / 1000}s; request aborted`,
        );
        controller.enqueue({
          type: "error",
          errorText: JSON.stringify(aiError("provider_down")),
        });
      },
      flush: () => idle.stop(),
    }),
  );
}
